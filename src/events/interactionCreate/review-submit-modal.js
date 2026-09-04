const { MessageFlags } = require('discord.js')
const { reviews } = require('../../../config')
const { getError } = require('../../index')
const { createReview, updateReview, generateReviewId, getActiveReviewByAuthor, canSubmit } = require('../../reviews')
const { buildReviewEmbed, buildReviewComponents } = require('../../review-embed')

// Discord only accepts these exact values (in minutes) for thread auto-archive duration.
const ARCHIVE_DURATIONS = [60, 1440, 4320, 10080]

const resolveArchiveDuration = (minutes) => {
  if (ARCHIVE_DURATIONS.includes(minutes)) return minutes
  return ARCHIVE_DURATIONS.reduce((closest, value) =>
    Math.abs(value - minutes) < Math.abs(closest - minutes) ? value : closest
  )
}

module.exports = async (interaction) => {
  try {
    if (!interaction.isModalSubmit()) return
    if (!interaction.customId.startsWith('review-submit-modal:')) return
    if (!interaction.inGuild() || !reviews.enabled) return

    const rating = parseInt(interaction.customId.split(':')[1], 10)
    const content = interaction.fields.getTextInputValue('review-content').trim()

    // Re-check eligibility — time may have passed between opening the modal and submitting it.
    if (!canSubmit(interaction.member)) {
      await interaction.reply({ content: 'You do not have permission to submit reviews.', flags: MessageFlags.Ephemeral })
      return
    }
    if (reviews.submitting.oncePerUser && getActiveReviewByAuthor(interaction.guildId, interaction.user.id)) {
      await interaction.reply({
        content: reviews.submitting.oncePerUserMessage || "You've already submitted a review.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const minLength = reviews.minLength || 1
    const maxLength = reviews.maxLength || 800
    if (content.length < minLength || content.length > maxLength) {
      await interaction.reply({
        content: `:warning: Reviews must be between ${minLength} and ${maxLength} characters.`,
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const outputChannelId = reviews.outputChannelId || interaction.channelId
    const outputChannel =
      outputChannelId === interaction.channelId
        ? interaction.channel
        : await interaction.guild.channels.fetch(outputChannelId).catch(() => null)

    if (!outputChannel || !outputChannel.isTextBased()) {
      await interaction.reply({
        content: ':warning: The reviews channel is not configured correctly. Please contact staff.',
        flags: MessageFlags.Ephemeral,
      })
      getError(new Error(`Reviews output channel "${outputChannelId}" is missing or not text-based.`), 'reviewOutputChannel')
      return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const draft = {
      guildId: interaction.guildId,
      channelId: outputChannel.id,
      messageId: null,
      threadId: null,
      reviewId: generateReviewId(),
      authorId: interaction.user.id,
      rating: Number.isNaN(rating) ? reviews.rating.max : rating,
      content,
      usefulVoters: [],
      reportedBy: [],
      createdAt: Date.now(),
    }

    const embed = buildReviewEmbed(draft, { guild: interaction.guild, submitter: interaction.member ?? interaction.user })
    const components = buildReviewComponents(draft)

    const sentMessage = await outputChannel.send({ embeds: [embed], components })
    draft.messageId = sentMessage.id
    createReview(sentMessage.id, draft)

    if (reviews.embed.autoReactEmojis?.length) {
      for (const emoji of reviews.embed.autoReactEmojis) {
        await sentMessage.react(emoji).catch(() => {})
      }
    }

    if (reviews.thread.enabled) {
      try {
        const threadName = (reviews.thread.name || 'Review discussion')
          .replace(/\{username\}/gi, interaction.user.username)
          .slice(0, 100)
        const thread = await sentMessage.startThread({
          name: threadName,
          autoArchiveDuration: resolveArchiveDuration(reviews.thread.autoArchiveMinutes),
        })
        updateReview(sentMessage.id, { threadId: thread.id })
      } catch (error) {
        getError(error, 'reviewThreadCreate')
      }
    }

    await interaction.editReply({ content: `:white_check_mark: Thanks for your review! It's been posted in ${outputChannel}.` })
  } catch (error) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: ':warning: Something went wrong submitting your review.', flags: MessageFlags.Ephemeral })
        .catch(() => {})
    }
    getError(error, 'reviewSubmitModal')
  }
}
