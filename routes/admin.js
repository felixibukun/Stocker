const express = require('express')

module.exports = function createRoutes(deps) {
  const router = express.Router()
  const { BCRYPT_ROUNDS, adminLimit, bcrypt, fs, getClientIp, loadJson, loadUsers, logAdminAction, recalcUserBalance, saveJson, saveUsers, setToast } = deps

/* ===========================
ADMIN SECTION
=========================== */
function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.redirect('/admin-login')
  }
  next()
}

router.get('/admin-login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin')
  res.render('admin/login')
})

router.post('/admin-login', adminLimit, async (req, res) => {
  try {
    const { username, password } = req.body

    const users = loadUsers()
    const adminUser = users.find(u => u.role === 'admin' && u.username === username)

    if (!adminUser) {
      logAdminAction(req, 'failed_admin_login', { username, ip: getClientIp(req) })
      setToast(req, 'error', 'Invalid login')
      return res.redirect('/admin-login')
    }

    // Check if admin user has a password
    if (!adminUser.password) {
      // First time login - set the password
      if (password) {
        adminUser.password = await bcrypt.hash(password, BCRYPT_ROUNDS)
        saveUsers(users)
      } else {
        setToast(req, 'error', 'Please set a password')
        return res.redirect('/admin-login')
      }
    } else {
      // Verify existing password (supports both plain text and bcrypt)
      let passwordValid = false
      
      if (adminUser.password === password) {
        passwordValid = true
        adminUser.password = await bcrypt.hash(password, BCRYPT_ROUNDS)
        saveUsers(users)
      } else {
        try {
          passwordValid = await bcrypt.compare(password, adminUser.password)
        } catch (err) {
          passwordValid = false
        }
      }
      
      if (!passwordValid) {
        logAdminAction(req, 'failed_admin_login', { username, ip: getClientIp(req) })
        setToast(req, 'error', 'Invalid login')
        return res.redirect('/admin-login')
      }
    }

    req.session.admin = {
      id: adminUser.id,
      username: adminUser.username
    }

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err)
        setToast(req, 'error', 'Login error')
        return res.redirect('/admin-login')
      }

      logAdminAction(req, 'admin_login_success', { username: adminUser.username })
      setToast(req, 'success', 'Admin login successful')
      res.redirect('/admin')
    })

  } catch (e) {
    console.error("ADMIN LOGIN ERROR:", e)
    setToast(req, 'error', 'Admin login error')
    res.redirect('/admin-login')
  }
})

router.get('/admin-logout', (req, res) => {
  logAdminAction(req, 'admin_logout', { username: req.session.admin?.username })
  req.session.destroy((err) => {
    if (err) {
      console.error('Admin logout error:', err)
    }
    res.redirect('/admin-login')
  })
})

router.get('/admin', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
  .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))

const withdrawals = loadJson('./database/withdrawals.json', [])
  .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))

const deposits = loadJson('./database/deposits.json', [])
  .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))

const kycRequests = loadJson('./database/kyc.json', [])
  .sort((a, b) => new Date(b.createdAt || b.reviewedAt || 0) - new Date(a.createdAt || a.reviewedAt || 0))

    // Calculate stats
    const totalUsers = users.length
    const totalBalance = users.reduce((sum, user) => sum + (Number(user.balance) || 0), 0)
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length
    const pendingDeposits = deposits.filter(d => d.status === 'pending').length
    const pendingKyc = kycRequests.filter(k => k.status === 'pending').length

    res.render('admin/dashboard', {
      admin: req.session.admin,
      users,
      withdrawals,
      deposits,
      kycRequests,
      stats: {
        totalUsers,
        totalBalance: totalBalance.toFixed(2),
        pendingWithdrawals,
        pendingDeposits,
        pendingKyc
      }
    })

  } catch (error) {
    console.error('Admin dashboard error:', error)
    setToast(req, 'error', 'Error loading admin dashboard')
    res.redirect('/admin-login')
  }
})

router.get('/admin/users', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    res.render('admin/users', { admin: req.session.admin, users })
  } catch (error) {
    setToast(req, 'error', 'Error loading users')
    res.redirect('/admin')
  }
})

router.post('/admin/user/:id/login', requireAdmin, (req, res) => {
  const users = loadUsers()
  const user = users.find(u => u.id == req.params.id)

  if (!user) {
    setToast(req, 'error', 'User not found')
    return res.redirect('/admin/users')
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email
  }

  req.session.save(() => {
    res.redirect('/dashboard')
  })
})

router.post('/admin/return', requireAdmin, (req, res) => {
  delete req.session.user

  req.session.save(() => {
    res.redirect('/admin')
  })
})


router.get('/admin/user/:id/balance', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
    const user = users.find(u => u.id == req.params.id)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/users')
    }

    res.render('admin/edit-balance', { admin: req.session.admin, user })

  } catch (error) {
    setToast(req, 'error', 'Error loading user')
    res.redirect('/admin/users')
  }
})

router.post('/admin/user/:id/balance', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
    const user = users.find(u => u.id == req.params.id)

    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/users')
    }

    const { balance, profit, bonus, deposit } = req.body

    // If admin enters TOTAL balance, convert it properly
    if (balance && !deposit && !profit && !bonus) {
      const newBalance = Number(balance || 0)

      user.deposit = newBalance
      user.profit = 0
      user.bonus = 0
    } else {
      // Normal manual edit
      user.deposit = Number(deposit || 0)
      user.profit = Number(profit || 0)
      user.bonus = Number(bonus || 0)
    }

    recalcUserBalance(user)
    saveUsers(users)

    logAdminAction(req, 'edit_balance', {
      userId: user.id,
      balance: user.balance,
      profit: user.profit,
      bonus: user.bonus,
      deposit: user.deposit
    })

    setToast(req, 'success', 'User balances updated')
    res.redirect('/admin/users')

  } catch (error) {
    setToast(req, 'error', 'Error updating user balance')
    res.redirect('/admin/users')
  }
})

router.post('/admin/user/:id/delete', requireAdmin, (req, res) => {
  try {
    const userId = Number(req.params.id)

    let users = loadUsers()
    const userExists = users.some(u => u.id == userId)
    if (!userExists) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/users')
    }

    users = users.filter(u => u.id != userId)
    saveUsers(users)

    const holdings = loadJson('./database/holdings.json', [])
    const trades = loadJson('./database/trades.json', [])
    const withdrawals = loadJson('./database/withdrawals.json', [])
    const deposits = loadJson('./database/deposits.json', [])
    const following = loadJson('./database/following.json', [])

    const newHoldings = holdings.filter(h => h.userId != userId)
    const newTrades = trades.filter(t => t.userId != userId)
    const newWithdrawals = withdrawals.filter(w => w.userId != userId)
    const newDeposits = deposits.filter(d => d.userId != userId)
    const newFollowing = following.filter(f => f.userId != userId)

    saveJson('./database/holdings.json', newHoldings)
    saveJson('./database/trades.json', newTrades)
    saveJson('./database/withdrawals.json', newWithdrawals)
    saveJson('./database/deposits.json', newDeposits)
    saveJson('./database/following.json', newFollowing)

    logAdminAction(req, 'delete_user', {
      userId
    })

    setToast(req, 'success', 'User and related data deleted')
    res.redirect('/admin/users')

  } catch (error) {
    setToast(req, 'error', 'Error deleting user')
    res.redirect('/admin/users')
  }
})

router.post('/admin/user/:id/signal', requireAdmin, (req, res) => {
  const users = loadUsers()
  .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  const user = users.find(u => u.id == req.params.id)

  if (!user) {
    setToast(req, 'error', 'User not found')
    return res.redirect('/admin/users')
  }

 user.signalLevel = Number(user.signalLevel)
if (isNaN(user.signalLevel)) user.signalLevel = 100

if (req.body.action === 'increase') {
  user.signalLevel = Math.min(100, user.signalLevel + 10)
}

if (req.body.action === 'decrease') {
  user.signalLevel = Math.max(0, user.signalLevel - 10)
}


  saveUsers(users)
  setToast(req, 'success', 'Signal updated')
  res.redirect('/admin/users')
})

router.get('/admin/withdrawals', requireAdmin, (req, res) => {
  try {
    const withdrawals = loadJson('./database/withdrawals.json', [])
      .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
    res.render('admin/withdrawals', { admin: req.session.admin, withdrawals })
  } catch (error) {
    setToast(req, 'error', 'Error loading withdrawals')
    res.redirect('/admin')
  }
})

router.post('/admin/withdraw/approve', requireAdmin, (req, res) => {
  try {
    const { id } = req.body

    const withdrawals = loadJson('./database/withdrawals.json', [])
    const users = loadUsers()

    const wd = withdrawals.find(w => w.id == id)
    if (!wd) {
      setToast(req, 'error', 'Request not found')
      return res.redirect('/admin/withdrawals')
    }

    if (wd.status === 'approved') {
      setToast(req, 'info', 'Already approved')
      return res.redirect('/admin/withdrawals')
    }

    const user = users.find(u => u.id == wd.userId)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/withdrawals')
    }

    wd.status = 'approved'

    saveUsers(users)
    saveJson('./database/withdrawals.json', withdrawals)

    logAdminAction(req, 'withdraw_approve', {
      withdrawalId: wd.id,
      userId: wd.userId,
      amount: wd.amount
    })

    setToast(req, 'success', 'Withdrawal approved')
    res.redirect('/admin/withdrawals')

  } catch (error) {
    setToast(req, 'error', 'Error approving withdrawal')
    res.redirect('/admin/withdrawals')
  }
})

/* ===========================
ADMIN WITHDRAW REJECT - FIXED
=========================== */
router.post('/admin/withdraw/reject', requireAdmin, (req, res) => {
  try {
    const { id } = req.body

    const withdrawals = loadJson('./database/withdrawals.json', [])
    const users = loadUsers()

    const w = withdrawals.find(x => x.id == id)
    if (!w) return res.redirect('/admin/withdrawals')

    // Don't process if already rejected
    if (w.status === 'rejected') {
      setToast(req, 'info', 'Withdrawal already rejected')
      return res.redirect('/admin/withdrawals')
    }

    const user = users.find(u => u.id === w.userId)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/withdrawals')
    }

    // Add the money back to profit (not deposit)
    user.profit = Number(user.profit || 0) + Number(w.amount)
    
    // Recalculate balance
    recalcUserBalance(user)

    // Update withdrawal status
    w.status = 'rejected'

    // Save changes
    saveJson('./database/withdrawals.json', withdrawals)
    saveUsers(users)

    logAdminAction(req, 'withdraw_reject', {
      withdrawalId: w.id,
      userId: w.userId,
      amount: w.amount
    })

    setToast(req, 'success', 'Withdrawal rejected and funds returned to profit')
    res.redirect('/admin/withdrawals')

  } catch (error) {
    console.error('Error rejecting withdrawal:', error)
    setToast(req, 'error', 'Error rejecting withdrawal')
    res.redirect('/admin/withdrawals')
  }
})

router.get('/admin/deposits', requireAdmin, (req, res) => {
  try {
    const deposits = loadJson('./database/deposits.json', [])
      .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
    res.render('admin/deposits', { deposits })
  } catch (error) {
    setToast(req, 'error', 'Error loading deposits')
    res.redirect('/admin')
  }
})

router.get('/admin/deposit/add', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
      .filter(u => u.role !== 'admin')
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    res.render('admin/add-deposit', { users })
  } catch (error) {
    setToast(req, 'error', 'Error loading add deposit page')
    res.redirect('/admin')
  }
})

router.post('/admin/deposit/add', requireAdmin, (req, res) => {
  try {
    const { userId, amount, method } = req.body

    const deposits = loadJson('./database/deposits.json', [])
    const users = loadUsers()
    const user = users.find(u => u.id == userId)

    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/deposit/add')
    }

    const entry = {
      id: Date.now(),
      userId: user.id,
      username: user.username,
      userName: user.username,
      amount: Number(amount),
      method,
      status: 'approved',
      createdAt: new Date().toISOString(),
      date: new Date().toISOString()
    }

    deposits.push(entry)

    user.deposit = Number(user.deposit || 0) + Number(amount)
    recalcUserBalance(user)

    saveUsers(users)
    saveJson('./database/deposits.json', deposits)

    logAdminAction(req, 'deposit_add', {
      userId: user.id,
      amount: Number(amount),
      method
    })

    setToast(req, 'success', 'Deposit added for user')
    res.redirect('/admin/deposits')

  } catch (error) {
    setToast(req, 'error', 'Error adding deposit')
    res.redirect('/admin/deposit/add')
  }
})

router.post('/admin/deposit/approve', requireAdmin, (req, res) => {
  try {
    const { id } = req.body

    const deposits = loadJson('./database/deposits.json', [])
    const users = loadUsers()

    const dep = deposits.find(d => d.id == id)
    if (!dep) {
      setToast(req, 'error', 'Deposit not found')
      return res.redirect('/admin/deposits')
    }

    if (dep.status === 'approved') {
      setToast(req, 'info', 'Deposit already approved')
      return res.redirect('/admin/deposits')
    }

    if (dep.status === 'rejected') {
      setToast(req, 'error', 'Rejected deposits cannot be approved')
      return res.redirect('/admin/deposits')
    }

    const user = users.find(u => u.id == dep.userId)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/deposits')
    }

    dep.status = 'approved'
    user.deposit = Number(user.deposit || 0) + Number(dep.amount)
    recalcUserBalance(user)

    saveJson('./database/deposits.json', deposits)
    saveUsers(users)

    logAdminAction(req, 'deposit_approve', {
      depositId: dep.id,
      userId: dep.userId,
      amount: dep.amount
    })

    setToast(req, 'success', 'Deposit approved')
    res.redirect('/admin/deposits')

  } catch (error) {
    setToast(req, 'error', 'Error approving deposit')
    res.redirect('/admin/deposits')
  }
})

router.post('/admin/deposit/reject', requireAdmin, (req, res) => {
  try {
    const { id } = req.body

    const deposits = loadJson('./database/deposits.json', [])
    const dep = deposits.find(d => d.id == id)
    if (!dep) {
      setToast(req, 'error', 'Deposit not found')
      return res.redirect('/admin/deposits')
    }

    if (dep.status === 'approved') {
      setToast(req, 'error', 'Approved deposits cannot be rejected')
      return res.redirect('/admin/deposits')
    }

    if (dep.status === 'rejected') {
      setToast(req, 'info', 'Deposit already rejected')
      return res.redirect('/admin/deposits')
    }

    dep.status = 'rejected'
    saveJson('./database/deposits.json', deposits)

    logAdminAction(req, 'deposit_reject', {
      depositId: dep.id,
      userId: dep.userId,
      amount: dep.amount
    })

    setToast(req, 'success', 'Deposit rejected')
    res.redirect('/admin/deposits')

  } catch (error) {
    setToast(req, 'error', 'Error rejecting deposit')
    res.redirect('/admin/deposits')
  }
})

router.get('/admin/profile', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()

    let adminUser = null

    if (req.session.admin && req.session.admin.id) {
      adminUser = users.find(u => u.id == req.session.admin.id && u.role === 'admin')
    }

    if (!adminUser) {
      adminUser = users.find(u => u.role === 'admin')
    }

    if (!adminUser) {
      setToast(req, 'error', 'Admin user not found')
      return res.redirect('/admin')
    }

    res.render('admin/profile', {
      admin: req.session.admin,
      adminUser
    })

  } catch (error) {
    setToast(req, 'error', 'Error loading admin profile')
    res.redirect('/admin')
  }
})

// FIXED: Admin profile update route - Supports both plain text and bcrypt
router.post('/admin/profile', requireAdmin, async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body
    
    const users = loadUsers()

    let adminUser = null

    // Find admin user by session ID
    if (req.session.admin && req.session.admin.id) {
      adminUser = users.find(u => u.id == req.session.admin.id && u.role === 'admin')
    }

    // If not found, find any admin
    if (!adminUser) {
      adminUser = users.find(u => u.role === 'admin')
    }

    if (!adminUser) {
      console.error("No admin user found in database")
      setToast(req, 'error', 'Admin user not found in database')
      return res.redirect('/admin/profile')
    }

    // Update username if changed
    if (username && username !== adminUser.username) {
      // Check if username is already taken
      const existingUser = users.find(u => u.username === username && u.id !== adminUser.id)
      if (existingUser) {
        setToast(req, 'error', 'Username already taken')
        return res.redirect('/admin/profile')
      }
      
      adminUser.username = username
      
      // Update session
      req.session.admin.username = username
    }

    // If new password is provided
    if (newPassword && newPassword.trim()) {
      // Check if admin has an existing password
      if (adminUser.password) {
        // Admin has existing password, require current password
        if (!currentPassword) {
          setToast(req, 'error', 'Current password is required to change password')
          return res.redirect('/admin/profile')
        }

        // Check password - supports both plain text and bcrypt
        let passwordValid = false
        
        // Check plain text
        if (adminUser.password === currentPassword) {
          passwordValid = true
        } else {
          // Check bcrypt hash
          try {
            passwordValid = await bcrypt.compare(currentPassword, adminUser.password)
          } catch (err) {
            console.error('Bcrypt comparison error:', err)
            passwordValid = false
          }
        }
        
        if (!passwordValid) {
          setToast(req, 'error', 'Current password is incorrect')
          return res.redirect('/admin/profile')
        }
      }

      // Validate new password length
      if (newPassword.length < 6) {
        setToast(req, 'error', 'Password must be at least 6 characters')
        return res.redirect('/admin/profile')
      }

      adminUser.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    }

    // Save users
    const saveResult = saveUsers(users)
    if (!saveResult) {
      console.error("Failed to save users")
      setToast(req, 'error', 'Failed to save changes')
      return res.redirect('/admin/profile')
    }
    
    // Force session save
    req.session.save((err) => {
      if (err) {
        console.error('Session save error during profile update:', err)
      }
      
      logAdminAction(req, 'admin_profile_update', {
        adminId: adminUser.id,
        usernameChanged: username && username !== adminUser.username,
        passwordChanged: !!(newPassword && newPassword.trim())
      })

      setToast(req, 'success', 'Admin profile updated successfully')
      res.redirect('/admin/profile')
    })

  } catch (e) {
    console.error('Error updating admin profile:', e)
    setToast(req, 'error', 'Error updating admin profile: ' + e.message)
    res.redirect('/admin/profile')
  }
})

router.get('/admin/kyc', requireAdmin, (req, res) => {
  try {
    const kycRequests = loadJson('./database/kyc.json', [])
      .sort((a, b) => new Date(b.createdAt || b.reviewedAt || 0) - new Date(a.createdAt || a.reviewedAt || 0))

    const users = loadUsers()

    res.render('admin/kyc', {
      admin: req.session.admin,
      kycRequests,
      users
    })

  } catch (error) {
    setToast(req, 'error', 'Error loading KYC requests')
    res.redirect('/admin')
  }
})

router.post('/admin/kyc/approve', requireAdmin, (req, res) => {
  try {
    const { id } = req.body

    const kycRequests = loadJson('./database/kyc.json', [])
    const users = loadUsers()

    const request = kycRequests.find(k => k.id == id)
    if (!request) {
      setToast(req, 'error', 'Request not found')
      return res.redirect('/admin/kyc')
    }

    if (request.status === 'approved') {
      setToast(req, 'info', 'KYC already approved')
      return res.redirect('/admin/kyc')
    }

    if (request.status === 'rejected') {
      setToast(req, 'error', 'Rejected KYC requests cannot be approved')
      return res.redirect('/admin/kyc')
    }

    const user = users.find(u => u.id == request.userId)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/kyc')
    }

    request.status = 'approved'
    request.reviewedAt = new Date().toISOString()
    user.kycStatus = 'verified'

    saveJson('./database/kyc.json', kycRequests)
    saveUsers(users)

    logAdminAction(req, 'kyc_approve', {
      kycId: request.id,
      userId: request.userId
    })

    setToast(req, 'success', 'KYC approved')
    res.redirect('/admin/kyc')

  } catch (error) {
    setToast(req, 'error', 'Error approving KYC')
    res.redirect('/admin/kyc')
  }
})

router.post('/admin/kyc/reject', requireAdmin, (req, res) => {
  try {
    const { id } = req.body

    const kycRequests = loadJson('./database/kyc.json', [])
    const users = loadUsers()

    const request = kycRequests.find(k => k.id == id)
    if (!request) {
      setToast(req, 'error', 'Request not found')
      return res.redirect('/admin/kyc')
    }

    if (request.status === 'approved') {
      setToast(req, 'error', 'Approved KYC requests cannot be rejected')
      return res.redirect('/admin/kyc')
    }

    if (request.status === 'rejected') {
      setToast(req, 'info', 'KYC already rejected')
      return res.redirect('/admin/kyc')
    }

    const user = users.find(u => u.id == request.userId)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/kyc')
    }

    request.status = 'rejected'
    request.reviewedAt = new Date().toISOString()
    user.kycStatus = 'rejected'

    saveJson('./database/kyc.json', kycRequests)
    saveUsers(users)

    logAdminAction(req, 'kyc_reject', {
      kycId: request.id,
      userId: request.userId
    })

    setToast(req, 'success', 'KYC rejected')
    res.redirect('/admin/kyc')

  } catch (error) {
    setToast(req, 'error', 'Error rejecting KYC')
    res.redirect('/admin/kyc')
  }
})

router.get('/admin/deposit-methods', requireAdmin, (req, res) => {
  try {
    const methods = loadJson('./database/depositMethods.json', [])
    res.render('admin/deposit-methods', {
      admin: req.session.admin,
      methods
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading deposit methods')
    res.redirect('/admin')
  }
})

router.post('/admin/deposit-methods/add', requireAdmin, (req, res) => {
  try {
    const { name } = req.body
    const methods = loadJson('./database/depositMethods.json', [])

    methods.push({
      id: Date.now(),
      name,
      enabled: true
    })

    saveJson('./database/depositMethods.json', methods)
    setToast(req, 'success', 'Deposit method added')
    res.redirect('/admin/deposit-methods')

  } catch (error) {
    setToast(req, 'error', 'Error adding deposit method')
    res.redirect('/admin/deposit-methods')
  }
})

router.post('/admin/deposit-methods/edit', requireAdmin, (req, res) => {
  try {
    const { id, name, details } = req.body
    const enabled = req.body.enabled === 'on'

    const methods = loadJson('./database/depositMethods.json', [])
    const method = methods.find(m => m.id == id)
    if (!method) {
      setToast(req, 'error', 'Method not found')
      return res.redirect('/admin/deposit-methods')
    }

    method.name = name
    method.details = details
    method.enabled = enabled

    saveJson('./database/depositMethods.json', methods)
    setToast(req, 'success', 'Deposit method updated')
    res.redirect('/admin/deposit-methods')

  } catch (error) {
    setToast(req, 'error', 'Error updating deposit method')
    res.redirect('/admin/deposit-methods')
  }
})

router.post('/admin/deposit-methods/delete', requireAdmin, (req, res) => {
  try {
    const { id } = req.body
    let methods = loadJson('./database/depositMethods.json', [])
    methods = methods.filter(m => m.id != id)
    saveJson('./database/depositMethods.json', methods)
    setToast(req, 'success', 'Deposit method deleted')
    res.redirect('/admin/deposit-methods')
  } catch (error) {
    setToast(req, 'error', 'Error deleting deposit method')
    res.redirect('/admin/deposit-methods')
  }
})

router.get('/admin/payment-settings', requireAdmin, (req, res) => {
  try {
    const methods = loadJson('./database/depositMethods.json', [])
    res.render('admin/payment-settings', { admin: req.session.admin, methods })
  } catch (error) {
    setToast(req, 'error', 'Error loading payment methods')
    res.redirect('/admin')
  }
})

router.post('/admin/payment-settings', requireAdmin, (req, res) => {
  try {
    const methods = loadJson('./database/depositMethods.json', [])
    const details = req.body.details || {}
    const enabled = req.body.enabled || {}

    methods.forEach(method => {
      method.details = details[String(method.id)] || ''
      method.enabled = enabled[String(method.id)] === 'on'
    })

    saveJson('./database/depositMethods.json', methods)
    setToast(req, 'success', 'Payment instructions updated')
    res.redirect('/admin/payment-settings')

  } catch (error) {
    setToast(req, 'error', 'Error saving payment settings')
    res.redirect('/admin/payment-settings')
  }
})

// Database recovery endpoint (admin only)
router.get('/admin/database/recovery', requireAdmin, (req, res) => {
  try {
    const databases = [
      'users.json',
      'deposits.json',
      'withdrawals.json',
      'kyc.json',
      'holdings.json',
      'trades.json',
      'subscriptions.json',
      'stocks.json',
      'copytraders.json',
      'following.json',
      'depositMethods.json',
      'paymentInstructions.json',
      'emailVerify.json',
      'adminLogs.json'
    ]
    
    const status = databases.map(db => {
      const path = `./database/${db}`
      try {
        if (fs.existsSync(path)) {
          const stats = fs.statSync(path)
          const backupExists = fs.existsSync(path + '.backup')
          return {
            name: db,
            size: stats.size,
            modified: stats.mtime,
            backupExists,
            status: 'OK'
          }
        } else {
          return {
            name: db,
            status: 'Missing'
          }
        }
      } catch (error) {
        return {
          name: db,
          status: 'Error',
          error: error.message
        }
      }
    })
    
    res.render('admin/database-recovery', {
      admin: req.session.admin,
      databases: status
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading database recovery')
    res.redirect('/admin')
  }
})

router.post('/admin/database/restore', requireAdmin, (req, res) => {
  try {
    const { database } = req.body
    const dbPath = `./database/${database}`
    const backupPath = dbPath + '.backup'
    
    if (!fs.existsSync(backupPath)) {
      setToast(req, 'error', 'No backup found for this database')
      return res.redirect('/admin/database/recovery')
    }
    
    // Create a backup of current file before restoring
    if (fs.existsSync(dbPath)) {
      const timestamp = Date.now()
      fs.copyFileSync(dbPath, `${dbPath}.pre-restore-${timestamp}.backup`)
    }
    
    // Restore from backup
    fs.copyFileSync(backupPath, dbPath)
    
    logAdminAction(req, 'database_restore', { database })
    setToast(req, 'success', `Database ${database} restored from backup`)
    res.redirect('/admin/database/recovery')
    
  } catch (error) {
    setToast(req, 'error', `Restore failed: ${error.message}`)
    res.redirect('/admin/database/recovery')
  }
})



  return router
}
