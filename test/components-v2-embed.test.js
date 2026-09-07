const assert = require('node:assert/strict')
const test = require('node:test')
const {
  buildComponentsV2Embed,
  normalizeBlocks,
  normalizeButtons,
  normalizeColor,
  normalizeFields,
} = require('../src/components-v2-embed')

const getType = (component) => component.toJSON().type

test('builds a configurable Components V2 container', () => {
  const components = buildComponentsV2Embed({
    color: '#ff00aa',
    blocks: [
      { type: 'text', content: '## Server Status\n\nThe server is **online**.' },
      { type: 'separator', divider: true, spacing: 'large' },
      { type: 'section', content: 'Useful links', thumbnail: 'https://example.com/thumb.png' },
      { type: 'field', name: 'Players', value: '10/20' },
      { type: 'button', label: 'Website', url: 'https://example.com' },
      { type: 'footer', content: 'Updated just now' },
    ],
  })

  assert.equal(components.length, 1)
  const container = components[0].toJSON()
  assert.equal(getType(components[0]), 17)
  assert.equal(container.accent_color, 0xff00aa)
  assert.ok(container.components.some((component) => component.type === 9))
  assert.ok(container.components.some((component) => component.type === 14))
  assert.ok(container.components.some((component) => component.type === 1))
})

test('keeps buttons inside the container and preserves their layout position', () => {
  const components = buildComponentsV2Embed({
    blocks: [
      { type: 'text', content: 'Top' },
      { type: 'button', label: 'One', url: 'https://example.com/1' },
      { type: 'button', label: 'Two', url: 'https://example.com/2' },
      { type: 'separator', divider: true, spacing: 'small' },
      { type: 'text', content: 'Bottom' },
    ],
  })

  const container = components[0].toJSON()
  const buttonRow = container.components.find((component) => component.type === 1)
  assert.ok(buttonRow)
  assert.equal(buttonRow.components.length, 2)
  assert.equal(container.components[1].type, 1)
  assert.equal(container.components[2].type, 14)
})

test('groups consecutive fields, images and buttons while respecting container limits', () => {
  const blocks = [
    ...Array.from({ length: 10 }, (_, index) => ({ type: 'field', name: `Field ${index + 1}`, value: 'Value' })),
    ...Array.from({ length: 3 }, (_, index) => ({ type: 'button', label: `Button ${index + 1}`, url: `https://example.com/${index + 1}` })),
    { type: 'image', url: 'https://example.com/a.png' },
    { type: 'image', url: 'https://example.com/b.png' },
  ]

  const components = buildComponentsV2Embed({ blocks })
  const container = components[0].toJSON()
  assert.ok(container.components.length <= 10)
  assert.equal(container.components.filter((component) => component.type === 1).length, 1)
  assert.equal(container.components.filter((component) => component.type === 12).length, 1)
  assert.equal(container.components.filter((component) => component.type === 10).length, 1)
})

test('validates colors, fields, buttons and component types', () => {
  assert.throws(() => normalizeColor('#12345'), /6-digit hexadecimal/)
  assert.throws(() => normalizeFields([{ name: 'Only name' }]), /requires both name and value/)
  assert.throws(() => normalizeButtons([{ label: 'Docs', url: 'javascript:alert(1)' }]), /must start with http/)
  assert.throws(() => normalizeBlocks([{ type: 'unknown' }]), /Unsupported component type/)
  assert.throws(() => buildComponentsV2Embed({ blocks: [{ type: 'image', url: 'not-a-url' }] }), /Image must use/)
  assert.throws(() => buildComponentsV2Embed({ blocks: [{ type: 'field', name: 'x', value: 'a'.repeat(5000) }] }), /Combined field content/)
})
