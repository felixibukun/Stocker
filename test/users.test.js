const assert = require('node:assert/strict')
const test = require('node:test')

const { sortUsersNewestFirst } = require('../services/users')

test('sortUsersNewestFirst orders newest users first', () => {
  const oldest = { id: 1000, username: 'oldest' }
  const newestById = { id: 3000, username: 'newest-by-id' }
  const newestByCreatedAt = {
    id: 2000,
    username: 'newest-by-created-at',
    createdAt: '2026-08-30T12:00:00.000Z'
  }

  const users = [oldest, newestById, newestByCreatedAt]
  const sorted = sortUsersNewestFirst(users)

  assert.deepEqual(sorted.map(user => user.username), [
    'newest-by-created-at',
    'newest-by-id',
    'oldest'
  ])
  assert.deepEqual(users.map(user => user.username), [
    'oldest',
    'newest-by-id',
    'newest-by-created-at'
  ])
})
