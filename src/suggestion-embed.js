const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const { suggestions, mcserver } = require('../config')

const BUTTON_STYLES = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger,
}

const resolveButtonStyle = (style) => BUTTON_STYLES[style] || ButtonStyle.Secondary

// Returns the configured status entry (label/emoji/color), falling back to "pending"
// if a suggestion somehow ends up with a status that isn't configured.
const getStatusInfo = (status) => suggestions.statuses[status] || suggestions.statuses.pending

const buildVoteBar = (upvotes, downvotes) => {
  const cfg = suggestions.embed
  if (!cfg.showVoteBar) return ''
  const total = upvotes + downvotes
  const length = Math.max(1, cfg.voteBarLength || 14)
  const filledCount = total === 0 ? 0 : Math.round((upvotes / total) * length)
  const filled = (cfg.voteBarFilledChar || '🟩').repeat(filledCount)
  const empty = (cfg.voteBarEmptyChar || '⬜').repeat(Math.max(0, length - filledCount))
  return filled + empty
}

const formatVotesValue = (upvotes, downvotes) => {
  const cfg = suggestions.embed
  const bar = buildVoteBar(upvotes, downvotes)
  return (cfg.votesFieldValue || '{upvotes} up / {downvotes} down\n{bar}')
    .replace(/\{upvotes\}/gi, upvotes)
    .replace(/\{downvotes\}/gi, downvotes)
    .replace(/\{totalvotes\}/gi, upvotes + downvotes)
    .replace(/\{bar\}/gi, bar)
    .trim()
}

// Builds the suggestion embed. `submitter` can be a GuildMember or a User — both
// expose displayAvatarURL(), which is all this needs.
const buildSuggestionEmbed = (suggestion, { guild, submitter } = {}) => {
  const cfg = suggestions.embed
  const statusInfo = getStatusInfo(suggestion.status)
  const upvotes = suggestion.upvoters.length
  const downvotes = suggestion.downvoters.length

  const embed = new EmbedBuilder()
    .setColor(statusInfo.color || cfg.color || 'Yellow')
    .addFields(
      { name: cfg.suggestionFieldName || 'Suggestion', value: suggestion.content.slice(0, 1024) },
      {
        name: cfg.statusFieldName || 'Status',
        value: `${statusInfo.emoji ? statusInfo.emoji + ' ' : ''}${statusInfo.label}`,
      },
      { name: cfg.votesFieldName || 'Votes', value: formatVotesValue(upvotes, downvotes) || '\u200b' }
    )
    .setTimestamp(suggestion.createdAt)

  if (cfg.showSubmitterAsAuthor && submitter) {
    const name = submitter.displayName || submitter.user?.username || submitter.username || 'Unknown'
    embed.setAuthor({
      name,
      iconURL: cfg.showSubmitterAvatar ? submitter.displayAvatarURL?.() : undefined,
    })
  }

  const thumbnail = cfg.thumbnailUrl || mcserver.icon || guild?.iconURL?.()
  if (thumbnail) embed.setThumbnail(thumbnail)

  if (cfg.showFooterLink) {
    const footerText = cfg.footerText || mcserver.site
    if (footerText) {
      embed.setFooter({
        text: footerText,
        iconURL: cfg.footerIconUrl || mcserver.icon || guild?.iconURL?.() || undefined,
      })
    }
  }

  return embed
}

// Builds the button rows (vote row + moderation row) for a suggestion, respecting
// resolved/disabled/removed states from config.
const buildSuggestionComponents = (suggestion) => {
  const rows = []
  const voting = suggestions.voting
  const moderation = suggestions.moderation
  const isResolved = suggestion.status !== 'pending'
  const disableVotes = isResolved && voting.lockOnResolve
  const removeOnResolve = isResolved && moderation.removeButtonsOnResolve

  if (voting.enabled && !removeOnResolve) {
    const upLabel = voting.showCountsOnButtons ? `${voting.upvote.label} (${suggestion.upvoters.length})` : voting.upvote.label
    const downLabel = voting.showCountsOnButtons
      ? `${voting.downvote.label} (${suggestion.downvoters.length})`
      : voting.downvote.label

    const upvoteBtn = new ButtonBuilder()
      .setCustomId('sugg:up')
      .setLabel(upLabel)
      .setStyle(resolveButtonStyle(voting.upvote.style))
      .setDisabled(disableVotes)
    if (voting.upvote.emoji) upvoteBtn.setEmoji(voting.upvote.emoji)

    const downvoteBtn = new ButtonBuilder()
      .setCustomId('sugg:down')
      .setLabel(downLabel)
      .setStyle(resolveButtonStyle(voting.downvote.style))
      .setDisabled(disableVotes)
    if (voting.downvote.emoji) downvoteBtn.setEmoji(voting.downvote.emoji)

    rows.push(new ActionRowBuilder().addComponents(upvoteBtn, downvoteBtn))
  }

  if (moderation.enabled && !removeOnResolve) {
    const approveBtn = new ButtonBuilder()
      .setCustomId('sugg:approve')
      .setLabel(moderation.approve.label)
      .setStyle(resolveButtonStyle(moderation.approve.style))
      .setDisabled(isResolved)
    if (moderation.approve.emoji) approveBtn.setEmoji(moderation.approve.emoji)

    const rejectBtn = new ButtonBuilder()
      .setCustomId('sugg:reject')
      .setLabel(moderation.reject.label)
      .setStyle(resolveButtonStyle(moderation.reject.style))
      .setDisabled(isResolved)
    if (moderation.reject.emoji) rejectBtn.setEmoji(moderation.reject.emoji)

    rows.push(new ActionRowBuilder().addComponents(approveBtn, rejectBtn))
  }

  return rows
}

module.exports = { buildSuggestionEmbed, buildSuggestionComponents, getStatusInfo }
