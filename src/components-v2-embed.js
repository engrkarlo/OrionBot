const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require('discord.js')

const MAX_TEXT = 4000
const MAX_FIELDS = 10
const MAX_BUTTONS = 5
const MAX_BLOCKS = 20
const BUTTON_STYLES = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger, link: ButtonStyle.Link }

const isHttpUrl = (value) => /^https?:\/\/[^\s]+$/i.test(String(value || ''))

const normalizeColor = (value) => {
  if (!value) return 0x5865f2
  const normalized = String(value).trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error('Color must be a 6-digit hexadecimal value such as #5865F2.')
  return parseInt(normalized, 16)
}

const normalizeOptionalColor = (value) => {
  if (value == null || String(value).trim() === '' || String(value).trim().toLowerCase() === 'none') return null
  return `#${normalizeColor(value).toString(16).padStart(6, '0')}`
}

const validateText = (value, name, maxLength = MAX_TEXT) => {
  if (value == null || value === '') return ''
  const text = String(value)
  if (text.length > maxLength) throw new Error(`${name} cannot exceed ${maxLength} characters.`)
  return text
}

const normalizeFields = (fields) => {
  if (fields == null || fields === '') return []
  if (!Array.isArray(fields)) throw new Error('Fields must be an array.')
  if (fields.length > MAX_FIELDS) throw new Error(`You can add at most ${MAX_FIELDS} fields.`)
  return fields.map((field, index) => {
    if (!field || typeof field !== 'object') throw new Error(`Field ${index + 1} must be an object.`)
    const name = validateText(field.name, `Field ${index + 1} name`, 256)
    const value = validateText(field.value, `Field ${index + 1} value`, 1024)
    if (!name || !value) throw new Error(`Field ${index + 1} requires both name and value.`)
    return { name, value }
  })
}

const normalizeButtons = (buttons) => {
  if (buttons == null || buttons === '') return []
  if (!Array.isArray(buttons)) throw new Error('Buttons must be an array.')
  if (buttons.length > MAX_BUTTONS) throw new Error(`You can add at most ${MAX_BUTTONS} buttons.`)
  return buttons.map((button, index) => {
    if (!button || typeof button !== 'object') throw new Error(`Button ${index + 1} must be an object.`)
    const label = validateText(button.label, `Button ${index + 1} label`, 80)
    const style = String(button.style || 'link').toLowerCase()
    if (!BUTTON_STYLES[style]) throw new Error(`Button ${index + 1} has an invalid style.`)
    const url = String(button.url || '').trim()
    const response = validateText(button.response, `Button ${index + 1} response`, 2000)
    if (!label) throw new Error(`Button ${index + 1} requires a label.`)
    if (style === 'link' && !isHttpUrl(url)) throw new Error(`Button ${index + 1} URL must start with http:// or https://.`)
    if (style !== 'link' && !response) throw new Error(`Button ${index + 1} needs a response message when using a colored button.`)
    return { label, style, url, response }
  })
}

const normalizeBlocks = (blocks) => {
  if (!Array.isArray(blocks)) throw new Error('Components must be an array.')
  if (blocks.length > MAX_BLOCKS) throw new Error(`You can add at most ${MAX_BLOCKS} components to the builder.`)
  const fields = []
  const buttons = []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') throw new Error('Every component must be an object.')
    if (!['text', 'separator', 'section', 'image', 'field', 'button', 'footer'].includes(block.type)) throw new Error(`Unsupported component type: ${block.type}`)
    if (block.type === 'field') fields.push(block)
    if (block.type === 'button') buttons.push(block)
  }
  if (fields.length > MAX_FIELDS) throw new Error(`You can add at most ${MAX_FIELDS} fields.`)
  if (buttons.length > MAX_BUTTONS) throw new Error(`You can add at most ${MAX_BUTTONS} buttons.`)
  return blocks.map((block) => {
    if (block.type === 'text') return { type: 'text', content: validateText(block.content, 'Text', MAX_TEXT) }
    if (block.type === 'footer') return { type: 'footer', content: validateText(block.content, 'Footer', 2048) }
    if (block.type === 'field') return { type: 'field', ...normalizeFields([block])[0] }
    if (block.type === 'button') return { type: 'button', ...normalizeButtons([block])[0] }
    if (block.type === 'separator') return { type: 'separator', divider: block.divider !== false, spacing: block.spacing === 'large' ? 'large' : 'small' }
    if (block.type === 'section') {
      const content = validateText(block.content, 'Section text', MAX_TEXT)
      const thumbnail = String(block.thumbnail || '').trim()
      const button = block.button && typeof block.button === 'object' ? { ...block.button } : null
      if (!content) throw new Error('Section text cannot be empty.')
      if (thumbnail && !isHttpUrl(thumbnail)) throw new Error('Section thumbnail must use an http:// or https:// URL.')
      if (button) {
        const [normalized] = normalizeButtons([{ ...button, style: 'link' }])
        return { type: 'section', content, thumbnail, button: normalized }
      }
      return { type: 'section', content, thumbnail }
    }
    const url = String(block.url || '').trim()
    if (!isHttpUrl(url)) throw new Error('Image must use an http:// or https:// URL.')
    return { type: 'image', url }
  })
}

const makeButton = (block, customId) => {
  const style = block.style || 'link'
  const builder = new ButtonBuilder().setLabel(block.label).setStyle(BUTTON_STYLES[style])
  if (style === 'link') builder.setURL(block.url)
  else builder.setCustomId(customId)
  return builder
}

const buildComponentsV2Embed = (input = {}) => {
  const blocks = normalizeBlocks(input.blocks || [])
  if (!blocks.length) throw new Error('Add at least one component before sending.')
  const container = new ContainerBuilder()
  const color = normalizeOptionalColor(input.color)
  if (color) container.setAccentColor(normalizeColor(color))
  let index = 0
  while (index < blocks.length) {
    const block = blocks[index]
    if (block.type === 'text') { container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content)); index += 1; continue }
    if (block.type === 'footer') { container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${block.content}`)); index += 1; continue }
    if (block.type === 'separator') {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(block.divider).setSpacing(block.spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small)); index += 1; continue
    }
    if (block.type === 'section') {
      if (!block.thumbnail && !block.button) { container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content)); index += 1; continue }
      const section = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(block.content))
      if (block.thumbnail) section.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: block.thumbnail } }))
      else section.setButtonAccessory(makeButton(block.button, `cv2:section:${Math.random().toString(36).slice(2, 12)}`))
      container.addSectionComponents(section); index += 1; continue
    }
    if (block.type === 'image') {
      const gallery = new MediaGalleryBuilder()
      while (index < blocks.length && blocks[index].type === 'image') { gallery.addItems(new MediaGalleryItemBuilder().setURL(blocks[index].url)); index += 1 }
      container.addMediaGalleryComponents(gallery); continue
    }
    if (block.type === 'field') {
      const fieldParts = []
      while (index < blocks.length && blocks[index].type === 'field') { fieldParts.push(`**${blocks[index].name}**\n${blocks[index].value}`); index += 1 }
      const fieldText = fieldParts.join('\n\n')
      if (fieldText.length > MAX_TEXT) throw new Error(`Combined field content cannot exceed ${MAX_TEXT} characters.`)
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(fieldText)); continue
    }
    if (block.type === 'button') {
      const row = new ActionRowBuilder()
      while (index < blocks.length && blocks[index].type === 'button' && row.components.length < MAX_BUTTONS) {
        const current = blocks[index]
        row.addComponents(makeButton(current, `cv2:button:${Math.random().toString(36).slice(2, 12)}`))
        index += 1
      }
      container.addActionRowComponents(row); continue
    }
    index += 1
  }
  if (container.components.length > 10) throw new Error('This layout creates more than Discord allows inside one container. Remove or combine some components.')
  return [container]
}

module.exports = { buildComponentsV2Embed, isHttpUrl, normalizeColor, normalizeOptionalColor, normalizeFields, normalizeButtons, normalizeBlocks }
