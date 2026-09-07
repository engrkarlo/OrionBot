const { MessageFlags } = require('discord.js')
const { buildComponentsV2Embed } = require('../../components-v2-embed')
const { findTriggeredEmbeds } = require('../../saved-embeds')

module.exports = async (message) => {
  if (!message.guildId || message.author?.bot) return
  const matches = findTriggeredEmbeds(message.guildId, message.channelId, message.content)
  if (!matches.length) return

  for (const record of matches) {
    try {
      const components = buildComponentsV2Embed({ blocks: record.blocks, color: record.color, sourceId: record.id })
      await message.reply({ flags: MessageFlags.IsComponentsV2, components, allowedMentions: { parse: [] } })
    } catch (error) {
      console.error(`[saved-embeds] Failed to reply with "${record.name}":`, error)
    }
  }
}
