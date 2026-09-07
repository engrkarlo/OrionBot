const assert = require('node:assert/strict')
const test = require('node:test')
const { buildComponentsV2Embed, buildComponentsV2Payload, normalizeBlocks, normalizeButtons, normalizeColor, normalizeFields } = require('../src/components-v2-embed')

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
  const container = components[0].toJSON()
  assert.equal(components.length, 1)
  assert.equal(getType(components[0]), 17)
  assert.equal(container.accent_color, 0xff00aa)
  assert.ok(container.components.some((component) => component.type === 9))
  assert.ok(container.components.some((component) => component.type === 14))
  assert.ok(container.components.some((component) => component.type === 1))
})

test('supports a container without an accent color', () => {
  const container = buildComponentsV2Embed({ color: 'none', blocks: [{ type: 'text', content: 'No accent here.' }] })[0].toJSON()
  assert.equal(container.accent_color, undefined)
})

test('keeps buttons inside the container and preserves their layout position', () => {
  const container = buildComponentsV2Embed({ blocks: [
    { type: 'text', content: 'Top' },
    { type: 'button', label: 'One', url: 'https://example.com/1' },
    { type: 'button', label: 'Two', url: 'https://example.com/2' },
    { type: 'separator', divider: true, spacing: 'small' },
    { type: 'text', content: 'Bottom' },
  ] })[0].toJSON()
  const buttonRow = container.components.find((component) => component.type === 1)
  assert.ok(buttonRow)
  assert.equal(buttonRow.components.length, 2)
  assert.equal(container.components[1].type, 1)
  assert.equal(container.components[2].type, 14)
})

test('supports colored interactive buttons and V2 file components', () => {
  const payload = buildComponentsV2Payload({ blocks: [
    { type: 'button', label: 'Open', style: 'primary', response: 'Opened.' },
    { type: 'file', url: 'https://example.com/guide.pdf', spoiler: true },
    { type: 'section', content: 'Action', button: { label: 'Go', style: 'success', response: 'Done.' } },
  ] })
  const container = payload.components[0].toJSON()
  const row = container.components.find((component) => component.type === 1)
  assert.equal(row.components[0].style, 1)
  const file = container.components.find((component) => component.type === 13)
  assert.equal(file.file.url, 'attachment://guide.pdf')
  assert.deepEqual(payload.files, [{ attachment: 'https://example.com/guide.pdf', name: 'guide.pdf' }])
  const section = container.components.find((component) => component.type === 9)
  assert.equal(section.accessory.style, 3)
})

test('groups consecutive fields, images and buttons while respecting container limits', () => {
  const blocks = [
    ...Array.from({ length: 10 }, (_, index) => ({ type: 'field', name: `Field ${index + 1}`, value: 'Value' })),
    ...Array.from({ length: 3 }, (_, index) => ({ type: 'button', label: `Button ${index + 1}`, url: `https://example.com/${index + 1}` })),
    { type: 'image', url: 'https://example.com/a.png' },
    { type: 'image', url: 'https://example.com/b.png' },
  ]
  const container = buildComponentsV2Embed({ blocks })[0].toJSON()
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
  assert.throws(() => buildComponentsV2Embed({ blocks: [{ type: 'file', url: 'not-a-url' }] }), /File URL must/)
  assert.throws(() => buildComponentsV2Embed({ blocks: [{ type: 'button', label: 'Bad', style: 'primary' }] }), /needs a response/)

  const oversizedFields = Array.from({ length: 5 }, (_, index) => ({ type: 'field', name: `Field ${index + 1}`, value: 'a'.repeat(900) }))
  assert.throws(() => buildComponentsV2Embed({ blocks: oversizedFields }), /Combined field content/)
})
