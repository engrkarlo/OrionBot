const assert = require('node:assert/strict')
const test = require('node:test')
const { away } = require('../config')
const { canUseAway } = require('../src/away')

test('only configured roles can use away', () => {
  const originalRoleIds = away.allowedRoleIds
  away.allowedRoleIds = ['away-role']

  try {
    assert.equal(canUseAway({ roles: { cache: new Map([['away-role', {}]]) } }), true)
    assert.equal(canUseAway({ roles: { cache: new Map([['other-role', {}]]) } }), false)
    assert.equal(canUseAway(undefined), false)
  } finally {
    away.allowedRoleIds = originalRoleIds
  }
})
