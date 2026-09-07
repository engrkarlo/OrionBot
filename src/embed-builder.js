const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js')
const { buildComponentsV2Embed, isHttpUrl } = require('./components-v2-embed')

const sessions = new Map()
const SESSION_TTL = 30 * 60 * 1000

const makeSessionId = (userId) => `${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const createSession = (userId, channelId) => {
  const id = makeSessionId(userId)
  const session = {
    id,
    userId,
    channelId,
    color: '#5865F2',
    blocks: [
      { type: 'text', content: '## Welcome to my server!\n\nEdit this message to get started.' },
      { type: 'separator', divider: true, spacing: 'small' },
    ],
    selected: 0,
    preview: false,
    pendingUpload: null,
    updatedAt: Date.now(),
  }
  sessions.set(id, session)
  return session
}

const getSession = (id, userId) => {
  const session = sessions.get(id)
  if (!session || session.userId !== userId) return null
  if (Date.now() - session.updatedAt > SESSION_TTL) {
    sessions.delete(id)
    return null
  }
  session.updatedAt = Date.now()
  return session
}

const deleteSession = (id) => sessions.delete(id)

const componentLabel = (block, index) => {
  const labels = {
    text: 'Text Display',
    separator: 'Separator',
    section: 'Section',
    image: 'Image',
    field: 'Field',
    button: 'Button',
    footer: 'Footer',
  }
  const detail = block.type === 'field' ? block.name : block.type === 'button' ? block.label : ''
  return `${index + 1}. ${labels[block.type] || block.type}${detail ? ` — ${detail}` : ''}`.slice(0, 100)
}

const builderSummary = (session) => {
  const counts = session.blocks.reduce((result, block) => {
    result[block.type] = (result[block.type] || 0) + 1
    return result
  }, {})
  const parts = [
    `${session.blocks.length} component${session.blocks.length === 1 ? '' : 's'}`,
    counts.separator ? `${counts.separator} separator${counts.separator === 1 ? '' : 's'}` : null,
    counts.image ? `${counts.image} image${counts.image === 1 ? '' : 's'}` : null,
    counts.field ? `${counts.field} field${counts.field === 1 ? '' : 's'}` : null,
    counts.button ? `${counts.button} button${counts.button === 1 ? '' : 's'}` : null,
  ].filter(Boolean)
  return parts.join(' • ')
}

const buildEditorComponents = (session) => {
  const container = new ContainerBuilder().setAccentColor(parseInt(session.color.replace('#', ''), 16) || 0x5865f2)
  const selected = session.blocks[session.selected]

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ✦ Components V2 Builder\n\n**${builderSummary(session)}**\nSelected: **${selected ? componentLabel(selected, session.selected) : 'None'}**\n\nUse the controls below to build your message. Nothing is sent until you press **Send**.`
    )
  )

  const blockOptions = session.blocks.length
    ? session.blocks.slice(0, 25).map((block, index) => ({
        label: componentLabel(block, index),
        value: String(index),
        default: index === session.selected,
      }))
    : [{ label: 'No components yet', value: 'none' }]

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`eb:${session.id}:select`)
        .setPlaceholder('Select a component to edit or move')
        .addOptions(blockOptions)
    )
  )

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`eb:${session.id}:edit`).setLabel('Edit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`eb:${session.id}:up`).setLabel('Move Up').setStyle(ButtonStyle.Secondary).setDisabled(session.selected <= 0),
      new ButtonBuilder().setCustomId(`eb:${session.id}:down`).setLabel('Move Down').setStyle(ButtonStyle.Secondary).setDisabled(session.selected >= session.blocks.length - 1),
      new ButtonBuilder().setCustomId(`eb:${session.id}:delete`).setLabel('Delete').setStyle(ButtonStyle.Danger),
    )
  )

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`eb:${session.id}:add`)
        .setPlaceholder('＋ Add a component')
        .addOptions(
          { label: 'Text Display', value: 'text', description: 'Add Markdown text anywhere in the layout.' },
          { label: 'Separator', value: 'separator', description: 'Add a divider exactly where you want it.' },
          { label: 'Section', value: 'section', description: 'Text with an optional thumbnail accessory.' },
          { label: 'Image', value: 'image', description: 'Add an image/media gallery item.' },
          { label: 'Field', value: 'field', description: 'Add a name/value field without JSON.' },
          { label: 'Button', value: 'button', description: 'Add a link button inside the container.' },
          { label: 'Footer', value: 'footer', description: 'Add small footer text anywhere in the layout.' },
        )
    )
  )

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`eb:${session.id}:preview`).setLabel(session.preview ? 'Hide Preview' : 'Preview').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`eb:${session.id}:upload`).setLabel('Add Image').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`eb:${session.id}:send`).setLabel('Send').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`eb:${session.id}:reset`).setLabel('Reset').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`eb:${session.id}:close`).setLabel('Close').setStyle(ButtonStyle.Danger),
    )
  )

  return [container]
}

const buildReplyComponents = (session) => {
  const editor = buildEditorComponents(session)
  if (!session.preview) return editor

  try {
    const preview = buildComponentsV2Embed({ blocks: session.blocks, color: session.color })[0]
    return [preview, ...editor]
  } catch (error) {
    const message = new ContainerBuilder()
      .setAccentColor(0xed4245)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Preview unavailable\n\n${error.message}`))
    return [message, ...editor]
  }
}

const buildModalForBlock = (session) => {
  const block = session.blocks[session.selected]
  if (!block) return null

  const modal = new ModalBuilder()
    .setCustomId(`eb:${session.id}:modal:${session.selected}:${block.type}`)
    .setTitle(`Edit ${componentLabel(block, session.selected).replace(/^\d+\. /, '')}`)

  const input = (id, label, value, style, required = true, maxLength) => {
    const builder = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required)
    if (value != null) builder.setValue(String(value).slice(0, 4000))
    if (maxLength) builder.setMaxLength(maxLength)
    return new ActionRowBuilder().addComponents(builder)
  }

  if (block.type === 'text') {
    modal.addComponents(input('content', 'Text / Markdown', block.content, TextInputStyle.Paragraph, true, 4000))
  } else if (block.type === 'section') {
    modal.addComponents(
      input('content', 'Section text / Markdown', block.content, TextInputStyle.Paragraph, true, 4000),
      input('thumbnail', 'Thumbnail URL (optional)', block.thumbnail || '', TextInputStyle.Short, false, 2000),
    )
  } else if (block.type === 'image') {
    modal.addComponents(input('url', 'Image URL (optional if you use Add Image)', block.url || '', TextInputStyle.Short, false, 2000))
  } else if (block.type === 'field') {
    modal.addComponents(
      input('name', 'Field name', block.name, TextInputStyle.Short, true, 256),
      input('value', 'Field value', block.value, TextInputStyle.Paragraph, true, 1024),
    )
  } else if (block.type === 'button') {
    modal.addComponents(
      input('label', 'Button label', block.label, TextInputStyle.Short, true, 80),
      input('url', 'Button URL', block.url, TextInputStyle.Short, true, 2000),
    )
  } else if (block.type === 'footer') {
    modal.addComponents(input('content', 'Footer text', block.content, TextInputStyle.Short, true, 2048))
  } else if (block.type === 'separator') {
    modal.addComponents(
      input('divider', 'Show divider? (true or false)', block.divider !== false ? 'true' : 'false', TextInputStyle.Short, true, 5),
      input('spacing', 'Spacing (small or large)', block.spacing === 'large' ? 'large' : 'small', TextInputStyle.Short, true, 6),
    )
  }

  return modal
}

const addBlock = (session, type) => {
  const defaults = {
    text: { type: 'text', content: 'New text' },
    separator: { type: 'separator', divider: true, spacing: 'small' },
    section: { type: 'section', content: 'Section text', thumbnail: '' },
    image: { type: 'image', url: '' },
    field: { type: 'field', name: 'Field name', value: 'Field value' },
    button: { type: 'button', label: 'Website', url: 'https://example.com' },
    footer: { type: 'footer', content: 'Footer text' },
  }
  if (!defaults[type]) throw new Error('Unknown component type.')
  if (session.blocks.length >= 20) throw new Error('The builder supports up to 20 components. Combine or remove some before adding more.')
  session.blocks.push({ ...defaults[type] })
  session.selected = session.blocks.length - 1
}

const updateFromModal = (session, interaction) => {
  const block = session.blocks[session.selected]
  if (!block) throw new Error('That component no longer exists.')
  const get = (id) => interaction.fields.getTextInputValue(id)

  if (block.type === 'text') block.content = get('content')
  else if (block.type === 'section') {
    block.content = get('content')
    block.thumbnail = get('thumbnail').trim()
    if (block.thumbnail && !isHttpUrl(block.thumbnail)) throw new Error('Thumbnail URL must start with http:// or https://.')
  } else if (block.type === 'image') {
    const url = get('url').trim()
    if (url && !isHttpUrl(url)) throw new Error('Image URL must start with http:// or https://.')
    block.url = url
  } else if (block.type === 'field') {
    block.name = get('name')
    block.value = get('value')
  } else if (block.type === 'button') {
    block.label = get('label')
    block.url = get('url').trim()
    if (!isHttpUrl(block.url)) throw new Error('Button URL must start with http:// or https://.')
  } else if (block.type === 'footer') block.content = get('content')
  else if (block.type === 'separator') {
    const divider = get('divider').trim().toLowerCase()
    const spacing = get('spacing').trim().toLowerCase()
    if (!['true', 'false'].includes(divider)) throw new Error('Divider must be true or false.')
    if (!['small', 'large'].includes(spacing)) throw new Error('Spacing must be small or large.')
    block.divider = divider === 'true'
    block.spacing = spacing
  }
}

const colorModal = (session) => {
  return new ModalBuilder()
    .setCustomId(`eb:${session.id}:modal-color`)
    .setTitle('Set container color')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('color').setLabel('Accent color (hex)').setStyle(TextInputStyle.Short).setValue(session.color).setRequired(true).setMaxLength(7)
      )
    )
}

module.exports = {
  sessions,
  createSession,
  getSession,
  deleteSession,
  buildEditorComponents,
  buildReplyComponents,
  buildModalForBlock,
  colorModal,
  addBlock,
  updateFromModal,
}
