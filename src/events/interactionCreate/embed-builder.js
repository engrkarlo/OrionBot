const { ContainerBuilder, MessageFlags, TextDisplayBuilder } = require('discord.js')
const { getError, isChannelAllowed } = require('../../index')
const {
  getSession,
  deleteSession,
  buildReplyComponents,
  buildModalForBlock,
  buildUploadModal,
  colorModal,
  addBlock,
  updateFromModal,
  applyUploadedImage,
} = require('../../embed-builder')
const { buildComponentsV2Embed, normalizeColor } = require('../../components-v2-embed')

const parseId = (customId) => {
  const parts = customId.split(':')
  if (parts[0] !== 'eb' || parts.length < 3) return null
  return { sessionId: parts[1], action: parts.slice(2) }
}

const errorReply = async (interaction, message) => {
  const payload = { content: `:warning: ${message}`, flags: MessageFlags.Ephemeral }
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => {})
  return interaction.reply(payload).catch(() => {})
}

const updateEditor = async (interaction, session) => {
  await interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildReplyComponents(session) })
}

const statusContainer = (content, color) => new ContainerBuilder()
  .setAccentColor(color)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))

module.exports = async (interaction) => {
  try {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return

    const parsed = parseId(interaction.customId)
    if (!parsed) return

    const session = getSession(parsed.sessionId, interaction.user.id)
    if (!session) {
      await errorReply(interaction, 'This builder session has expired. Run `/embed-builder` again to start a new one.')
      return
    }
    if (interaction.channelId !== session.channelId) {
      await errorReply(interaction, 'This builder can only be used in the channel where it was started.')
      return
    }
    if (!isChannelAllowed(interaction.channelId, false)) {
      await errorReply(interaction, 'Commands are disabled in this channel.')
      return
    }

    const action = parsed.action[0]

    if (interaction.isStringSelectMenu()) {
      if (action === 'select') {
        const index = Number(interaction.values[0])
        if (!Number.isInteger(index) || !session.blocks[index]) throw new Error('That component could not be selected.')
        session.selected = index
        await updateEditor(interaction, session)
        return
      }
      if (action === 'add') {
        addBlock(session, interaction.values[0])
        await updateEditor(interaction, session)
        return
      }
    }

    if (interaction.isModalSubmit()) {
      if (action === 'modal-color') {
        session.color = `#${normalizeColor(interaction.fields.getTextInputValue('color')).toString(16).padStart(6, '0')}`
        await updateEditor(interaction, session)
        return
      }
      if (action === 'modal') {
        const index = Number(parsed.action[1])
        if (!Number.isInteger(index) || !session.blocks[index]) throw new Error('That component no longer exists.')
        session.selected = index
        updateFromModal(session, interaction)
        await updateEditor(interaction, session)
        return
      }
      if (action === 'modal-upload') {
        const index = Number(parsed.action[1])
        const kind = parsed.action[2]
        applyUploadedImage(session, interaction, index, kind)
        await updateEditor(interaction, session)
        return
      }
    }

    if (!interaction.isButton()) return

    if (action === 'edit') {
      const modal = buildModalForBlock(session)
      if (!modal) throw new Error('Select a component first.')
      await interaction.showModal(modal)
      return
    }

    if (action === 'color') {
      await interaction.showModal(colorModal(session))
      return
    }

    if (action === 'up' || action === 'down') {
      const target = action === 'up' ? session.selected - 1 : session.selected + 1
      if (target < 0 || target >= session.blocks.length) return
      const current = session.blocks[session.selected]
      session.blocks[session.selected] = session.blocks[target]
      session.blocks[target] = current
      session.selected = target
      await updateEditor(interaction, session)
      return
    }

    if (action === 'delete') {
      if (!session.blocks.length) throw new Error('There are no components to delete.')
      session.blocks.splice(session.selected, 1)
      session.selected = Math.max(0, Math.min(session.selected, session.blocks.length - 1))
      session.preview = false
      await updateEditor(interaction, session)
      return
    }

    if (action === 'preview') {
      session.preview = !session.preview
      await updateEditor(interaction, session)
      return
    }

    if (action === 'upload') {
      const block = session.blocks[session.selected]
      if (!block || !['image', 'section'].includes(block.type)) {
        await errorReply(interaction, 'Select an **Image** or **Section** component first, then press **Add Image**.')
        return
      }
      const modal = buildUploadModal(session)
      if (!modal) throw new Error('That component cannot accept an image.')
      await interaction.showModal(modal)
      return
    }

    if (action === 'send') {
      const components = buildComponentsV2Embed({ blocks: session.blocks, color: session.color })
      await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components })
      deleteSession(session.id)
      await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [statusContainer('## Sent!\n\nYour Components V2 message has been posted in this channel.', 0x57f287)],
      })
      return
    }

    if (action === 'reset') {
      session.color = '#5865F2'
      session.blocks = [
        { type: 'text', content: '## Welcome to my server!\n\nEdit this message to get started.' },
        { type: 'separator', divider: true, spacing: 'small' },
      ]
      session.selected = 0
      session.preview = false
      await updateEditor(interaction, session)
      return
    }

    if (action === 'close') {
      deleteSession(session.id)
      await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [statusContainer('## Builder closed\n\nRun `/embed-builder` whenever you want to create another message.', 0x5865f2)],
      })
    }
  } catch (error) {
    getError(error, 'embedBuilderInteraction')
    await errorReply(interaction, `**Embed builder error:** ${error.message}`)
  }
}
