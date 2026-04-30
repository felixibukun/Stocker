require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const fs = require('fs')
const rateLimit = require('express-rate-limit')
const bcrypt = require('bcryptjs')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const { ALLOWED_IPS, BCRYPT_ROUNDS, sessionSecret } = require('./config/security')
const { createAuthMiddleware } = require('./middleware/auth')
const { createCsrfProtection } = require('./middleware/csrf')
const { upload } = require('./middleware/upload')
const { loadJson, saveJson } = require('./services/jsonStore')
const { notify } = require('./services/mailer')
const { ensureSignalLevel, loadUsers, recalcUserBalance, saveUsers } = require('./services/users')
const createPublicRoutes = require('./routes/public')
const createAuthRoutes = require('./routes/auth')
const createUserRoutes = require('./routes/user')
const createAdminRoutes = require('./routes/admin')

const app = express()

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again later.'
})

const adminLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many admin login attempts, please try again later.'
})

const equityHistoryPath = path.join(__dirname, 'data', 'equityHistory.json')
const verifyFile = './database/emailVerify.json'
const adminLogFile = './database/adminLogs.json'

function loadEquity() {
  try {
    return JSON.parse(fs.readFileSync(equityHistoryPath))
  } catch {
    return []
  }
}

function saveEquity(data) {
  fs.writeFileSync(equityHistoryPath, JSON.stringify(data, null, 2))
}

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(helmet({ contentSecurityPolicy: false }))

// CRITICAL FIX: Add body parsers and cookie parser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))

// Allow images, logos, scripts from temp folder
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// FIX: Add trust proxy for session cookies
app.set('trust proxy', 1)

// Enhanced session configuration - FIXED
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Auto-detect based on environment
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    },
    name: 'sessionId', // Changed from __Secure-sessionId to avoid browser issues
    rolling: true
  })
)

app.use(createCsrfProtection(setToast))

app.use((req, res, next) => {
  res.locals.toast = req.session.toast || null
  delete req.session.toast
  next()
})

function getMarketPrice(symbol) {
  const prices = {
    'BTC/USD': 65000,
    'ETH/USD': 3500,
    'AAPL': 180,
    'TSLA': 250
  };
  return prices[symbol] || 100;
}


function loadVerify() {
  return loadJson(verifyFile, [])
}

function saveVerify(data) {
  saveJson(verifyFile, data)
}

function setToast(req, type, message) {
  req.session.toast = { type, message }
}

const {
  getClientIp,
  requireAdminIP,
  requireLogin,
  requireSignalActive
} = createAuthMiddleware({
  allowedIps: ALLOWED_IPS,
  loadUsers,
  setToast
})

function loadAdminLogs() {
  return loadJson(adminLogFile, [])
}

function saveAdminLogs(data) {
  saveJson(adminLogFile, data)
}

function logAdminAction(req, action, meta) {
  try {
    const logs = loadAdminLogs()
    logs.push({
      id: Date.now(),
      adminId: req.session.admin ? req.session.admin.id : null,
      action,
      meta,
      timestamp: new Date().toISOString(),
      ip: req.ip
    })
    saveAdminLogs(logs)
  } catch (e) {
    console.error('Admin log error:', e)
  }
}

/* ===========================
LIVE STOCK SIMULATOR
=========================== */
setInterval(() => {
  try {
    const stocks = loadJson('./database/stocks.json', [])

    stocks.forEach(s => {
      const change = (Math.random() * 2 - 1).toFixed(2)
      let newPrice = s.price + Number(change)
      if (newPrice < 1) newPrice = 1
      s.price = Number(newPrice.toFixed(2))
    })

    saveJson('./database/stocks.json', stocks)

  } catch (e) {
    console.error('Stock update error:', e)
  }
}, 10000)

/* ===========================
COPY TRADER AUTO PROFIT
=========================== */
setInterval(() => {

return

  try {
    const following = loadJson('./database/following.json', [])
    let users = loadUsers()

    if (!Array.isArray(users)) return
    if (!Array.isArray(following)) return

    following.forEach(f => {
      const user = users.find(u => u.id === f.userId)
      if (!user) return

      // Use invested amount stored in following record
      const invested = Number(f.amount || 0)
      if (invested <= 0) return

      // realistic small percent per tick
      const rate = (Math.random() * 0.01 + 0.005) / 100
      const profit = Number((invested * rate).toFixed(2))

      // add profit to user's profit and to spendable balance
      user.profit = Number(user.profit || 0) + profit
      recalcUserBalance(user)

      f.lastProfit = profit
      f.updatedAt = new Date().toISOString()
    })

    saveUsers(users)
    saveJson('./database/following.json', following)

  } catch (err) {
    console.error('CopyTrader Error:', err)
  }
}, 15000)

/* ===========================
DASHBOARD
=========================== */
app.use(createPublicRoutes({ loadJson }))
app.use(createAuthRoutes({ BCRYPT_ROUNDS, authLimit, bcrypt, loadUsers, saveUsers, setToast }))
app.use(createUserRoutes({ bcrypt, getMarketPrice, loadJson, loadUsers, notify, recalcUserBalance, requireLogin, requireSignalActive, saveJson, saveUsers, setToast, upload }))
app.use(createAdminRoutes({ BCRYPT_ROUNDS, adminLimit, bcrypt, fs, getClientIp, loadJson, loadUsers, logAdminAction, recalcUserBalance, requireAdminIP, saveJson, saveUsers, setToast }))

app.use((err, req, res, next) => {
  if (err && (err.message === 'Invalid file type' || err.code === 'LIMIT_FILE_SIZE')) {
    setToast(req, 'error', 'Invalid or too large file')
    return res.redirect('back')
  }
  next(err)
})



//* ===========================
//END OF SERVER
//=========================== */

const PORT = process.env.PORT || 3000
ensureSignalLevel()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)

  const requiredDirs = ['./database', './public/uploads', './data']
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  })

  const essentialDBs = [
    './database/users.json',
    './database/deposits.json',
    './database/withdrawals.json',
    './database/kyc.json',
    './database/holdings.json',
    './database/trades.json',
    './database/subscriptions.json',
    './database/stocks.json',
    './database/copytraders.json',
    './database/following.json',
    './database/depositMethods.json',
    './database/paymentInstructions.json',
    './database/emailVerify.json',
    './database/adminLogs.json'
  ]

  essentialDBs.forEach(db => {
    if (!fs.existsSync(db)) {
      const initialData = db.includes('paymentInstructions') ? {} : []
      fs.writeFileSync(db, JSON.stringify(initialData, null, 2))
      console.log(`Created missing database: ${db}`)
    }
  })

  // Check if admin user exists, create one if not
  const users = loadUsers()
  const adminExists = users.some(u => u.role === 'admin')
  if (!adminExists) {
    const adminUser = {
      id: Date.now(),
      username: 'admin',
      name: 'Administrator',
      email: 'admin@example.com',
      role: 'admin',
      password: null, // Will be set on first login
      balance: 0,
      profit: 0,
      bonus: 0,
      deposit: 0,
      verified: true,
      kycStatus: 'verified'
    }
    users.push(adminUser)
    saveUsers(users)
    console.log('Admin user created. Username: admin, Password will be set on first login.')
  }
})
