const assert = require('node:assert/strict')
const test = require('node:test')
const { reviews } = require('../config')
const { canSubmit, canMarkUseful, canModerate, createReview, toggleUseful, addReport, deleteReview } = require('../src/reviews')

const memberWithRoles = (...roleIds) => ({ roles: { cache: new Map(roleIds.map((id) => [id, {}])) } })
const memberWithPermission = (hasPermission) => ({
  roles: { cache: new Map() },
  permissions: { has: () => hasPermission },
})

test('only configured roles can submit reviews, empty list allows everyone', () => {
  const original = reviews.submitting.allowedRoleIds
  try {
    reviews.submitting.allowedRoleIds = []
    assert.equal(canSubmit(memberWithRoles('any-role')), true)
    assert.equal(canSubmit(undefined), true)

    reviews.submitting.allowedRoleIds = ['review-role']
    assert.equal(canSubmit(memberWithRoles('review-role')), true)
    assert.equal(canSubmit(memberWithRoles('other-role')), false)
    assert.equal(canSubmit(undefined), false)
  } finally {
    reviews.submitting.allowedRoleIds = original
  }
})

test('marking useful respects the enabled flag and allowSelfVote', () => {
  const originalEnabled = reviews.buttons.useful.enabled
  const originalSelf = reviews.buttons.useful.allowSelfVote
  try {
    reviews.buttons.useful.enabled = true
    reviews.buttons.useful.allowSelfVote = true
    assert.equal(canMarkUseful({ id: 'author-id' }, 'author-id'), true)

    reviews.buttons.useful.allowSelfVote = false
    assert.equal(canMarkUseful({ id: 'author-id' }, 'author-id'), false)
    assert.equal(canMarkUseful({ id: 'other-id' }, 'author-id'), true)

    reviews.buttons.useful.enabled = false
    assert.equal(canMarkUseful({ id: 'other-id' }, 'author-id'), false)
  } finally {
    reviews.buttons.useful.enabled = originalEnabled
    reviews.buttons.useful.allowSelfVote = originalSelf
  }
})

test('moderation falls back to Manage Server when no roles/admin bypass are configured', () => {
  const originalRoles = reviews.moderation.allowedRoleIds
  const originalAdmin = reviews.moderation.allowAdministrators
  try {
    reviews.moderation.allowedRoleIds = []
    reviews.moderation.allowAdministrators = false
    assert.equal(canModerate(memberWithPermission(true)), true)
    assert.equal(canModerate(memberWithPermission(false)), false)

    reviews.moderation.allowedRoleIds = ['staff-role']
    assert.equal(canModerate(memberWithRoles('staff-role')), true)
    assert.equal(canModerate(memberWithRoles('other-role')), false)

    reviews.moderation.allowAdministrators = true
    assert.equal(canModerate(memberWithPermission(true)), true)
  } finally {
    reviews.moderation.allowedRoleIds = originalRoles
    reviews.moderation.allowAdministrators = originalAdmin
  }
})

test('toggling useful adds then removes the vote; reporting twice is rejected', () => {
  const record = {
    guildId: 'g',
    channelId: 'c',
    messageId: 'test-review-1',
    threadId: null,
    reviewId: 'abc12345',
    authorId: 'author',
    rating: 5,
    content: 'test review',
    usefulVoters: [],
    reportedBy: [],
    createdAt: Date.now(),
  }

  try {
    createReview('test-review-1', record)

    let result = toggleUseful('test-review-1', 'voter-1')
    assert.equal(result.ok, true)
    assert.deepEqual(result.review.usefulVoters, ['voter-1'])

    result = toggleUseful('test-review-1', 'voter-1')
    assert.deepEqual(result.review.usefulVoters, [])

    let reportResult = addReport('test-review-1', 'reporter-1')
    assert.equal(reportResult.ok, true)
    assert.deepEqual(reportResult.review.reportedBy, ['reporter-1'])

    reportResult = addReport('test-review-1', 'reporter-1')
    assert.equal(reportResult.ok, false)
    assert.equal(reportResult.reason, 'already-reported')
  } finally {
    deleteReview('test-review-1') // Don't leave test data behind in the persisted store.
  }
})
