const assert = require('node:assert/strict')
const test = require('node:test')
const {
  buildComponentsV2Embed,
  normalizeButtons,
  normalizeColor,
  normalizeFields,
} = require('../src/components-v2-embed')

const getType = (component) => component.toJSON().type

test('builds a Components V2 container without legacy embeds', () => {
  const components = buildComponentsV2Embed({
    title: 'Server Status',
    description: 'The server is **online**.',
    color: '#5865F2',
    footer: 'Updated just now',
  })

  assert.equal(components.length, 1)
  assert.equal(getType(components[0]), 17) // Container
  assert.ok(components[0].toJSON().components.some((component) => component.type === 10)) // TextDisplay
})

test('supports sections, media galleries, separators and link buttons', () => {
  const components = buildComponentsV2Embed({
    title: 'Minecraft',
    description: 'Welcome!',
    thumbnail: 'https://example.com/thumb.png',
    image: 'https://example.com/banner.png',
    fields: [{ name: 'Players', value: '10/20' }],
    buttons: [{ label: 'Website', url: 'https://example.com' }],
  })

  assert.equal(getType(components[0]), 17)
  assert.equal(getType(components[1]), 1) // ActionRow

  const container = components[0].toJSON()
  assert.ok(container.components.some((component) => component.type === 9)) // Section
  assert.ok(container.components.some((component) => component.type === 12)) // MediaGallery
  assert.ok(container.components.some((component) => component.type === 14)) // Separator
})

test('rejects invalid colors, URLs and malformed field/button data', () => {
  assert.throws(() => normalizeColor('#12345'), /6-digit hexadecimal/)
  assert.throws(() => buildComponentsV2Embed({ description: 'x', image: 'not-a-url' }), /Image URL/)
  assert.throws(() => normalizeFields([{ name: 'Only name' }]), /requires both name and value/)
  assert.throws(() => normalizeButtons([{ label: 'Docs', url: 'javascript:alert(1)' }]), /must start with http/)
})
