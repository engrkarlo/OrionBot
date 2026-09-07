const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js')
const { buildComponentsV2Embed, isHttpUrl, normalizeColor } = require('./components-v2-embed')

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
  const labels = { text: 'Text Display', separator: 'Separator', section: 'Section', image: 'Image', field: 'Field', button: 'Button', footer: 'Footer' }
  const detail = block.type === 'field' ? block.name : block.type === 'button' ? block.label : ''
  return `${index + 1}. ${labels[block.type] || block.type}${detail ? ` — ${detail}` : ''}`.slice(0, 100)
}

const builderSummary = (session) => {
  const counts = session.blocks.reduce((result, block) => {
    result[block.type] = (result[block.type] || 0) + 1
    return result
  }, {})
  return [
    `${session.blocks.length} component${session.blocks.length === 1 ? '' : 's'}`,
    counts.separator ? `${counts.separator} separator${counts.separator === 1 ? '' : 's'}` : null,
    counts.image ? `${counts.image} image${counts.image === 1 ? '' : 's'}` : null,
    counts.field ? `${counts.field} field${counts.field === 1 ? '' : 's'}` : null,
    counts.button ? `${counts.button} button${counts.button === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' • ')
}

const buildEditorComponents = (session) => {
  const color = normalizeColor(session.color)
  const container = new ContainerBuilder().setAccentColor(color)
  const selected = session.blocks[session.selected]

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `## ✦ Components V2 Builder\n\n**${builderSummary(session)}**\nSelected: **${selected ? componentLabel(selected, session.selected) : 'None'}**\nAccent: **${session.color.toUpperCase()}**\n\nBuild your message visually. Add components, move them into the order you want, edit their content, and preview the exact Components V2 layout before sending.`
  ))

  const blockOptions = session.blocks.length
    ? session.blocks.slice(0, 25).map((block, index) => ({ label: componentLabel(block, index), value: String(index), default: index === session.selected }))
    : [{ label: 'No components yet', value: 'none' }]

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`eb:${session.id}:select`).setPlaceholder('Select a component').addOptions(blockOptions)
  ))

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`eb:${session.id}:edit`).setLabel('Edit').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:color`).setLabel('Color').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:up`).setLabel('Move Up').setStyle(ButtonStyle.Secondary).setDisabled(session.selected <= 0),
    new ButtonBuilder().setCustomId(`eb:${session.id}:down`).setLabel('Move Down').setStyle(ButtonStyle.Secondary).setDisabled(session.selected >= session.blocks.length - 1),
    new ButtonBuilder().setCustomId(`eb:${session.id}:delete`).setLabel('Delete').setStyle(ButtonStyle.Danger),
  ))

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`eb:${session.id}:add`).setPlaceholder('＋ Add a component').addOptions(
      { label: 'Text Display', value: 'text', description: 'Add Markdown text anywhere in the layout.' },
      { label: 'Separator', value: 'separator', description: 'Place a divider anywhere you want.' },
      { label: 'Section', value: 'section', description: 'Text with an optional thumbnail.' },
      { label: 'Image', value: 'image', description: 'Add an image to the media gallery.' },
      { label: 'Field', value: 'field', description: 'Add a name/value field without JSON.' },
      { label: 'Button', value: 'button', description: 'Add a link button inside the container.' },
      { label: 'Footer', value: 'footer', description: 'Add small footer text anywhere.' },
    )
  ))

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`eb:${session.id}:preview`).setLabel(session.preview ? 'Hide Preview' : 'Preview').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:upload`).setLabel('Add Image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:send`).setLabel('Send').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`eb:${session.id}:reset`).setLabel('Reset').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:close`).setLabel('Close').setStyle(ButtonStyle.Danger),
  ))

  return [container]
}

const buildReplyComponents = (session) => {
  const editor = buildEditorComponents(session)
  if (!session.preview) return editor
  try {
    const preview = buildComponentsV2Embed({ blocks: session.blocks, color: session.color })[0]
    return [preview, ...editor]
  } catch (error) {
    const message = new ContainerBuilder().setAccentColor(0xed4245).addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### Preview unavailable\n\n${error.message}`)
    )
    return [message, ...editor]
  }
}

const buildModalForBlock = (session) => {
  const block = session.blocks[session.selected]
  if (!block) return null
  const modal = new ModalBuilder().setCustomId(`eb:${session.id}:modal:${session.selected}:${block.type}`).setTitle(`Edit ${componentLabel(block, session.selected).replace(/^\d+\. /, '')}`)
  const input = (id, label, value, style, required = true, maxLength) => {
    const builder = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required)
    if (value != null) builder.setValue(String(value).slice(0, 4000))
    if (maxLength) builder.setMaxLength(maxLength)
    return new ActionRowBuilder().addComponents(builder)
  }
  if (block.type === 'text') modal.addComponents(input('content', 'Text / Markdown', block.content, TextInputStyle.Paragraph, true, 4000))
  else if (block.type === 'section') modal.addComponents(input('content', 'Section text / Markdown', block.content, TextInputStyle.Paragraph, true, 4000), input('thumbnail', 'Thumbnail URL (optional)', block.thumbnail || '', TextInputStyle.Short, false, 2000))
  else if (block.type === 'image') modal.addComponents(input('url', 'Image URL (optional if you upload)', block.url || '', TextInputStyle.Short, false, 2000))
  else if (block.type === 'field') modal.addComponents(input('name', 'Field name', block.name, TextInputStyle.Short, true, 256), input('value', 'Field value', block.value, TextInputStyle.Paragraph, true, 1024))
  else if (block.type === 'button') modal.addComponents(input('label', 'Button label', block.label, TextInputStyle.Short, true, 80), input('url', 'Button URL', block.url, TextInputStyle.Short, true, 2000))
  else if (block.type === 'footer') modal.addComponents(input('content', 'Footer text', block.content, TextInputStyle.Short, true, 2048))
  else if (block.type === 'separator') modal.addComponents(input('divider', 'Show divider? (true or false)', block.divider !== false ? 'true' : 'false', TextInputStyle.Short, true, 5), input('spacing', 'Spacing (small or large)', block.spacing === 'large' ? 'large' : 'small', TextInputStyle.Short, true, 6))
  return modal
}

const buildUploadModal = (session) => {
  const block = session.blocks[session.selected]
  if (!block || !['image', 'section'].includes(block.type)) return null
  const kind = block.type === 'section' ? 'thumbnail' : 'image'
  const upload = new FileUploadBuilder()
    .setCustomId('file')
    .setMinValues(1)
    .setMaxValues(1)
    .setRequired(true)
    .setFileTypes('.png', '.jpg', '.jpeg', '.gif', '.webp')
  const label = new LabelBuilder()
    .setLabel(block.type === 'section' ? 'Choose a thumbnail image' : 'Choose an image')
    .setDescription('Pick an image from your computer. It will be used in the selected component.')
    .setFileUploadComponent(upload)
  return new ModalBuilder()
    .setCustomId(`eb:${session.id}:modal-upload:${session.selected}:${kind}`)
    .setTitle(block.type === 'section' ? 'Upload Thumbnail' : 'Upload Image')
    .addLabelComponents(label)
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
  if (session.blocks.length >= 20) throw new Error('The builder supports up to 20 components. Remove or combine some before adding more.')
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

const colorModal = (session) => new ModalBuilder().setCustomId(`eb:${session.id}:modal-color`).setTitle('Set container color').addComponents(
  new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('color').setLabel('Accent color (hex)').setStyle(TextInputStyle.Short).setValue(session.color).setRequired(true).setMaxLength(7)
  )
)

const applyUploadedImage = (session, interaction, index, kind) => {
  const block = session.blocks[index]
  if (!block || !['image', 'section'].includes(block.type)) throw new Error('That image component no longer exists.')
  const files = interaction.fields.getUploadedFiles('file', true)
  const attachment = files.first()
  if (!attachment || !attachment.contentType?.startsWith('image/')) throw new Error('Please upload a valid image file.')
  if (kind === 'thumbnail' && block.type === 'section') block.thumbnail = attachment.url
  else if (kind === 'image' && block.type === 'image') block.url = attachment.url
  else throw new Error('The uploaded image no longer matches the selected component.')
  session.selected = index
}

module.exports = { sessions, createSession, getSession, deleteSession, buildEditorComponents, buildReplyComponents, buildModalForBlock, buildUploadModal, colorModal, addBlock, updateFromModal, applyUploadedImage }
