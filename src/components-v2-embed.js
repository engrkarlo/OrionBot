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

const isHttpUrl = (value) => /^https?:\/\/[^\s]+$/i.test(value)

const normalizeColor = (value) => {
  if (!value) return 0x5865f2
  const normalized = String(value).trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error('Color must be a 6-digit hexadecimal value such as #5865F2.')
  }
  return parseInt(normalized, 16)
}

const validateText = (value, name, maxLength = MAX_TEXT) => {
  if (value == null || value === '') return ''
  const text = String(value)
  if (text.length > maxLength) throw new Error(`${name} cannot exceed ${maxLength} characters.`)
  return text
}

const normalizeFields = (fields) => {
  if (fields == null || fields === '') return []
  if (!Array.isArray(fields)) throw new Error('Fields must be a JSON array.')
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
  if (!Array.isArray(buttons)) throw new Error('Buttons must be a JSON array.')
  if (buttons.length > MAX_BUTTONS) throw new Error(`You can add at most ${MAX_BUTTONS} buttons.`)

  return buttons.map((button, index) => {
    if (!button || typeof button !== 'object') throw new Error(`Button ${index + 1} must be an object.`)
    const label = validateText(button.label, `Button ${index + 1} label`, 80)
    const url = String(button.url || '').trim()
    if (!label || !url) throw new Error(`Button ${index + 1} requires a label and URL.`)
    if (!isHttpUrl(url)) throw new Error(`Button ${index + 1} URL must start with http:// or https://.`)
    return { label, url }
  })
}

/**
 * Builds a Discord Components V2 message from a simple, JSON-friendly definition.
 * No legacy EmbedBuilder is used here: the result is a Container/TextDisplay based message.
 */
const buildComponentsV2Embed = (input = {}) => {
  const title = validateText(input.title, 'Title', 256)
  const description = validateText(input.description, 'Description', MAX_TEXT)
  const footer = validateText(input.footer, 'Footer', 2048)
  const thumbnail = input.thumbnail ? String(input.thumbnail).trim() : ''
  const image = input.image ? String(input.image).trim() : ''

  if (!title && !description && !footer && !input.fields?.length && !thumbnail && !image) {
    throw new Error('At least one piece of content is required.')
  }
  if (thumbnail && !isHttpUrl(thumbnail)) throw new Error('Thumbnail URL must start with http:// or https://.')
  if (image && !isHttpUrl(image)) throw new Error('Image URL must start with http:// or https://.')

  const fields = normalizeFields(input.fields)
  const buttons = normalizeButtons(input.buttons)
  const container = new ContainerBuilder().setAccentColor(normalizeColor(input.color))

  if (thumbnail) {
    const section = new SectionBuilder()
    const textComponents = []
    if (title) textComponents.push(new TextDisplayBuilder().setContent(`## ${title}`))
    if (description) textComponents.push(new TextDisplayBuilder().setContent(description))
    if (textComponents.length === 0) textComponents.push(new TextDisplayBuilder().setContent(' '))
    section.addTextDisplayComponents(...textComponents)
    section.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: thumbnail } }))
    container.addSectionComponents(section)
  } else {
    if (title) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    if (description) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description))
  }

  if (fields.length) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    for (const field of fields) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${field.name}**\n${field.value}`)
      )
    }
  }

  if (image) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image))
    )
  }

  if (footer) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    )
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`))
  }

  const components = [container]
  if (buttons.length) {
    components.push(
      new ActionRowBuilder().addComponents(
        ...buttons.map((button) =>
          new ButtonBuilder().setLabel(button.label).setURL(button.url).setStyle(ButtonStyle.Link)
        )
      )
    )
  }

  return components
}

module.exports = {
  buildComponentsV2Embed,
  isHttpUrl,
  normalizeColor,
  normalizeFields,
  normalizeButtons,
}
