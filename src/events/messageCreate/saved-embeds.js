const { MessageFlags } = require('discord.js')
const { buildComponentsV2Payload } = require('../../components-v2-embed')
const { findTriggeredEmbeds } = require('../../saved-embeds')

module.exports = async (message) => {
  if (!message.guildId || message.author?.bot) return
  const matches = findTriggeredEmbeds(message.guildId, message.channelId, message.content)
  if (!matches.length) return

  for (const record of matches) {
    try {
      const payload = buildComponentsV2Payload({ blocks: record.blocks, color: record.color, sourceId: record.id })
      await message.reply({ flags: MessageFlags.IsComponentsV2, components: payload.components, files: payload.files, allowedMentions: { parse: [] } })
    } catch (error) {
      console.error(`[saved-embeds] Failed to reply with "${record.name}":`, error)
    }
  }
}
