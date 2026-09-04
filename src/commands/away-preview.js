const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js')
const { commands, away } = require('../../config')
const { canUseAway } = require('../away')
const { createAwayEmbed } = require('../away-embed')
const { cmdSlashTranslation, embedTranslation, isChannelAllowed } = require('../index')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('away-test')
    .setDescription('Preview the away notification embed.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Optional preview reason.')
        .setMaxLength(away.reasonMaxLength)
    ),

  run: async ({ interaction }) => {
    if (!canUseAway(interaction.member)) {
      await interaction.reply({
        content: cmdSlashTranslation.away.notAllowed || 'You do not have a role allowed to use this command.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    if (!isChannelAllowed(interaction.channelId, false)) {
      await interaction.reply({ content: cmdSlashTranslation.disabledChannelMsg, flags: MessageFlags.Ephemeral })
      return
    }

    const reason = interaction.options.getString('reason') || 'Test preview'
    await interaction.reply({
      embeds: [createAwayEmbed(interaction.user, { reason, timestamp: Date.now() }, embedTranslation.away.noReason)],
      flags: MessageFlags.Ephemeral,
    })
  },

  options: {
    deleted: !away.enabled || !commands.slashCommands,
  },
}
