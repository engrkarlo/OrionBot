// Data layer for the /away feature.
// Away statuses are stored per-guild + per-user and persisted to ./src/data.json
// (same file already used for serverConfig/autoChangeStatus/playerCountStats),
// while being kept in an in-memory cache so the messageCreate mention-watcher
// (which runs on every message) never has to hit the disk.

const fs = require('fs')
const { away } = require('../config')

const DATA_PATH = './src/data.json'

const readDataFile = () => {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (_) {
    return {}
  }
}

const writeDataFile = (data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
}

// Map<"guildId-userId", { reason: string, timestamp: number }>
const awayCache = new Map()

// Load any previously saved away statuses into memory on startup/require.
;(() => {
  const data = readDataFile()
  const awayUsers = data.awayUsers || {}
  for (const key in awayUsers) {
    if (Object.prototype.hasOwnProperty.call(awayUsers, key)) {
      awayCache.set(key, awayUsers[key])
    }
  }
})()

const getKey = (guildId, userId) => `${guildId}-${userId}`

const persist = () => {
  const data = readDataFile()
  data.awayUsers = Object.fromEntries(awayCache)
  writeDataFile(data)
}

// Returns true if the given user currently has an active away status in that guild.
const isAway = (guildId, userId) => awayCache.has(getKey(guildId, userId))

// Returns { reason, timestamp } for the given user, or undefined if not away.
const getAway = (guildId, userId) => awayCache.get(getKey(guildId, userId))

// Marks the user as away with the given reason (can be an empty string).
const setAway = (guildId, userId, reason) => {
  const entry = { reason: reason || '', timestamp: Date.now() }
  awayCache.set(getKey(guildId, userId), entry)
  persist()
  return entry
}

// Clears the user's away status. Returns true if they were away, false otherwise.
const removeAway = (guildId, userId) => {
  const key = getKey(guildId, userId)
  const existed = awayCache.delete(key)
  if (existed) persist()
  return existed
}

const canUseAway = (member) =>
  Array.isArray(away.allowedRoleIds) &&
  away.allowedRoleIds.length > 0 &&
  away.allowedRoleIds.some((roleId) => member?.roles?.cache?.has(roleId))

module.exports = {
  isAway,
  getAway,
  setAway,
  removeAway,
  canUseAway,
}
