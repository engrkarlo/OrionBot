const { MessageFlags } = require('discord.js')
const { reviews } = require('../../../config')
const { getError } = require('../../index')
const { getReview, toggleUseful, addReport, sendReportNotification, canMarkUseful } = require('../../reviews')
const { buildReviewEmbed, buildReviewComponents, buildReportModal, startReviewSubmission } = require('../../review-embed')

// Prefers the cached member (no API call) and only fetches when it isn't cached yet,
// e.g. right after a bot restart.
const resolveMember = async (guild, userId) =>
  guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null))

const replyEphemeral = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {})

module.exports = async (interaction) => {
  try {
    if (!interaction.isButton()) return
    if (!interaction.customId.startsWith('review:')) return
    if (!interaction.inGuild()) return
    if (!reviews.enabled) return

    // ── Submit A Review (works from the panel or from any existing review card) ─────────
    if (interaction.customId === 'review:submit') {
      await startReviewSubmission(interaction)
      return
    }

    const review = getReview(interaction.message.id)
    if (!review) {
      await replyEphemeral(interaction, "This review couldn't be found in the bot's data (it may predate a restart or data reset).")
      return
    }

    // ── Useful ───────────────────────────────────────────────────────────────────────────
    if (interaction.customId === 'review:useful') {
      if (!canMarkUseful(interaction.member, review.authorId)) {
        const isSelf = interaction.member?.id === review.authorId
        await replyEphemeral(
          interaction,
          isSelf ? 'You cannot mark your own review as useful.' : 'Marking reviews as useful is disabled.'
        )
        return
      }

      const result = toggleUseful(interaction.message.id, interaction.user.id)
      const submitter = await resolveMember(interaction.guild, result.review.authorId)
      const embed = buildReviewEmbed(result.review, { guild: interaction.guild, submitter })
      const components = buildReviewComponents(result.review)
      await interaction.update({ embeds: [embed], components })
      return
    }

    // ── Report ───────────────────────────────────────────────────────────────────────────
    if (interaction.customId === 'review:report') {
      if (!reviews.buttons.report.enabled) {
        await replyEphemeral(interaction, 'Reporting reviews is disabled.')
        return
      }
      if (review.reportedBy.includes(interaction.user.id)) {
        await replyEphemeral(interaction, "You've already reported this review.")
        return
      }

      if (reviews.report.askForReason) {
        await interaction.showModal(buildReportModal())
        return
      }

      const result = addReport(interaction.message.id, interaction.user.id)
      if (result.ok) await sendReportNotification(interaction.guild, result.review, interaction.user, null)
      await replyEphemeral(interaction, 'Thanks — this review has been reported to the staff team.')
    }
  } catch (error) {
    if (!interaction.replied && !interaction.deferred) {
      await replyEphemeral(interaction, 'Something went wrong handling that button.')
    }
    getError(error, 'reviewButton')
  }
}
