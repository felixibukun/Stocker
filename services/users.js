const fs = require('fs')
const path = require('path')

const usersPath = path.join(__dirname, '..', 'database', 'users.json')

function loadUsers() {
  try {
    if (!fs.existsSync(usersPath)) {
      fs.writeFileSync(usersPath, JSON.stringify([], null, 2))
      return []
    }

    const data = fs.readFileSync(usersPath, 'utf8')
    if (!data.trim()) return []

    const users = JSON.parse(data)
    return Array.isArray(users) ? users : []
  } catch (err) {
    console.error('LOAD USERS ERROR:', err)
    return []
  }
}

function saveUsers(data) {
  try {
    const backupPath = usersPath + '.backup'

    if (fs.existsSync(usersPath)) {
      fs.copyFileSync(usersPath, backupPath)
    }

    if (!Array.isArray(data)) {
      data = []
    }

    fs.writeFileSync(usersPath, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error('Save users failed:', e)
    return false
  }
}

function ensureSignalLevel() {
  const users = loadUsers()
  let changed = false

  users.forEach(user => {
    if (typeof user.signalLevel !== 'number') {
      user.signalLevel = 100
      changed = true
    }
  })

  if (changed) saveUsers(users)
}

function recalcUserBalance(user) {
  user.deposit = Number(user.deposit || 0)
  user.profit = Number(user.profit || 0)
  user.bonus = Number(user.bonus || 0)
  user.balance = user.deposit + user.profit + user.bonus
}

function userCreatedTime(user) {
  const createdAtTime = Date.parse(user?.createdAt)
  if (!Number.isNaN(createdAtTime)) return createdAtTime

  const idTime = Number(user?.id)
  return Number.isFinite(idTime) ? idTime : 0
}

function sortUsersNewestFirst(users) {
  return [...users].sort((a, b) => userCreatedTime(b) - userCreatedTime(a))
}

module.exports = {
  ensureSignalLevel,
  loadUsers,
  recalcUserBalance,
  saveUsers,
  sortUsersNewestFirst
}
