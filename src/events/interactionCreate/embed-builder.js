const { ContainerBuilder, MessageFlags, TextDisplayBuilder } = require('discord.js')
const { getError, isChannelAllowed } = require('../../index')
const {
  getSession,
  deleteSession,
  buildReplyPayload,
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
const { buildComponentsV2Payload, normalizeOptionalColor } = require('../../components-v2-embed')
const { getSavedEmbed, listSavedEmbeds, addTrigger, updateTrigger, removeTriggerAt, deleteSavedEmbed } = require('../../saved-embeds')
const { getSession: getManagerSession, deleteSession: deleteManagerSession, buildManagerComponents, triggerModal, deleteSavedModal } = require('../../saved-embeds-ui')

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
const updateEditor = async (interaction, session) => {
  const payload = buildReplyPayload(session)
  return interaction.update({ flags: MessageFlags.IsComponentsV2, components: payload.components, files: payload.files, attachments: [] })
}
const updateManager = async (interaction, session) => interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildManagerComponents(session) })
const statusContainer = (content, color) => new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
const sendSavedToChannel = async (channel, record) => {
  const payload = buildComponentsV2Payload({ blocks: record.blocks, color: record.color, sourceId: record.id })
  return channel.send({ flags: MessageFlags.IsComponentsV2, components: payload.components, files: payload.files })
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
    if (interaction.values[0] !== 'none') session.selected = interaction.values[0]
    session.selectedTrigger = null
    await updateManager(interaction, session)
    return
  }
  if (interaction.isStringSelectMenu() && action === 'trigger-select') {
    if (interaction.values[0] === 'none') { session.selectedTrigger = null; await updateManager(interaction, session); return }
    session.selectedTrigger = interaction.values[0]
    const [recordId] = session.selectedTrigger.split(':')
    if (getSavedEmbed(session.guildId, recordId)) session.selected = recordId
    await updateManager(interaction, session)
    return
  }

  if (interaction.isModalSubmit() && action === 'modal-trigger') {
    const mode = parsed.action[1] || 'add'
    const trigger = interaction.fields.getTextInputValue('trigger').trim()
    if (mode === 'edit') {
      const recordId = parsed.action[2]
      const index = Number(parsed.action[3])
      const record = getSavedEmbed(session.guildId, recordId)
      if (!record) throw new Error('That saved message no longer exists.')
      updateTrigger(session.guildId, record.id, index, trigger)
      session.selected = record.id
      session.selectedTrigger = `${record.id}:${index}`
      await updateManager(interaction, session)
      return
    }
    const record = getSavedEmbed(session.guildId, session.selected)
    if (!record) throw new Error('That saved message no longer exists.')
    session.pending = { trigger }
    await interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildManagerComponents(session, 'trigger') })
    return
  }

  if (interaction.isModalSubmit() && action === 'modal-delete') {
    const confirmation = interaction.fields.getTextInputValue('confirmation').trim().toUpperCase()
    if (confirmation !== 'DELETE') throw new Error('Deletion cancelled. Type **DELETE** exactly to remove the saved message.')
    const record = getSavedEmbed(session.guildId, session.selected)
    if (!record) throw new Error('That saved message no longer exists.')
    deleteSavedEmbed(session.guildId, record.id)
    session.selected = listSavedEmbeds(session.guildId)[0]?.id || null
    session.selectedTrigger = null
    await updateManager(interaction, session)
    return
  }

  if (interaction.isChannelSelectMenu()) {
    const channel = interaction.guild.channels.cache.get(interaction.values[0])
    if (!channel) throw new Error('That channel is no longer available.')
    const record = getSavedEmbed(session.guildId, session.selected)
    if (!record) throw new Error('That saved message no longer exists.')
    if (action === 'send-channel') { await sendSavedToChannel(channel, record); session.pending = null; await updateManager(interaction, session); return }
    if (action === 'trigger-channel') {
      if (!session.pending?.trigger) throw new Error('Enter a trigger first.')
      addTrigger(session.guildId, record.id, session.pending.trigger, channel.id); session.pending = null; await updateManager(interaction, session); return
    }
  }

  if (!interaction.isButton()) return
  if (action === 'edit') {
    const record = getSavedEmbed(session.guildId, session.selected)
    if (!record) throw new Error('That saved message no longer exists.')
    const builderSession = createBuilderSession(interaction.user.id, interaction.channelId, record)
    const payload = buildReplyPayload(builderSession)
    await interaction.update({ flags: MessageFlags.IsComponentsV2, components: payload.components, files: payload.files, attachments: [] })
    return
  }
  if (action === 'send') { await interaction.update({ flags: MessageFlags.IsComponentsV2, components: buildManagerComponents(session, 'send') }); return }
  if (action === 'trigger') { await interaction.showModal(triggerModal(session, 'add')); return }
  if (action === 'edit-trigger') {
    if (!session.selectedTrigger) throw new Error('Select a trigger from the trigger list first.')
    const [recordId, indexText] = session.selectedTrigger.split(':')
    const index = Number(indexText)
    const record = getSavedEmbed(session.guildId, recordId)
    const trigger = record?.triggers?.[index]
    if (!record || !trigger) throw new Error('That trigger no longer exists.')
    await interaction.showModal(triggerModal(session, 'edit', trigger.trigger, record.id, index))
    return
  }
  if (action === 'delete-trigger') {
    if (!session.selectedTrigger) throw new Error('Select a trigger from the trigger list first.')
    const [recordId, indexText] = session.selectedTrigger.split(':')
    const index = Number(indexText)
    const record = getSavedEmbed(session.guildId, recordId)
    if (!record || !record.triggers?.[index]) throw new Error('That trigger no longer exists.')
    removeTriggerAt(session.guildId, record.id, index)
    session.selectedTrigger = null
    session.selected = record.id
    await updateManager(interaction, session)
    return
  }
  if (action === 'delete') {
    const record = getSavedEmbed(session.guildId, session.selected)
    if (!record) throw new Error('That saved message no longer exists.')
    await interaction.showModal(deleteSavedModal(session, record.name))
    return
  }
  if (action === 'back') { session.pending = null; await updateManager(interaction, session); return }
  if (action === 'close') { deleteManagerSession(session.id); await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [statusContainer('## Saved messages closed\n\nRun `/saved-embeds` whenever you want to manage them again.', 0x5865f2)] }) }
}

module.exports = async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith('cv2:')) {
      const parts = interaction.customId.split(':')
      if (parts.length === 4 && (parts[1] === 'b' || parts[1] === 's')) { await handleStyledButton(interaction, parts[2], parts[3]); return }
    }
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit() && !interaction.isChannelSelectMenu()) return
    const parsed = parseId(interaction.customId)
    if (!parsed) return
    if (parsed.namespace === 'sem') { await handleSavedManager(interaction, parsed); return }

    const session = getSession(parsed.sessionId, interaction.user.id)
    if (!session) return errorReply(interaction, 'This builder session has expired. Run `/embed-builder` again to start a new one.')
    if (interaction.channelId !== session.channelId) return errorReply(interaction, 'This builder can only be used in the channel where it was started.')
    if (!isChannelAllowed(interaction.channelId, false)) return errorReply(interaction, 'Commands are disabled in this channel.')
    const action = parsed.action[0]

    if (interaction.isStringSelectMenu()) {
      if (action === 'select') {
        const index = Number(interaction.values[0])
        if (!Number.isInteger(index) || !session.blocks[index]) throw new Error('That component could not be selected.')
        session.selected = index; await updateEditor(interaction, session); return
      }
      if (action === 'add') { addBlock(session, interaction.values[0]); await updateEditor(interaction, session); return }
    }
    if (interaction.isModalSubmit()) {
      if (action === 'modal-color') { session.color = normalizeOptionalColor(interaction.fields.getTextInputValue('color')); await updateEditor(interaction, session); return }
      if (action === 'modal-save') { saveSession(session, interaction.guildId, interaction.fields.getTextInputValue('name').trim()); await updateEditor(interaction, session); return }
      if (action === 'modal') { const index = Number(parsed.action[1]); if (!Number.isInteger(index) || !session.blocks[index]) throw new Error('That component no longer exists.'); session.selected = index; updateFromModal(session, interaction); await updateEditor(interaction, session); return }
      if (action === 'modal-upload') { applyUploadedImage(session, interaction, Number(parsed.action[1]), parsed.action[2]); await updateEditor(interaction, session); return }
    }
    if (!interaction.isButton()) return
    if (action === 'edit') { const modal = buildModalForBlock(session); if (!modal) throw new Error('Select a component first.'); await interaction.showModal(modal); return }
    if (action === 'color') { await interaction.showModal(colorModal(session)); return }
    if (action === 'save') { await interaction.showModal(saveModal(session)); return }
    if (action === 'duplicate') {
      if (!session.blocks[session.selected]) throw new Error('Select a component to duplicate.')
      if (session.blocks.length >= 20) throw new Error('The builder supports up to 20 components.')
      session.blocks.splice(session.selected + 1, 0, structuredClone(session.blocks[session.selected])); session.selected += 1; await updateEditor(interaction, session); return
    }
    if (action === 'up' || action === 'down') {
      const target = action === 'up' ? session.selected - 1 : session.selected + 1
      if (target < 0 || target >= session.blocks.length) return
      const current = session.blocks[session.selected]; session.blocks[session.selected] = session.blocks[target]; session.blocks[target] = current; session.selected = target; await updateEditor(interaction, session); return
    }
    if (action === 'delete') {
      if (!session.blocks.length) throw new Error('There are no components to delete.')
      session.blocks.splice(session.selected, 1); session.selected = Math.max(0, Math.min(session.selected, session.blocks.length - 1)); session.preview = false; await updateEditor(interaction, session); return
    }
    if (action === 'preview') { session.preview = !session.preview; await updateEditor(interaction, session); return }
    if (action === 'send') {
      const payload = buildComponentsV2Payload({ blocks: session.blocks, color: session.color, sourceId: `session-${session.id}` })
      await interaction.channel.send({ flags: MessageFlags.IsComponentsV2, components: payload.components, files: payload.files })
      const reply = buildReplyPayload(session)
      await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [statusContainer('## Sent!\n\nYour Components V2 message has been posted here. You can keep editing or save it for reuse.', 0x57f287), ...reply.components], files: reply.files, attachments: [] })
      return
    }
    if (action === 'reset') {
      session.savedEmbedId = null; session.name = ''; session.color = null; session.blocks = [{ type: 'text', content: '## Welcome to my server!\n\nEdit this message to get started.' }, { type: 'separator', divider: true, spacing: 'small' }]; session.selected = 0; session.preview = false; await updateEditor(interaction, session); return
    }
    if (action === 'close') { deleteSession(session.id); await interaction.update({ flags: MessageFlags.IsComponentsV2, components: [statusContainer('## Builder closed\n\nRun `/embed-builder` whenever you want to create another one.', 0x5865f2)], attachments: [] }) }
  } catch (error) {
    getError(error, 'embedBuilderInteraction')
    await errorReply(interaction, `**Components V2 error:** ${error.message}`)
  }
}
