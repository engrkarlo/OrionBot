const assert = require('node:assert/strict')
const test = require('node:test')
const { suggestions } = require('../config')
const { canSubmit, canVote, canModerate, createSuggestion, toggleVote, deleteSuggestion } = require('../src/suggestions')

const memberWithRoles = (...roleIds) => ({ roles: { cache: new Map(roleIds.map((id) => [id, {}])) } })
const memberWithPermission = (hasPermission) => ({
  roles: { cache: new Map() },
  permissions: { has: () => hasPermission },
})

test('only configured roles can submit suggestions, empty list allows everyone', () => {
  const original = suggestions.submitting.allowedRoleIds
  try {
    suggestions.submitting.allowedRoleIds = []
    assert.equal(canSubmit(memberWithRoles('any-role')), true)
    assert.equal(canSubmit(undefined), true)

    suggestions.submitting.allowedRoleIds = ['suggest-role']
    assert.equal(canSubmit(memberWithRoles('suggest-role')), true)
    assert.equal(canSubmit(memberWithRoles('other-role')), false)
    assert.equal(canSubmit(undefined), false)
  } finally {
    suggestions.submitting.allowedRoleIds = original
  }
})

test('voting respects allowedRoleIds and allowSelfVote', () => {
  const originalRoles = suggestions.voting.allowedRoleIds
  const originalSelf = suggestions.voting.allowSelfVote
  const originalEnabled = suggestions.voting.enabled
  try {
    suggestions.voting.enabled = true
    suggestions.voting.allowedRoleIds = []
    suggestions.voting.allowSelfVote = true
    assert.equal(canVote(memberWithRoles('any-role'), 'submitter-id'), true)

    suggestions.voting.allowSelfVote = false
    assert.equal(canVote({ id: 'submitter-id', roles: { cache: new Map() } }, 'submitter-id'), false)
    assert.equal(canVote({ id: 'other-id', roles: { cache: new Map() } }, 'submitter-id'), true)

    suggestions.voting.allowedRoleIds = ['voter-role']
    suggestions.voting.allowSelfVote = true
    assert.equal(canVote(memberWithRoles('voter-role'), 'submitter-id'), true)
    assert.equal(canVote(memberWithRoles('other-role'), 'submitter-id'), false)

    suggestions.voting.enabled = false
    assert.equal(canVote(memberWithRoles('voter-role'), 'submitter-id'), false)
  } finally {
    suggestions.voting.allowedRoleIds = originalRoles
    suggestions.voting.allowSelfVote = originalSelf
    suggestions.voting.enabled = originalEnabled
  }
})

test('moderation falls back to Manage Server when no roles/admin bypass are configured', () => {
  const originalRoles = suggestions.moderation.allowedRoleIds
  const originalAdmin = suggestions.moderation.allowAdministrators
  try {
    suggestions.moderation.allowedRoleIds = []
    suggestions.moderation.allowAdministrators = false
    assert.equal(canModerate(memberWithPermission(true)), true)
    assert.equal(canModerate(memberWithPermission(false)), false)

    suggestions.moderation.allowedRoleIds = ['staff-role']
    assert.equal(canModerate(memberWithRoles('staff-role')), true)
    assert.equal(canModerate(memberWithRoles('other-role')), false)

    suggestions.moderation.allowAdministrators = true
    assert.equal(canModerate(memberWithPermission(true)), true)
  } finally {
    suggestions.moderation.allowedRoleIds = originalRoles
    suggestions.moderation.allowAdministrators = originalAdmin
  }
})

test('toggling the same vote removes it, opposite vote switches it', () => {
  const originalAllowChange = suggestions.voting.allowVoteChange
  try {
    suggestions.voting.allowVoteChange = true
    const record = {
      guildId: 'g',
      channelId: 'c',
      messageId: 'test-message-1',
      threadId: null,
      authorId: 'author',
      content: 'test',
      status: 'pending',
      upvoters: [],
      downvoters: [],
      createdAt: Date.now(),
      resolvedBy: null,
      resolvedAt: null,
    }
    createSuggestion('test-message-1', record)

    let result = toggleVote('test-message-1', 'voter-1', 'up')
    assert.equal(result.ok, true)
    assert.deepEqual(result.suggestion.upvoters, ['voter-1'])

    result = toggleVote('test-message-1', 'voter-1', 'up')
    assert.deepEqual(result.suggestion.upvoters, [])

    toggleVote('test-message-1', 'voter-1', 'up')
    result = toggleVote('test-message-1', 'voter-1', 'down')
    assert.deepEqual(result.suggestion.upvoters, [])
    assert.deepEqual(result.suggestion.downvoters, ['voter-1'])

    suggestions.voting.allowVoteChange = false
    result = toggleVote('test-message-1', 'voter-1', 'up')
    assert.equal(result.ok, false)
  } finally {
    suggestions.voting.allowVoteChange = originalAllowChange
    deleteSuggestion('test-message-1') // Don't leave test data behind in the persisted store.
  }
})
