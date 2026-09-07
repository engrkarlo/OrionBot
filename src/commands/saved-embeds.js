const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js')
const { isChannelAllowed, getError } = require('../index')
const { createSession, buildManagerComponents } = require('../saved-embeds-ui')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('saved-embeds')
    .setDescription('Manage saved Components V2 messages.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  run: async ({ interaction }) => {
    if (!interaction.guildId) {
      await interaction.reply({ content: ':warning: Saved messages can only be managed inside a server.', flags: MessageFlags.Ephemeral })
      return
    }
    if (!isChannelAllowed(interaction.channelId, false)) {
      await interaction.reply({ content: ':no_entry: Commands are disabled in this channel.', flags: MessageFlags.Ephemeral })
      return
    }
    try {
      const session = createSession(interaction.user.id, interaction.guildId)
      await interaction.reply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2, components: buildManagerComponents(session) })
    } catch (error) {
      getError(error, 'savedEmbeds')
      await interaction.reply({ content: `:warning: **Could not open saved messages:** ${error.message}`, flags: MessageFlags.Ephemeral })
    }
  },

  options: { deleted: false },
}
