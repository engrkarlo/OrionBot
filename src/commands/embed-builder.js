const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js')
const { isChannelAllowed, getError } = require('../index')
const { createSession, buildReplyComponents } = require('../embed-builder')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed-builder')
    .setDescription('Open the visual Components V2 message builder.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  run: async ({ interaction }) => {
    if (!isChannelAllowed(interaction.channelId, false)) {
      await interaction.reply({ content: ':no_entry: Commands are disabled in this channel.', flags: MessageFlags.Ephemeral })
      return
    }

    try {
      const session = createSession(interaction.user.id, interaction.channelId)
      await interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: buildReplyComponents(session),
      })
    } catch (error) {
      getError(error, 'embedBuilder')
      await interaction.reply({
        content: `:warning: **Could not open the embed builder:** ${error.message}`,
        flags: MessageFlags.Ephemeral,
      })
    }
  },

  options: { deleted: false },
}
