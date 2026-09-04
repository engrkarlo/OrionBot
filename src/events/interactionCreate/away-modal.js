const { EmbedBuilder, MessageFlags } = require('discord.js')
const { away } = require('../../../config')
const { setAway, canUseAway } = require('../../away')
const { cmdSlashTranslation, getError } = require('../../index')

const AWAY_MODAL_ID = 'away-modal'
const AWAY_REASON_ID = 'away-reason'

module.exports = async (interaction) => {
  try {
    if (!interaction.isModalSubmit() || interaction.customId !== AWAY_MODAL_ID) return
    if (!interaction.inGuild()) return

    if (!canUseAway(interaction.member)) {
      await interaction.reply({
        content: cmdSlashTranslation.away.notAllowed || 'You do not have a role allowed to use this command.',
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    const reason = interaction.fields.getTextInputValue(AWAY_REASON_ID).trim()
    setAway(interaction.guildId, interaction.user.id, reason)

    const confirmEmbed = new EmbedBuilder()
      .setColor(away.embed.color)
      .setDescription(
        reason ? cmdSlashTranslation.away.turnedOn.replace(/\{reason\}/gi, reason) : cmdSlashTranslation.away.turnedOnNoReason
      )

    await interaction.reply({ embeds: [confirmEmbed], flags: MessageFlags.Ephemeral })
  } catch (error) {
    if (!interaction.replied && !interaction.deferred) {
      interaction
        .reply({
          content: cmdSlashTranslation.away.errorReply,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {})
    }
    getError(error, 'awayModalSubmit')
  }
}
