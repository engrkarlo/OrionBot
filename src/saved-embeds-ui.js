const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js')
const { listSavedEmbeds } = require('./saved-embeds')

const sessions = new Map()
const TTL = 30 * 60 * 1000

const makeId = (userId) => `sem-${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const createSession = (userId, guildId) => {
  const id = makeId(userId)
  const records = listSavedEmbeds(guildId)
  const session = { id, userId, guildId, selected: records[0]?.id || null, pending: null, updatedAt: Date.now() }
  sessions.set(id, session)
  return session
}

const getSession = (id, userId) => {
  const session = sessions.get(id)
  if (!session || session.userId !== userId) return null
  if (Date.now() - session.updatedAt > TTL) { sessions.delete(id); return null }
  session.updatedAt = Date.now()
  return session
}

const deleteSession = (id) => sessions.delete(id)

const buildManagerComponents = (session, mode = 'manager') => {
  const records = listSavedEmbeds(session.guildId)
  if (session.selected && !records.some((record) => record.id === session.selected)) session.selected = records[0]?.id || null
  const selected = records.find((record) => record.id === session.selected)
  const container = new ContainerBuilder().setAccentColor(0x5865f2)
  const heading = selected ? `Selected: **${selected.name}**` : 'Select a saved message to manage it.'
  const modeText = mode === 'send' ? '\n\nChoose a channel below to send the selected message.' : mode === 'trigger' ? '\n\nChoose a channel where the trigger should work.' : ''
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✦ Saved Components V2\n\n**${records.length} saved message${records.length === 1 ? '' : 's'}**\n${heading}${modeText}`))

  const options = records.length
    ? records.slice(0, 25).map((record) => ({ label: record.name.slice(0, 100), value: record.id, description: `${record.blocks.length} components${record.triggers?.length ? ` • ${record.triggers.length} trigger${record.triggers.length === 1 ? '' : 's'}` : ''}`, default: record.id === session.selected }))
    : [{ label: 'No saved messages yet', value: 'none' }]
  container.addActionRowComponents(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`sem:${session.id}:select`).setPlaceholder('Select a saved message').addOptions(options)))

  if (mode === 'send') {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`sem:${session.id}:send-channel`).setPlaceholder('Choose a destination channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice).setMinValues(1).setMaxValues(1)))
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`sem:${session.id}:back`).setLabel('Back').setStyle(ButtonStyle.Secondary)))
    return [container]
  }

  if (mode === 'trigger') {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`sem:${session.id}:trigger-channel`).setPlaceholder('Choose a channel for this trigger').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)))
    container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`sem:${session.id}:back`).setLabel('Back').setStyle(ButtonStyle.Secondary)))
    return [container]
  }

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sem:${session.id}:edit`).setLabel('Edit').setStyle(ButtonStyle.Primary).setDisabled(!selected),
    new ButtonBuilder().setCustomId(`sem:${session.id}:send`).setLabel('Send to Channel').setStyle(ButtonStyle.Success).setDisabled(!selected),
    new ButtonBuilder().setCustomId(`sem:${session.id}:trigger`).setLabel('Add Trigger').setStyle(ButtonStyle.Secondary).setDisabled(!selected),
    new ButtonBuilder().setCustomId(`sem:${session.id}:remove-trigger`).setLabel('Remove Trigger').setStyle(ButtonStyle.Secondary).setDisabled(!selected || !selected.triggers?.length),
    new ButtonBuilder().setCustomId(`sem:${session.id}:delete`).setLabel('Delete').setStyle(ButtonStyle.Danger).setDisabled(!selected),
  ))
  container.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`sem:${session.id}:close`).setLabel('Close').setStyle(ButtonStyle.Secondary)))
  return [container]
}

const triggerModal = (session, mode = 'add') => new ModalBuilder().setCustomId(`sem:${session.id}:modal-trigger:${mode}`).setTitle(mode === 'remove' ? 'Remove message trigger' : 'Add message trigger').addComponents(
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('trigger').setLabel('Trigger text').setPlaceholder('for example: !rules').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100))
)

module.exports = { sessions, createSession, getSession, deleteSession, buildManagerComponents, triggerModal }
