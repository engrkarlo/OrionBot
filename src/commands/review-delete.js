const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js')
const { commands, reviews } = require('../../config')
const { cmdSlashTranslation, isChannelAllowed, getError } = require('../index')
const { getReview, deleteReview, canModerate } = require('../reviews')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review-delete')
    .setDescription('Deletes a review by its message ID.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option.setName('message_id').setDescription('The ID of the review message to delete.').setRequired(true)
    ),

  run: async ({ interaction }) => {
    if (!isChannelAllowed(interaction.channelId, false)) {
      await interaction.reply({ content: cmdSlashTranslation.disabledChannelMsg, flags: MessageFlags.Ephemeral })
      return
    }

    if (!canModerate(interaction.member)) {
      await interaction.reply({ content: 'You do not have permission to delete reviews.', flags: MessageFlags.Ephemeral })
      return
    }

    const messageId = interaction.options.getString('message_id', true).trim()
    const review = getReview(messageId)

    if (!review) {
      await interaction.reply({ content: ':warning: No review found with that message ID.', flags: MessageFlags.Ephemeral })
      return
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      const channel = await interaction.guild.channels.fetch(review.channelId).catch(() => null)
      if (channel) {
        await channel.messages.delete(messageId).catch(() => {})
      }
      if (review.threadId) {
        const thread = await interaction.guild.channels.fetch(review.threadId).catch(() => null)
        if (thread) await thread.delete().catch(() => {})
      }

      deleteReview(messageId)
      await interaction.editReply({ content: ':white_check_mark: Review deleted.' })
    } catch (error) {
      await interaction.editReply({ content: ':warning: Could not delete that review.' })
      getError(error, 'reviewDeleteCmd')
    }
  },

  options: {
    deleted: !reviews.enabled || !commands.slashCommands, // Deletes the command from Discord
  },
}
