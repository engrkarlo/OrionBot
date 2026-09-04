const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js')
const { commands, reviews } = require('../../config')
const { cmdSlashTranslation, isChannelAllowed, getError } = require('../index')
const { startReviewSubmission } = require('../review-embed')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Leave a star-rated review.')
    .setContexts(InteractionContextType.Guild),

  run: async ({ interaction }) => {
    if (!isChannelAllowed(interaction.channelId, false)) {
      await interaction.reply({ content: cmdSlashTranslation.disabledChannelMsg, flags: MessageFlags.Ephemeral })
      return
    }

    try {
      await startReviewSubmission(interaction)
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ content: ':warning: Something went wrong starting your review.', flags: MessageFlags.Ephemeral })
          .catch(() => {})
      }
      getError(error, 'reviewCmd')
    }
  },

  options: {
    deleted: !reviews.enabled || !commands.slashCommands, // Deletes the command from Discord
  },
}
