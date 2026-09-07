const { getError } = require('../../index')
const { sessions, getSession } = require('../../embed-builder')

module.exports = async (message) => {
  try {
    if (!message || message.author?.bot || !message.guild || !message.attachments?.size) return

    for (const session of sessions.values()) {
      if (session.userId !== message.author.id || session.channelId !== message.channelId || !session.pendingUpload) continue
      if (Date.now() > session.pendingUpload.expiresAt) {
        session.pendingUpload = null
        continue
      }

      const attachment = message.attachments.find((item) => item.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(item.name || ''))
      if (!attachment) return

      const block = session.blocks[session.pendingUpload.index]
      if (!block) {
        session.pendingUpload = null
        return
      }

      if (session.pendingUpload.kind === 'thumbnail' && block.type === 'section') {
        block.thumbnail = attachment.url
      } else if (session.pendingUpload.kind === 'image' && block.type === 'image') {
        block.url = attachment.url
      } else {
        session.pendingUpload = null
        return
      }

      session.pendingUpload = null
      session.updatedAt = Date.now()
      await message.reply('🖼️ Image added to the builder. Go back to the builder and press **Preview** to see it.')
      return
    }
  } catch (error) {
    getError(error, 'embedBuilderAttachment')
  }
}
