const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js')
const { buildComponentsV2Embed } = require('../components-v2-embed')
const { isChannelAllowed, getError } = require('../index')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed-builder')
    .setDescription('Create a custom Discord Components V2 embed-style message.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option.setName('title').setDescription('Optional title displayed at the top.').setMaxLength(256)
    )
    .addStringOption((option) =>
      option.setName('description').setDescription('Main Markdown text.').setMaxLength(4000)
    )
    .addStringOption((option) =>
      option.setName('color').setDescription('Accent color as 6-digit hex, for example #5865F2.').setMaxLength(7)
    )
    .addStringOption((option) =>
      option.setName('thumbnail').setDescription('Direct HTTPS/HTTP image URL for a section thumbnail.')
    )
    .addStringOption((option) =>
      option.setName('image').setDescription('Direct HTTPS/HTTP image URL for a full-width media gallery.')
    )
    .addStringOption((option) =>
      option.setName('footer').setDescription('Small footer text displayed at the bottom.').setMaxLength(2048)
    )
    .addStringOption((option) =>
      option
        .setName('fields')
        .setDescription('JSON array: [{"name":"Status","value":"Online"}] (up to 10).')
        .setMaxLength(6000)
    )
    .addStringOption((option) =>
      option
        .setName('buttons')
        .setDescription('JSON array: [{"label":"Website","url":"https://example.com"}] (up to 5).')
        .setMaxLength(4000)
    ),

  run: async ({ interaction }) => {
    if (!isChannelAllowed(interaction.channelId, false)) {
      await interaction.reply({ content: ':no_entry: Commands are disabled in this channel.', flags: MessageFlags.Ephemeral })
      return
    }

    try {
      const parseJsonOption = (name) => {
        const value = interaction.options.getString(name)
        if (!value) return []
        try {
          return JSON.parse(value)
        } catch (_) {
          throw new Error(`${name} must contain valid JSON.`)
        }
      }

      const components = buildComponentsV2Embed({
        title: interaction.options.getString('title') || '',
        description: interaction.options.getString('description') || '',
        color: interaction.options.getString('color') || '#5865F2',
        thumbnail: interaction.options.getString('thumbnail') || '',
        image: interaction.options.getString('image') || '',
        footer: interaction.options.getString('footer') || '',
        fields: parseJsonOption('fields'),
        buttons: parseJsonOption('buttons'),
      })

      await interaction.reply({
        flags: MessageFlags.IsComponentsV2,
        components,
      })
    } catch (error) {
      getError(error, 'embedBuilder')
      const message = `:warning: **Could not build the Components V2 embed:** ${error.message}`
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: message })
      } else {
        await interaction.reply({ content: message, flags: MessageFlags.Ephemeral })
      }
    }
  },

  options: {
    deleted: false,
  },
}
