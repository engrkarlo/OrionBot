const { MessageFlags } = require('discord.js')
const { reviews } = require('../../../config')
const { getError } = require('../../index')
const { getReview, addReport, sendReportNotification } = require('../../reviews')

module.exports = async (interaction) => {
  try {
    if (!interaction.isModalSubmit()) return
    if (interaction.customId !== 'review-report-modal') return
    if (!interaction.inGuild() || !reviews.enabled) return
    if (!interaction.message) return // Should always be present — the modal was opened from the report button.

    const review = getReview(interaction.message.id)
    if (!review) {
      await interaction.reply({ content: "This review couldn't be found in the bot's data.", flags: MessageFlags.Ephemeral })
      return
    }

    const reason = interaction.fields.getTextInputValue('review-report-reason').trim()
    const result = addReport(interaction.message.id, interaction.user.id)

    if (!result.ok) {
      await interaction.reply({ content: "You've already reported this review.", flags: MessageFlags.Ephemeral })
      return
    }

    await sendReportNotification(interaction.guild, result.review, interaction.user, reason)

    await interaction.reply({
      content: 'Thanks — this review has been reported to the staff team.',
      flags: MessageFlags.Ephemeral,
    })
  } catch (error) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: ':warning: Something went wrong reporting that review.', flags: MessageFlags.Ephemeral })
        .catch(() => {})
    }
    getError(error, 'reviewReportModal')
  }
}
