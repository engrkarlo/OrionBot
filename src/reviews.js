// Data layer for the Reviews feature.
// Reviews are keyed by the embed message's ID and persisted to ./src/data.json
// (same file already used for serverConfig/awayUsers/suggestions), while being kept
// in an in-memory cache so button clicks never have to hit the disk to read.

const fs = require('fs')
const crypto = require('crypto')
const { PermissionFlagsBits } = require('discord.js')
const { reviews } = require('../config')

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

// Map<messageId, { guildId, channelId, messageId, threadId, reviewId, authorId, rating,
//                   content, usefulVoters: string[], reportedBy: string[], createdAt }>
const reviewCache = new Map()

// Load any previously saved reviews into memory on startup/require.
;(() => {
  const data = readDataFile()
  const stored = data.reviews || {}
  for (const key in stored) {
    if (Object.prototype.hasOwnProperty.call(stored, key)) {
      reviewCache.set(key, stored[key])
    }
  }
})()

const persist = () => {
  const data = readDataFile()
  data.reviews = Object.fromEntries(reviewCache)
  writeDataFile(data)
}

// Generates a short hex ID for display in the embed footer (e.g. "b99bfa90"), retrying
// on the (extremely unlikely) chance of a collision with an existing review.
const generateReviewId = () => {
  let id
  do {
    id = crypto.randomBytes(4).toString('hex')
  } while ([...reviewCache.values()].some((r) => r.reviewId === id))
  return id
}

// Creates (and persists) a new review record for the given embed message ID.
const createReview = (messageId, record) => {
  reviewCache.set(messageId, record)
  persist()
  return record
}

// Returns the review record for the given embed message ID, or undefined.
const getReview = (messageId) => reviewCache.get(messageId)

// Shallow-merges a patch into an existing review record and persists it.
// Returns the updated record, or null if no review exists for that message ID.
const updateReview = (messageId, patch) => {
  const current = reviewCache.get(messageId)
  if (!current) return null
  const updated = { ...current, ...patch }
  reviewCache.set(messageId, updated)
  persist()
  return updated
}

// Removes a review record entirely. Returns true if one existed.
const deleteReview = (messageId) => {
  const existed = reviewCache.delete(messageId)
  if (existed) persist()
  return existed
}

// Returns an existing review by the given author in the given guild, if any — used to
// enforce submitting.oncePerUser.
const getActiveReviewByAuthor = (guildId, authorId) =>
  [...reviewCache.values()].find((review) => review.guildId === guildId && review.authorId === authorId)

// Toggles a member's "useful" vote on a review. Clicking it again removes the vote.
const toggleUseful = (messageId, userId) => {
  const current = reviewCache.get(messageId)
  if (!current) return { ok: false, reason: 'not-found' }

  const has = current.usefulVoters.includes(userId)
  const usefulVoters = has ? current.usefulVoters.filter((id) => id !== userId) : [...current.usefulVoters, userId]

  const updated = updateReview(messageId, { usefulVoters })
  return { ok: true, review: updated, added: !has }
}

// Records that a member reported a review. Returns ok: false if they already reported it.
const addReport = (messageId, userId) => {
  const current = reviewCache.get(messageId)
  if (!current) return { ok: false, reason: 'not-found' }
  if (current.reportedBy.includes(userId)) return { ok: false, reason: 'already-reported', review: current }

  const updated = updateReview(messageId, { reportedBy: [...current.reportedBy, userId] })
  return { ok: true, review: updated }
}

// Sends a report notification to the configured staff channel, pinging any configured
// roles. Fails silently (the member's report still "succeeds" even if this doesn't send) —
// notifyChannelId being blank simply disables this entirely.
const sendReportNotification = async (guild, review, reporterUser, reason) => {
  const cfg = reviews.report
  if (!cfg.notifyChannelId) return
  try {
    const channel = await guild.channels.fetch(cfg.notifyChannelId).catch(() => null)
    if (!channel || !channel.isTextBased?.()) return

    const pings =
      Array.isArray(cfg.pingRoleIds) && cfg.pingRoleIds.length ? cfg.pingRoleIds.map((id) => `<@&${id}>`).join(' ') + '\n' : ''
    const messageLink = `https://discord.com/channels/${review.guildId}/${review.channelId}/${review.messageId}`

    const content =
      `${pings}🚩 A review was reported by ${reporterUser}.\n` +
      `**Review ID:** \`${review.reviewId}\`\n` +
      (reason ? `**Reason:** ${reason}\n` : '') +
      `**Link:** ${messageLink}`

    await channel.send({ content })
  } catch (_) {
    // Fails silently — see comment above.
  }
}

// ── Permission helpers ───────────────────────────────────────────────────────

const hasAnyRole = (member, roleIds) =>
  Array.isArray(roleIds) && roleIds.length > 0 && roleIds.some((id) => member?.roles?.cache?.has(id))

// Can this member submit reviews? Empty allow-list = everyone can.
const canSubmit = (member) => {
  const cfg = reviews.submitting
  if (!Array.isArray(cfg.allowedRoleIds) || !cfg.allowedRoleIds.length) return true
  return hasAnyRole(member, cfg.allowedRoleIds)
}

// Can this member mark a review as useful?
const canMarkUseful = (member, authorId) => {
  const cfg = reviews.buttons.useful
  if (!cfg.enabled) return false
  if (!cfg.allowSelfVote && member?.id === authorId) return false
  return true
}

// Can this member delete reviews via /review-delete?
// Falls back to requiring Manage Server if no roles and no admin bypass are configured,
// so the command never ends up usable by everyone purely by accident.
const canModerate = (member) => {
  const cfg = reviews.moderation
  if (cfg.allowAdministrators && member?.permissions?.has?.(PermissionFlagsBits.Administrator)) return true
  if (hasAnyRole(member, cfg.allowedRoleIds)) return true
  if ((!cfg.allowedRoleIds || !cfg.allowedRoleIds.length) && !cfg.allowAdministrators) {
    return Boolean(member?.permissions?.has?.(PermissionFlagsBits.ManageGuild))
  }
  return false
}

module.exports = {
  generateReviewId,
  createReview,
  getReview,
  updateReview,
  deleteReview,
  getActiveReviewByAuthor,
  toggleUseful,
  addReport,
  sendReportNotification,
  canSubmit,
  canMarkUseful,
  canModerate,
}
