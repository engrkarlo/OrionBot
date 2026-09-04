const { MessageFlags } = require('discord.js')
const { suggestions } = require('../../../config')
const { getError } = require('../../index')
const { getSuggestion, toggleVote, setStatus, canVote, canModerate } = require('../../suggestions')
const { buildSuggestionEmbed, buildSuggestionComponents, getStatusInfo } = require('../../suggestion-embed')

const VOTE_ACTIONS = { 'sugg:up': 'up', 'sugg:down': 'down' }
const MOD_ACTIONS = { 'sugg:approve': 'approved', 'sugg:reject': 'rejected' }

// Prefers the cached member (no API call) and only fetches when it isn't cached yet,
// e.g. right after a bot restart.
const resolveMember = async (guild, userId) =>
  guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null))

const replyEphemeral = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {})

module.exports = async (interaction) => {
  try {
    if (!interaction.isButton()) return
    if (!interaction.customId.startsWith('sugg:')) return
    if (!interaction.inGuild()) return

    const suggestion = getSuggestion(interaction.message.id)
    if (!suggestion) {
      await replyEphemeral(interaction, "This suggestion couldn't be found in the bot's data (it may predate a restart or data reset).")
      return
    }

    // ── Voting ──────────────────────────────────────────────────────────────
    if (VOTE_ACTIONS[interaction.customId]) {
      if (!suggestions.voting.enabled) {
        await replyEphemeral(interaction, 'Voting is disabled for suggestions.')
        return
      }
      if (suggestion.status !== 'pending' && suggestions.voting.lockOnResolve) {
        await replyEphemeral(interaction, 'Voting is closed — this suggestion has already been resolved.')
        return
      }
      if (!canVote(interaction.member, suggestion.authorId)) {
        const isSelf = interaction.member?.id === suggestion.authorId
        await replyEphemeral(
          interaction,
          isSelf && !suggestions.voting.allowSelfVote
            ? 'You cannot vote on your own suggestion.'
            : 'You do not have permission to vote on suggestions.'
        )
        return
      }

      const type = VOTE_ACTIONS[interaction.customId]
      const result = toggleVote(interaction.message.id, interaction.user.id, type)

      if (!result.ok) {
        await replyEphemeral(interaction, 'You already voted the other way on this suggestion.')
        return
      }

      const submitter = await resolveMember(interaction.guild, result.suggestion.authorId)
      const embed = buildSuggestionEmbed(result.suggestion, { guild: interaction.guild, submitter })
      const components = buildSuggestionComponents(result.suggestion)
      await interaction.update({ embeds: [embed], components })
      return
    }

    // ── Moderation (Approve / Reject) ──────────────────────────────────────
    if (MOD_ACTIONS[interaction.customId]) {
      if (!suggestions.moderation.enabled) {
        await replyEphemeral(interaction, 'Approving/rejecting suggestions is disabled.')
        return
      }
      if (suggestion.status !== 'pending') {
        await replyEphemeral(interaction, 'This suggestion has already been resolved.')
        return
      }
      if (!canModerate(interaction.member)) {
        await replyEphemeral(interaction, 'You do not have permission to approve or reject suggestions.')
        return
      }

      const newStatus = MOD_ACTIONS[interaction.customId]
      const updated = setStatus(interaction.message.id, newStatus, interaction.user.id)
      const statusInfo = getStatusInfo(newStatus)

      const submitter = await resolveMember(interaction.guild, updated.authorId)
      const embed = buildSuggestionEmbed(updated, { guild: interaction.guild, submitter })
      const components = buildSuggestionComponents(updated)
      await interaction.update({ embeds: [embed], components })

      const statusText = `${statusInfo.emoji ? statusInfo.emoji + ' ' : ''}${statusInfo.label}`

      if (suggestions.moderation.postResolutionInThread && updated.threadId) {
        const thread = await interaction.guild.channels.fetch(updated.threadId).catch(() => null)
        if (thread?.isThread?.()) {
          thread.send(`This suggestion was marked **${statusText}** by ${interaction.user}.`).catch(() => {})
        }
      }

      if (suggestions.moderation.dmSubmitter) {
        const submitterUser = submitter?.user ?? (await interaction.client.users.fetch(updated.authorId).catch(() => null))
        submitterUser
          ?.send(`Your suggestion in **${interaction.guild.name}** was marked **${statusText}** by ${interaction.user.tag}.`)
          .catch(() => {})
      }
    }
  } catch (error) {
    if (!interaction.replied && !interaction.deferred) {
      await replyEphemeral(interaction, 'Something went wrong handling that button.')
    }
    getError(error, 'suggestionButton')
  }
}
