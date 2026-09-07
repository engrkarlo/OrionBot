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
const { buildComponentsV2Embed, isHttpUrl, normalizeColor, normalizeOptionalColor } = require('./components-v2-embed')
const { createSavedEmbed, updateSavedEmbed, getSavedEmbed } = require('./saved-embeds')

const sessions = new Map()
const SESSION_TTL = 30 * 60 * 1000

const makeSessionId = (userId) => `${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const createSession = (userId, channelId, saved = null) => {
  const id = makeSessionId(userId)
  const session = {
    id,
    userId,
    guildId: saved?.guildId || null,
    channelId,
    savedEmbedId: saved?.id || null,
    name: saved?.name || '',
    color: saved?.color ?? null,
    blocks: saved?.blocks ? structuredClone(saved.blocks) : [
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
  const container = new ContainerBuilder().setAccentColor(0x5865f2)
  const selected = session.blocks[session.selected]
  const colorLabel = session.color ? session.color.toUpperCase() : 'None'
  const savedLabel = session.savedEmbedId ? `Saved as **${session.name || 'Unnamed'}**` : 'Not saved yet'

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `## ✦ Components V2 Builder\n\n**${builderSummary(session)}**\nSelected: **${selected ? componentLabel(selected, session.selected) : 'None'}**\nAccent: **${colorLabel}** • ${savedLabel}\n\nBuild the layout visually. Sections can use thumbnails or buttons, images use Discord's native file picker, and colored buttons use Discord's built-in button styles.`
  ))

  const blockOptions = session.blocks.length
    ? session.blocks.slice(0, 25).map((block, index) => ({ label: componentLabel(block, index), value: String(index), default: index === session.selected }))
    : [{ label: 'No components yet', value: 'none' }]

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`eb:${session.id}:select`).setPlaceholder('Select a component').addOptions(blockOptions)
  ))

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`eb:${session.id}:edit`).setLabel('Edit').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:color`).setLabel('Accent').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:up`).setLabel('Move Up').setStyle(ButtonStyle.Secondary).setDisabled(session.selected <= 0),
    new ButtonBuilder().setCustomId(`eb:${session.id}:down`).setLabel('Move Down').setStyle(ButtonStyle.Secondary).setDisabled(session.selected >= session.blocks.length - 1),
    new ButtonBuilder().setCustomId(`eb:${session.id}:delete`).setLabel('Delete').setStyle(ButtonStyle.Danger),
  ))

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`eb:${session.id}:add`).setPlaceholder('＋ Add a component').addOptions(
      { label: 'Text Display', value: 'text', description: 'Rich Markdown text.' },
      { label: 'Separator', value: 'separator', description: 'Divider or spacing.' },
      { label: 'Section', value: 'section', description: 'Text with a thumbnail or button accessory.' },
      { label: 'Image / Gallery', value: 'image', description: 'Images are grouped into a gallery.' },
      { label: 'Field', value: 'field', description: 'Convenient name/value information block.' },
      { label: 'Button', value: 'button', description: 'Link or colored interactive button.' },
      { label: 'Footer', value: 'footer', description: 'Small footer-style text.' },
    )
  ))

  container.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`eb:${session.id}:preview`).setLabel(session.preview ? 'Hide Preview' : 'Preview').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:upload`).setLabel('Add Image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:save`).setLabel(session.savedEmbedId ? 'Save Changes' : 'Save').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`eb:${session.id}:send`).setLabel('Send Here').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`eb:${session.id}:close`).setLabel('Close').setStyle(ButtonStyle.Danger),
  ))

  return [container]
}

const buildReplyComponents = (session) => {
  const editor = buildEditorComponents(session)
  if (!session.preview) return editor
  try {
    const preview = buildComponentsV2Embed({ blocks: session.blocks, color: session.color, sourceId: session.savedEmbedId || `session-${session.id}` })[0]
    return [preview, ...editor]
  } catch (error) {
    const message = new ContainerBuilder().setAccentColor(0xed4245).addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### Preview unavailable\n\n${error.message}`)
    )
    return [message, ...editor]
  }
}

const textInput = (id, label, value, style = TextInputStyle.Short, required = true, maxLength) => {
  const builder = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required)
  if (value != null) builder.setValue(String(value).slice(0, 4000))
  if (maxLength) builder.setMaxLength(maxLength)
  return new ActionRowBuilder().addComponents(builder)
}

const buildModalForBlock = (session) => {
  const block = session.blocks[session.selected]
  if (!block) return null
  const modal = new ModalBuilder().setCustomId(`eb:${session.id}:modal:${session.selected}:${block.type}`).setTitle(`Edit ${componentLabel(block, session.selected).replace(/^\d+\. /, '')}`)
  if (block.type === 'text') modal.addComponents(textInput('content', 'Text / Markdown', block.content, TextInputStyle.Paragraph, true, 4000))
  else if (block.type === 'section') {
    modal.addComponents(
      textInput('content', 'Section text / Markdown', block.content, TextInputStyle.Paragraph, true, 4000),
      textInput('thumbnail', 'Thumbnail URL (optional)', block.thumbnail || '', TextInputStyle.Short, false, 2000),
      textInput('button_label', 'Button label (optional)', block.button?.label || '', TextInputStyle.Short, false, 80),
      textInput('button_url', 'Button URL (optional)', block.button?.url || '', TextInputStyle.Short, false, 512),
    )
  } else if (block.type === 'image') modal.addComponents(textInput('url', 'Image URL (optional if you upload)', block.url || '', TextInputStyle.Short, false, 2000))
  else if (block.type === 'field') modal.addComponents(textInput('name', 'Field name', block.name, TextInputStyle.Short, true, 256), textInput('value', 'Field value', block.value, TextInputStyle.Paragraph, true, 1024))
  else if (block.type === 'button') modal.addComponents(
    textInput('label', 'Button label', block.label, TextInputStyle.Short, true, 80),
    textInput('style', 'Style: link, primary, secondary, success or danger', block.style || 'link', TextInputStyle.Short, true, 9),
    textInput('url', 'URL (required for link buttons)', block.url || '', TextInputStyle.Short, false, 512),
    textInput('response', 'Response for colored buttons', block.response || '', TextInputStyle.Paragraph, false, 2000),
  )
  else if (block.type === 'footer') modal.addComponents(textInput('content', 'Footer text', block.content, TextInputStyle.Short, true, 2048))
  else if (block.type === 'separator') modal.addComponents(textInput('divider', 'Show divider? (true or false)', block.divider !== false ? 'true' : 'false', TextInputStyle.Short, true, 5), textInput('spacing', 'Spacing (small or large)', block.spacing === 'large' ? 'large' : 'small', TextInputStyle.Short, true, 6))
  return modal
}

const buildUploadModal = (session) => {
  const block = session.blocks[session.selected]
  if (!block || !['image', 'section'].includes(block.type)) return null
  const kind = block.type === 'section' ? 'thumbnail' : 'image'
  const upload = new FileUploadBuilder({ custom_id: 'file', min_values: 1, max_values: 1, required: true, file_types: ['.png', '.jpg', '.jpeg', '.gif', '.webp'] })
  const label = new LabelBuilder().setLabel(block.type === 'section' ? 'Choose a thumbnail image' : 'Choose an image').setDescription('Pick an image from your computer.').setFileUploadComponent(upload)
  return new ModalBuilder().setCustomId(`eb:${session.id}:modal-upload:${session.selected}:${kind}`).setTitle(block.type === 'section' ? 'Upload Thumbnail' : 'Upload Image').addLabelComponents(label)
}

const addBlock = (session, type) => {
  const defaults = {
    text: { type: 'text', content: 'New text' },
    separator: { type: 'separator', divider: true, spacing: 'small' },
    section: { type: 'section', content: 'Section text', thumbnail: '' },
    image: { type: 'image', url: '' },
    field: { type: 'field', name: 'Field name', value: 'Field value' },
    button: { type: 'button', label: 'Website', style: 'link', url: 'https://example.com', response: '' },
    footer: { type: 'footer', content: 'Footer text' },
  }
  if (!defaults[type]) throw new Error('Unknown component type.')
  if (session.blocks.length >= 20) throw new Error('The builder supports up to 20 components. Remove or combine some before adding more.')
  session.blocks.push(structuredClone(defaults[type]))
  session.selected = session.blocks.length - 1
}

const updateFromModal = (session, interaction) => {
  const blockIndex = session.selected
  const block = session.blocks[blockIndex]
  if (!block) throw new Error('That component no longer exists.')
  const get = (id) => interaction.fields.getTextInputValue(id)
  if (block.type === 'text') block.content = get('content')
  else if (block.type === 'section') {
    block.content = get('content')
    block.thumbnail = get('thumbnail').trim()
    const buttonLabel = get('button_label').trim()
    const buttonUrl = get('button_url').trim()
    if (block.thumbnail && !isHttpUrl(block.thumbnail)) throw new Error('Thumbnail URL must start with http:// or https://.')
    block.button = buttonLabel ? { label: buttonLabel, style: 'link', url: buttonUrl, response: '' } : null
    if (buttonLabel && !isHttpUrl(buttonUrl)) throw new Error('Section button URL must start with http:// or https://.')
    if (block.thumbnail && block.button) throw new Error('A Section can have either a thumbnail or a button, not both.')
  } else if (block.type === 'image') {
    const url = get('url').trim()
    if (url && !isHttpUrl(url)) throw new Error('Image URL must start with http:// or https://.')
    block.url = url
  } else if (block.type === 'field') {
    block.name = get('name')
    block.value = get('value')
  } else if (block.type === 'button') {
    const style = get('style').trim().toLowerCase()
    const label = get('label').trim()
    const url = get('url').trim()
    const response = get('response').trim()
    if (!['link', 'primary', 'secondary', 'success', 'danger'].includes(style)) throw new Error('Button style must be link, primary, secondary, success or danger.')
    if (!label) throw new Error('Button label cannot be empty.')
    if (style === 'link' && !isHttpUrl(url)) throw new Error('Link buttons need a valid http:// or https:// URL.')
    if (style !== 'link' && !response) throw new Error('Colored buttons need a response message.')
    block.label = label
    block.style = style
    block.url = style === 'link' ? url : ''
    block.response = style === 'link' ? '' : response
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

const colorModal = (session) => new ModalBuilder().setCustomId(`eb:${session.id}:modal-color`).setTitle('Container accent color').addComponents(
  textInput('color', 'Hex color or none', session.color || 'none', TextInputStyle.Short, true, 7)
)

const saveModal = (session) => new ModalBuilder().setCustomId(`eb:${session.id}:modal-save`).setTitle(session.savedEmbedId ? 'Save Changes' : 'Save Components V2 Message').addComponents(
  textInput('name', 'Saved message name', session.name || 'My message', TextInputStyle.Short, true, 80)
)

const saveSession = (session, guildId, name) => {
  if (!guildId) throw new Error('Saved messages can only be created inside a server.')
  const color = normalizeOptionalColor(session.color)
  if (session.savedEmbedId) {
    const saved = updateSavedEmbed(guildId, session.savedEmbedId, { name, color, blocks: session.blocks })
    session.name = saved.name
    session.color = saved.color
    return saved
  }
  const saved = createSavedEmbed({ guildId, ownerId: session.userId, name, color, blocks: session.blocks })
  session.savedEmbedId = saved.id
  session.guildId = guildId
  session.name = saved.name
  session.color = saved.color
  return saved
}

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

const refreshSavedSession = (session) => {
  if (!session.savedEmbedId || !session.guildId) return null
  const saved = getSavedEmbed(session.guildId, session.savedEmbedId)
  if (!saved) return null
  session.name = saved.name
  session.color = saved.color
  session.blocks = structuredClone(saved.blocks)
  session.selected = Math.min(session.selected, Math.max(0, session.blocks.length - 1))
  return saved
}

module.exports = { sessions, createSession, getSession, deleteSession, buildEditorComponents, buildReplyComponents, buildModalForBlock, buildUploadModal, colorModal, saveModal, saveSession, addBlock, updateFromModal, applyUploadedImage, refreshSavedSession }
