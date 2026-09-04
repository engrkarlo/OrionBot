const { suggestions } = require('../../../config')
const { getError } = require('../../index')
const { createSuggestion, updateSuggestion, canSubmit, isSuggestionChannel } = require('../../suggestions')
const { buildSuggestionEmbed, buildSuggestionComponents } = require('../../suggestion-embed')

// Discord only accepts these exact values (in minutes) for thread auto-archive duration.
const ARCHIVE_DURATIONS = [60, 1440, 4320, 10080]

const resolveArchiveDuration = (minutes) => {
  if (ARCHIVE_DURATIONS.includes(minutes)) return minutes
  return ARCHIVE_DURATIONS.reduce((closest, value) =>
    Math.abs(value - minutes) < Math.abs(closest - minutes) ? value : closest
  )
}

// Sends a short warning that deletes itself shortly after, so the channel doesn't fill
// up with clutter from rejected/invalid submissions.
const sendSelfDeletingWarning = async (channel, content) => {
  try {
    const warning = await channel.send(content)
    setTimeout(() => warning.delete().catch(() => {}), 6000)
  } catch (error) {
    getError(error, 'suggestionWarningSend')
  }
}

module.exports = async (message) => {
  try {
    if (!suggestions.enabled) return
    if (message.author.bot || !message.guild) return
    if (!isSuggestionChannel(message.channelId)) return

    // Permission check — does this member have an allowed role to submit suggestions?
    if (!canSubmit(message.member)) {
      if (suggestions.submitting.deleteDisallowedMessage) {
        if (suggestions.submitting.warnDisallowedMessage) {
          await sendSelfDeletingWarning(
            message.channel,
            `${message.author}, you don't have permission to submit suggestions here.`
          )
        }
        await message.delete().catch(() => {})
      }
      return
    }

    const content = (message.content || '').trim()
    const minLength = suggestions.minLength || 1
    const maxLength = suggestions.maxLength || 500

    if (content.length < minLength || content.length > maxLength) {
      await sendSelfDeletingWarning(
        message.channel,
        `${message.author}, suggestions must be between ${minLength} and ${maxLength} characters.`
      )
      await message.delete().catch(() => {})
      return
    }

    const outputChannelId = suggestions.outputChannelId || message.channelId
    const outputChannel =
      outputChannelId === message.channelId
        ? message.channel
        : await message.guild.channels.fetch(outputChannelId).catch(() => null)

    if (!outputChannel || !outputChannel.isTextBased()) {
      getError(new Error(`Suggestions output channel "${outputChannelId}" is missing or not text-based.`), 'suggestionOutputChannel')
      return
    }

    const draft = {
      guildId: message.guildId,
      channelId: outputChannel.id,
      messageId: null,
      threadId: null,
      authorId: message.author.id,
      content,
      status: 'pending',
      upvoters: [],
      downvoters: [],
      createdAt: Date.now(),
      resolvedBy: null,
      resolvedAt: null,
    }

    const embed = buildSuggestionEmbed(draft, { guild: message.guild, submitter: message.member ?? message.author })
    const components = buildSuggestionComponents(draft)

    const sentMessage = await outputChannel.send({ embeds: [embed], components })
    draft.messageId = sentMessage.id
    createSuggestion(sentMessage.id, draft)

    if (suggestions.thread.enabled) {
      try {
        const threadName = (suggestions.thread.name || 'Suggestion feedback')
          .replace(/\{username\}/gi, message.author.username)
          .slice(0, 100)
        const thread = await sentMessage.startThread({
          name: threadName,
          autoArchiveDuration: resolveArchiveDuration(suggestions.thread.autoArchiveMinutes),
        })
        updateSuggestion(sentMessage.id, { threadId: thread.id })
      } catch (error) {
        getError(error, 'suggestionThreadCreate')
      }
    }

    if (suggestions.deleteOriginalMessage) {
      await message.delete().catch(() => {})
    }
  } catch (error) {
    getError(error, 'suggestionConvert')
  }
}
