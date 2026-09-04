// Data layer for the Suggestions feature.
// Suggestions are keyed by the embed message's ID and persisted to ./src/data.json
// (same file already used for serverConfig/autoChangeStatus/awayUsers), while being
// kept in an in-memory cache so button clicks never have to hit the disk to read.

const fs = require('fs')
const { PermissionFlagsBits } = require('discord.js')
const { suggestions } = require('../config')

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

// Map<messageId, { guildId, channelId, messageId, threadId, authorId, content, status,
//                   upvoters: string[], downvoters: string[], createdAt, resolvedBy, resolvedAt }>
const suggestionCache = new Map()

// Load any previously saved suggestions into memory on startup/require.
;(() => {
  const data = readDataFile()
  const stored = data.suggestions || {}
  for (const key in stored) {
    if (Object.prototype.hasOwnProperty.call(stored, key)) {
      suggestionCache.set(key, stored[key])
    }
  }
})()

const persist = () => {
  const data = readDataFile()
  data.suggestions = Object.fromEntries(suggestionCache)
  writeDataFile(data)
}

// Creates (and persists) a new suggestion record for the given embed message ID.
const createSuggestion = (messageId, record) => {
  suggestionCache.set(messageId, record)
  persist()
  return record
}

// Returns the suggestion record for the given embed message ID, or undefined.
const getSuggestion = (messageId) => suggestionCache.get(messageId)

// Shallow-merges a patch into an existing suggestion record and persists it.
// Returns the updated record, or null if no suggestion exists for that message ID.
const updateSuggestion = (messageId, patch) => {
  const current = suggestionCache.get(messageId)
  if (!current) return null
  const updated = { ...current, ...patch }
  suggestionCache.set(messageId, updated)
  persist()
  return updated
}

// Removes a suggestion record entirely. Returns true if one existed.
const deleteSuggestion = (messageId) => {
  const existed = suggestionCache.delete(messageId)
  if (existed) persist()
  return existed
}

// Toggles a member's vote on a suggestion.
// type is 'up' or 'down'. Clicking the same vote again removes it. Clicking the
// opposite vote switches it, unless voting.allowVoteChange is disabled, in which case
// the switch is rejected (ok: false) and the caller should inform the member.
const toggleVote = (messageId, userId, type) => {
  const current = suggestionCache.get(messageId)
  if (!current) return { ok: false, reason: 'not-found' }

  const sameKey = type === 'up' ? 'upvoters' : 'downvoters'
  const oppositeKey = type === 'up' ? 'downvoters' : 'upvoters'

  const hasSame = current[sameKey].includes(userId)
  const hasOpposite = current[oppositeKey].includes(userId)

  const patch = {}
  if (hasSame) {
    patch[sameKey] = current[sameKey].filter((id) => id !== userId)
  } else {
    if (hasOpposite) {
      if (!suggestions.voting.allowVoteChange) {
        return { ok: false, reason: 'already-voted-opposite' }
      }
      patch[oppositeKey] = current[oppositeKey].filter((id) => id !== userId)
    }
    patch[sameKey] = [...current[sameKey], userId]
  }

  const updated = updateSuggestion(messageId, patch)
  return { ok: true, suggestion: updated }
}

// Marks a suggestion as approved/rejected (or any other configured status key).
const setStatus = (messageId, status, resolvedBy) =>
  updateSuggestion(messageId, { status, resolvedBy, resolvedAt: Date.now() })

// ── Permission helpers ───────────────────────────────────────────────────────

const hasAnyRole = (member, roleIds) =>
  Array.isArray(roleIds) && roleIds.length > 0 && roleIds.some((id) => member?.roles?.cache?.has(id))

// Is this channel configured to auto-convert messages into suggestions?
const isSuggestionChannel = (channelId) =>
  Boolean(suggestions.enabled) && Array.isArray(suggestions.channels) && suggestions.channels.includes(channelId)

// Can this member submit suggestions? Empty allow-list = everyone can.
const canSubmit = (member) => {
  const cfg = suggestions.submitting
  if (!Array.isArray(cfg.allowedRoleIds) || !cfg.allowedRoleIds.length) return true
  return hasAnyRole(member, cfg.allowedRoleIds)
}

// Can this member vote on the given suggestion? Empty allow-list = everyone can.
const canVote = (member, submitterId) => {
  const cfg = suggestions.voting
  if (!cfg.enabled) return false
  if (!cfg.allowSelfVote && member?.id === submitterId) return false
  if (!Array.isArray(cfg.allowedRoleIds) || !cfg.allowedRoleIds.length) return true
  return hasAnyRole(member, cfg.allowedRoleIds)
}

// Can this member approve/reject suggestions?
// Falls back to requiring Manage Server if no roles and no admin bypass are configured,
// so the buttons never end up usable by everyone purely by accident.
const canModerate = (member) => {
  const cfg = suggestions.moderation
  if (!cfg.enabled) return false
  if (cfg.allowAdministrators && member?.permissions?.has?.(PermissionFlagsBits.Administrator)) return true
  if (hasAnyRole(member, cfg.allowedRoleIds)) return true
  if ((!cfg.allowedRoleIds || !cfg.allowedRoleIds.length) && !cfg.allowAdministrators) {
    return Boolean(member?.permissions?.has?.(PermissionFlagsBits.ManageGuild))
  }
  return false
}

module.exports = {
  createSuggestion,
  getSuggestion,
  updateSuggestion,
  deleteSuggestion,
  toggleVote,
  setStatus,
  isSuggestionChannel,
  canSubmit,
  canVote,
  canModerate,
}
