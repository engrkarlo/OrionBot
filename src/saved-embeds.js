const fs = require('node:fs')
const path = require('node:path')

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'saved-embeds.json')
const MAX_SAVED = 100
const MAX_TRIGGERS = 20

const ensureStore = () => {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]\n', 'utf8')
}

const readStore = () => {
  ensureStore()
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeStore = (records) => {
  ensureStore()
  const temp = `${DATA_FILE}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
  fs.renameSync(temp, DATA_FILE)
}

const makeId = () => `emb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const cleanName = (name) => String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80)
const cleanTrigger = (trigger) => String(trigger || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100)

const listSavedEmbeds = (guildId) => readStore().filter((record) => record.guildId === guildId)
const getSavedEmbed = (guildId, id) => listSavedEmbeds(guildId).find((record) => record.id === id) || null

const createSavedEmbed = ({ guildId, ownerId, name, color, blocks }) => {
  const records = readStore()
  if (records.filter((record) => record.guildId === guildId).length >= MAX_SAVED) throw new Error(`This server has reached the ${MAX_SAVED} saved-message limit.`)
  const cleanedName = cleanName(name)
  if (!cleanedName) throw new Error('Saved message name cannot be empty.')
  if (records.some((record) => record.guildId === guildId && record.name.toLowerCase() === cleanedName.toLowerCase())) throw new Error(`A saved message named **${cleanedName}** already exists.`)
  const now = new Date().toISOString()
  const record = { id: makeId(), guildId, ownerId, name: cleanedName, color: color ?? null, blocks: structuredClone(blocks), triggers: [], createdAt: now, updatedAt: now }
  records.push(record)
  writeStore(records)
  return record
}

const updateSavedEmbed = (guildId, id, patch) => {
  const records = readStore()
  const index = records.findIndex((record) => record.guildId === guildId && record.id === id)
  if (index === -1) throw new Error('That saved message no longer exists.')
  const current = records[index]
  if (patch.name != null) {
    const cleanedName = cleanName(patch.name)
    if (!cleanedName) throw new Error('Saved message name cannot be empty.')
    if (records.some((record, i) => i !== index && record.guildId === guildId && record.name.toLowerCase() === cleanedName.toLowerCase())) throw new Error(`A saved message named **${cleanedName}** already exists.`)
    current.name = cleanedName
  }
  if (patch.color !== undefined) current.color = patch.color
  if (patch.blocks !== undefined) current.blocks = structuredClone(patch.blocks)
  current.updatedAt = new Date().toISOString()
  records[index] = current
  writeStore(records)
  return current
}

const deleteSavedEmbed = (guildId, id) => {
  const records = readStore()
  const next = records.filter((record) => !(record.guildId === guildId && record.id === id))
  if (next.length === records.length) throw new Error('That saved message no longer exists.')
  writeStore(next)
}

const addTrigger = (guildId, id, trigger, channelId) => {
  const records = readStore()
  const record = records.find((item) => item.guildId === guildId && item.id === id)
  if (!record) throw new Error('That saved message no longer exists.')
  const cleanedTrigger = cleanTrigger(trigger)
  if (!cleanedTrigger) throw new Error('Trigger cannot be empty.')
  if (!channelId) throw new Error('A target channel is required.')
  if (records.some((item) => item.guildId === guildId && item.triggers?.some((itemTrigger) => itemTrigger.trigger === cleanedTrigger && itemTrigger.channelId === channelId))) throw new Error('That trigger is already configured for this channel.')
  if ((record.triggers || []).length >= MAX_TRIGGERS) throw new Error(`A saved message can have at most ${MAX_TRIGGERS} triggers.`)
  record.triggers = [...(record.triggers || []), { trigger: cleanedTrigger, channelId }]
  record.updatedAt = new Date().toISOString()
  writeStore(records)
  return record
}

const updateTrigger = (guildId, id, index, trigger) => {
  const records = readStore()
  const record = records.find((item) => item.guildId === guildId && item.id === id)
  if (!record) throw new Error('That saved message no longer exists.')
  const numericIndex = Number(index)
  const triggers = [...(record.triggers || [])]
  if (!Number.isInteger(numericIndex) || !triggers[numericIndex]) throw new Error('That trigger no longer exists.')
  const cleanedTrigger = cleanTrigger(trigger)
  if (!cleanedTrigger) throw new Error('Trigger cannot be empty.')
  const channelId = triggers[numericIndex].channelId
  const duplicate = records.some((item) => item.guildId === guildId && (item.triggers || []).some((itemTrigger, itemIndex) => {
    if (item === record && itemIndex === numericIndex) return false
    return itemTrigger.trigger === cleanedTrigger && itemTrigger.channelId === channelId
  }))
  if (duplicate) throw new Error('That trigger is already configured for this channel.')
  triggers[numericIndex] = { ...triggers[numericIndex], trigger: cleanedTrigger }
  record.triggers = triggers
  record.updatedAt = new Date().toISOString()
  writeStore(records)
  return record
}

const removeTriggerAt = (guildId, id, index) => {
  const records = readStore()
  const record = records.find((item) => item.guildId === guildId && item.id === id)
  if (!record) throw new Error('That saved message no longer exists.')
  const numericIndex = Number(index)
  const triggers = [...(record.triggers || [])]
  if (!Number.isInteger(numericIndex) || !triggers[numericIndex]) throw new Error('That trigger no longer exists.')
  triggers.splice(numericIndex, 1)
  record.triggers = triggers
  record.updatedAt = new Date().toISOString()
  writeStore(records)
  return record
}

const removeTrigger = (guildId, id, trigger, channelId) => {
  const records = readStore()
  const record = records.find((item) => item.guildId === guildId && item.id === id)
  if (!record) throw new Error('That saved message no longer exists.')
  const cleanedTrigger = cleanTrigger(trigger)
  const before = (record.triggers || []).length
  record.triggers = (record.triggers || []).filter((item) => !(item.trigger === cleanedTrigger && (!channelId || item.channelId === channelId)))
  if (record.triggers.length === before) throw new Error('That trigger was not found.')
  record.updatedAt = new Date().toISOString()
  writeStore(records)
  return record
}

const findTriggeredEmbeds = (guildId, channelId, messageContent) => {
  const content = String(messageContent || '').trim().toLowerCase()
  if (!content) return []
  return listSavedEmbeds(guildId).filter((record) => (record.triggers || []).some((item) => item.channelId === channelId && item.trigger === content))
}

module.exports = { DATA_FILE, listSavedEmbeds, getSavedEmbed, createSavedEmbed, updateSavedEmbed, deleteSavedEmbed, addTrigger, updateTrigger, removeTrigger, removeTriggerAt, findTriggeredEmbeds }
