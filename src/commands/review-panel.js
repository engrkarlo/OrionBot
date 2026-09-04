const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType, MessageFlags } = require('discord.js')
const { commands, reviews } = require('../../config')
const { cmdSlashTranslation, isChannelAllowed, getError } = require('../index')
const { buildPanelEmbed, buildPanelComponents } = require('../review-embed')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review-panel')
    .setDescription('Posts the review panel with a Submit A Review button.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to post the panel in. Defaults to the current channel.')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  run: async ({ interaction }) => {
    if (!isChannelAllowed(interaction.channelId, false)) {
      await interaction.reply({ content: cmdSlashTranslation.disabledChannelMsg, flags: MessageFlags.Ephemeral })
      return
    }

    try {
      const channel = interaction.options.getChannel('channel') || interaction.channel

      if (!channel?.isTextBased?.()) {
        await interaction.reply({ content: ':warning: That channel is not a text channel.', flags: MessageFlags.Ephemeral })
        return
      }

      const embed = buildPanelEmbed(interaction.guild)
      const panelComponents = buildPanelComponents()
      await channel.send({ embeds: [embed], components: panelComponents })

      await interaction.reply({
        content: `:white_check_mark: Review panel posted in ${channel}.`,
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ content: ':warning: Could not post the review panel.', flags: MessageFlags.Ephemeral })
          .catch(() => {})
      }
      getError(error, 'reviewPanelCmd')
    }
  },

  options: {
    deleted: !reviews.enabled || !commands.slashCommands, // Deletes the command from Discord
  },
}
