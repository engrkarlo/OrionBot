const { away } = require('../../../config')
const { getAway, removeAway } = require('../../away')
const { embedTranslation, cmdSlashTranslation, getError } = require('../../index')
const { createAwayEmbed } = require('../../away-embed')

module.exports = async (message) => {
  let shouldClearAway = false

  try {
    if (!away.enabled) return
    if (message.author.bot || !message.guild) return

    shouldClearAway = away.autoClearOnMessage && Boolean(getAway(message.guild.id, message.author.id))
    if (!message.mentions.users.size) return

    const notifiedUserIds = new Set()
    const embeds = []

    for (const [, mentionedUser] of message.mentions.users) {
      if (notifiedUserIds.has(mentionedUser.id)) continue

      const awayEntry = getAway(message.guild.id, mentionedUser.id)
      if (!awayEntry) continue

      notifiedUserIds.add(mentionedUser.id)

      embeds.push(createAwayEmbed(mentionedUser, awayEntry, embedTranslation.away.noReason))

      if (embeds.length >= 10) break // Discord's per-message embed limit
    }

    if (!embeds.length) return

    await message.reply({ embeds, allowedMentions: { repliedUser: false } })
  } catch (error) {
    getError(error, 'awayNotify')
  } finally {
    if (shouldClearAway) {
      removeAway(message.guild.id, message.author.id)
      await message
        .reply({ content: cmdSlashTranslation.away.turnedOff, allowedMentions: { repliedUser: false } })
        .catch((error) => getError(error, 'awayNotify'))
    }
  }
}
