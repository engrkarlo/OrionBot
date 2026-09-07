const { ContainerBuilder, MessageFlags, TextDisplayBuilder } = require('discord.js')
const { getError, isChannelAllowed } = require('../../index')
const {
  getSession,
  deleteSession,
  buildReplyComponents,
  buildModalForBlock,
  buildUploadModal,
  colorModal,
  saveModal,
  saveSession,
  addBlock,
  updateFromModal,
  applyUploadedImage,
  createSession: createBuilderSession,
} = require('../../embed-builder')
const { buildComponentsV2Embed, normalizeOptionalColor } = require('../../components-v2-embed')
const { getSavedEmbed, listSavedEmbeds, addTrigger, removeTrigger, deleteSavedEmbed } = require('../../saved-embeds')
const { getSession: getManagerSession, deleteSession: deleteManagerSession, buildManagerComponents, triggerModal } = require('../../saved-embeds-ui')

const parseId = (customId) => {
  const parts = customId.split(':')
  if (!['eb', 'sem'].includes(parts[0]) || parts.length < 3) return null
  return { namespace: parts[0], sessionId: parts[1], action: parts.slice(2) }
}

const errorReply = async (interaction, message) => {
  const payload = { content: `:warning: ${message}`, flags: MessageFlags.Ephemeral }
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => {})
  return interaction.reply(payload).catch(() => {})
}

const updateEditor = async (interaction, session) => interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildReplyComponents(session) })
const updateManager = async (interaction, session) => interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildManagerComponents(session) })
const statusContainer = (content, color) => new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(new TextDisplayBuilder().setContent(content))

const sendSavedToChannel = async (channel, record) => {
  const components = buildComponentsV2Embed({ blocks: record.blocks, color: record.color, sourceId: record.id })
  await channel.send({ flags: MessageFlags.IsComponentsV2, components })
}

const handleStyledButton = async (interaction, sourceId, index) => {
  const numericIndex = Number(index)
  if (!Number.isInteger(numericIndex) || numericIndex < 0) throw new Error('That button is no longer available.')
  let block = null
  if (sourceId.startsWith('session-')) {
    const session = getSession(sourceId.slice('session-'.length), interaction.user.id)
    if (session) block = session.blocks[numericIndex]
  } else if (interaction.guildId) {
    const saved = getSavedEmbed(interaction.guildId, sourceId)
    if (saved) block = saved.blocks[numericIndex]
  }
  if (!block || (block.type !== 'button' && block.type !== 'section')) throw new Error('That button is no longer available.')
  const button = block.type === 'section' ? block.button : block
  if (!button || button.style === 'link') throw new Error('That button does not have an interactive response.')
  await interaction.reply({ content: button.response, flags: MessageFlags.Ephemeral })
}

const handleSavedManager = async (interaction, parsed) => {
  const session = getManagerSession(parsed.sessionId, interaction.user.id)
  if (!session) return errorReply(interaction, 'This saved-message manager session has expired. Run `/saved-embeds` again.')
  if (interaction.guildId !== session.guildId) return errorReply(interaction, 'This manager can only be used in the server where it was opened.')
  const action = parsed.action[0]

  if (interaction.isStringSelectMenu() && action === 'select') {
    if (interaction.values[0] === 'none') return updateManager(interaction, session)
    session.selected = interaction.values[0]
    await updateManager(interaction, session)
    return
  }

  if (interaction.isModalSubmit() && action === 'modal-trigger') {
    const mode = parsed.action[1] || 'add'
    const trigger = interaction.fields.getTextInputValue('trigger').trim()
    if (mode === 'remove') {
      const record = getSavedEmbed(session.guildId, session.selected)
      if (!record) throw new Error('That saved message no longer exists.')
      removeTrigger(session.guildId, record.id, trigger)
      await updateManager(interaction, session)
      return
    }
    session.pending = { trigger }
    await interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildManagerComponents(session, 'trigger') })
    return
  }

  if (interaction.isChannelSelectMenu()) {
    const channelId = interaction.values[0]
    const channel = interaction.guild.channels.cache.get(channelId)
    if (!channel) throw new Error('That channel is no longer available.')
    const record = getSavedEmbed(session.guildId, session.selected)
    if (!record) throw new Error('That saved message no longer exists.')
    if (action === 'send-channel') {
      await sendSavedToChannel(channel, record)
      session.pending = null
      await updateManager(interaction, session)
      return
    }
    if (action === 'trigger-channel') {
      if (!session.pending?.trigger) throw new Error('Enter a trigger first.')
      addTrigger(session.guildId, record.id, session.pending.trigger, channelId)
      session.pending = null
      await updateManager(interaction, session)
      return
    }
  }

  if (!interaction.isButton()) return
  if (action === 'edit') {
    const record = getSavedEmbed(session.guildId, session.selected)
    if (!record) throw new Error('That saved message no longer exists.')
    const builderSession = createBuilderSession(interaction.user.id, interaction.channelId, record)
    await interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildReplyComponents(builderSession) })
    return
  }
  if (action === 'send') {
    await interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildManagerComponents(session, 'send') })
    return
  }
  if (action === 'trigger') {
    await interaction.showModal(triggerModal(session, 'add'))
    return
  }
  if (action === 'remove-trigger') {
    await interaction.showModal(triggerModal(session, 'remove'))
    return
  }
  if (action === 'delete') {
    const record = getSavedEmbed(session.guildId, session.selected)
    if (!record) throw new Error('That saved message no longer exists.')
    deleteSavedEmbed(session.guildId, record.id)
    session.selected = listSavedEmbeds(session.guildId)[0]?.id || null
    await updateManager(interaction, session)
    return
  }
  if (action === 'back') {
    session.pending = null
    await updateManager(interaction, session)
    return
  }
  if (action === 'close') {
    deleteManagerSession(session.id)
    await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [statusContainer('## Saved messages closed\n\nRun `/saved-embeds` whenever you want to manage them again.', 0x5865f2)] })
  }
}

module.exports = async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith('cv2:')) {
      const parts = interaction.customId.split(':')
      if (parts.length === 4 && (parts[1] === 'b' || parts[1] === 's')) {
        await handleStyledButton(interaction, parts[2], parts[3])
        return
      }
    }

    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isChannelSelectMenu()) return
    const parsed = parseId(interaction.customId)
    if (!parsed) return

    if (parsed.namespace === 'sem') {
      await handleSavedManager(interaction, parsed)
      return
    }

    const session = getSession(parsed.sessionId, interaction.user.id)
    if (!session) return errorReply(interaction, 'This builder session has expired. Run `/embed-builder` again to start a new one.')
    if (interaction.channelId !== session.channelId) return errorReply(interaction, 'This builder can only be used in the channel where it was started.')
    if (!isChannelAllowed(interaction.channelId, false)) return errorReply(interaction, 'Commands are disabled in this channel.')
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
        session.color = normalizeOptionalColor(interaction.fields.getTextInputValue('color'))
        await updateEditor(interaction, session)
        return
      }
      if (action === 'modal-save') {
        saveSession(session, interaction.guildId, interaction.fields.getTextInputValue('name').trim())
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
        applyUploadedImage(session, interaction, Number(parsed.action[1]), parsed.action[2])
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
    if (action === 'color') return interaction.showModal(colorModal(session))
    if (action === 'save') return interaction.showModal(saveModal(session))
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
      if (!block || !['image', 'section'].includes(block.type)) return errorReply(interaction, 'Select an **Image** or **Section** component first, then press **Add Image**.')
      await interaction.showModal(buildUploadModal(session))
      return
    }
    if (action === 'send') {
      const components = buildComponentsV2Embed({ blocks: session.blocks, color: session.color, sourceId: `session-${session.id}` })
      await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components })
      await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [statusContainer('## Sent!\n\nYour Components V2 message has been posted here. You can keep editing or save it for reuse.', 0x57f287), ...buildReplyComponents(session)] })
      return
    }
    if (action === 'reset') {
      session.savedEmbedId = null
      session.name = ''
      session.color = null
      session.blocks = [{ type: 'text', content: '## Welcome to my server!\n\nEdit this message to get started.' }, { type: 'separator', divider: true, spacing: 'small' }]
      session.selected = 0
      session.preview = false
      await updateEditor(interaction, session)
      return
    }
    if (action === 'close') {
      deleteSession(session.id)
      await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [statusContainer('## Builder closed\n\nRun `/embed-builder` whenever you want to create another one.', 0x5865f2)] })
    }
  } catch (error) {
    getError(error, 'embedBuilderInteraction')
    await errorReply(interaction, `**Components V2 error:** ${error.message}`)
  }
}
