const { EmbedBuilder } = require('discord.js')
const { away } = require('../config')

const formatEmbedText = (text, user, reason) =>
  String(text || '')
    .replace(/\{user\}/gi, `<@${user.id}>`)
    .replace(/\{username\}/gi, user.username)
    .replace(/\{reason\}/gi, reason)

const createAwayEmbed = (user, awayEntry, noReason) => {
  const embedConfig = away.embed || {}
  const reason = awayEntry.reason || noReason
  const embed = new EmbedBuilder()
    .setColor(embedConfig.color || away.embedColor || 'Orange')
    .setDescription(formatEmbedText(embedConfig.message, user, reason))

  const title = formatEmbedText(embedConfig.title, user, reason)
  const footer = formatEmbedText(embedConfig.footer, user, reason)
  if (title) embed.setTitle(title)
  if (footer) embed.setFooter({ text: footer })
  if (embedConfig.showUserAvatar) embed.setThumbnail(user.displayAvatarURL())
  if (embedConfig.showTimestamp !== false) embed.setTimestamp(awayEntry.timestamp)

  return embed
}

module.exports = { createAwayEmbed }
