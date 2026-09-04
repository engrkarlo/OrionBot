const {
  SlashCommandBuilder,
  InteractionContextType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js')
const { commands, away } = require('../../config')
const { cmdSlashTranslation, isChannelAllowed, getError } = require('../index')
const { isAway, removeAway, canUseAway } = require('../away')

const AWAY_MODAL_ID = 'away-modal'
const AWAY_REASON_ID = 'away-reason'

module.exports = {
  data: new SlashCommandBuilder()
    .setName(cmdSlashTranslation.away.name)
    .setDescription(cmdSlashTranslation.away.description)
    .setContexts(InteractionContextType.Guild),

  run: async ({ interaction }) => {
    if (!canUseAway(interaction.member)) {
      await interaction.reply({
        content: cmdSlashTranslation.away.notAllowed || 'You do not have a role allowed to use this command.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    if (!isChannelAllowed(interaction.channelId, false)) {
      interaction.reply({
        content: cmdSlashTranslation.disabledChannelMsg,
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      // Already away -> using /away again simply turns it off, no form needed.
      if (isAway(interaction.guildId, interaction.user.id)) {
        removeAway(interaction.guildId, interaction.user.id)
        await interaction.reply({
          content: cmdSlashTranslation.away.turnedOff,
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      // Not away yet -> show the form to collect the away reason.
      const modal = new ModalBuilder().setCustomId(AWAY_MODAL_ID).setTitle(cmdSlashTranslation.away.modalTitle)

      const reasonInput = new TextInputBuilder()
        .setCustomId(AWAY_REASON_ID)
        .setLabel(cmdSlashTranslation.away.modalLabel)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(cmdSlashTranslation.away.modalPlaceholder)
        .setMaxLength(away.reasonMaxLength)
        .setRequired(false)

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput))

      await interaction.showModal(modal)
    } catch (error) {
      // showModal/reply may have already been attempted; guard in case a reply was never sent.
      if (!interaction.replied && !interaction.deferred) {
        interaction
          .reply({
            content: cmdSlashTranslation.away.errorReply,
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {})
      }
      getError(error, 'awayCmd')
    }
  },

  options: {
    deleted: !away.enabled || !commands.slashCommands, // Deletes the command from Discord
  },
}
