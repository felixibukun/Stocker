require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const fs = require('fs')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const nodemailer = require('nodemailer')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')

const app = express()

// Security configurations
const ADMIN_IPS = ['102.90.101.126'] // Add multiple IPs if needed
const ALLOWED_IPS = ADMIN_IPS.concat(['127.0.0.1', '::1']) // Localhost for development

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'globalequinoxtrade@gmail.com',
    pass: process.env.MAIL_PASS
  }
})

async function notify(email, subject, message) {
  try {
    let body = ''
    const lower = subject.toLowerCase()

    function wrap(msg) {
      return `<p style="color:#fff; text-align:center; font-size:16px; margin-top:6px; margin-bottom:6px;">${msg}</p>`
    }

    if (lower.includes('verify')) {
      body = `
      <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
        <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
          <div style="text-align:center; margin-bottom:20px;">
            <img src="cid:gqtlogo" style="width:90px;">
          </div>
          <h2 style="color:#fff; text-align:center; margin:0;">Email Verification</h2>
          <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">Complete your account setup</p>
          <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
            ${wrap(message)}
          </div>
          <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
            You received this message because an account action was requested.
          </p>
        </div>
      </div>`
    } else if (lower.includes('trade executed') || lower.includes('copy trader')) {
      body = `
      <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
        <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
          <div style="text-align:center; margin-bottom:20px;">
            <img src="cid:gqtlogo" style="width:90px;">
          </div>
          <h2 style="color:#fff; text-align:center; margin:0;">Trade Executed</h2>
          <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">Your trade is confirmed</p>
          <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
            ${wrap(message)}
          </div>
          <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
            Check your dashboard for full trade details and updated balances.
          </p>
        </div>
      </div>`
    } else if (lower.includes('deposit')) {
      body = `
      <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
        <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
          <div style="text-align:center; margin-bottom:20px;">
            <img src="cid:gqtlogo" style="width:90px;">
          </div>
          <h2 style="color:#fff; text-align:center; margin:0;">Deposit Update</h2>
          <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">Your deposit status</p>
          <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
            ${wrap(message)}
          </div>
          <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
            Once approved, your balance and deposit history will update in your account.
          </p>
        </div>
      </div>`
    } else if (lower.includes('withdrawal')) {
      body = `
      <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
        <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
          <div style="text-align:center; margin-bottom:20px;">
            <img src="cid:gqtlogo" style="width:90px;">
          </div>
          <h2 style="color:#fff; text-align:center; margin:0;">Withdrawal Update</h2>
          <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">Your withdrawal status</p>
          <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
            ${wrap(message)}
          </div>
          <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
            Processing times depend on network and payment provider.
          </p>
        </div>
      </div>`
    } else if (lower.includes('kyc')) {
      body = `
      <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
        <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
          <div style="text-align:center; margin-bottom:20px;">
            <img src="cid:gqtlogo" style="width:90px;">
          </div>
          <h2 style="color:#fff; text-align:center; margin:0;">KYC Status</h2>
          <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">Identity verification update</p>
          <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
            ${wrap(message)}
          </div>
          <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
            Verified accounts enjoy full access to all platform features.
          </p>
        </div>
      </div>`
    } else if (lower.includes('support')) {
      body = `
      <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
        <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
          <div style="text-align:center; margin-bottom:20px;">
            <img src="cid:gqtlogo" style="width:90px;">
          </div>
          <h2 style="color:#fff; text-align:center; margin:0;">Support Ticket</h2>
          <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">Your request is in review</p>
          <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
            ${wrap(message)}
          </div>
          <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
            Our support team will contact you through this email address.
          </p>
        </div>
      </div>`
    } else if (lower.includes('package')) {
      body = `
      <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
        <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
          <div style="text-align:center; margin-bottom:20px;">
            <img src="cid:gqtlogo" style="width:90px;">
          </div>
          <h2 style="color:#fff; text-align:center; margin:0;">Package Update</h2>
          <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">Subscription status</p>
          <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
            ${wrap(message)}
          </div>
          <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
            You can track profits and history in your package section.
          </p>
        </div>
      </div>`
    } else {
      body = `
      <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
        <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
          <div style="text-align:center; margin-bottom:20px;">
            <img src="cid:gqtlogo" style="width:90px;">
          </div>
          <h2 style="color:#fff; text-align:center; margin:0;">Global Equinox Trade</h2>
          <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">Secure Financial Services</p>
          <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
            ${wrap(message)}
          </div>
          <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
            This is an automated message from Global Equinox Trade.
          </p>
        </div>
      </div>`
    }

    const logoPath = path.join(__dirname, 'public', 'temp', 'custom', 'img', 'logo.png')
    let attachments = []
    
    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: 'logo.png',
        path: logoPath,
        cid: 'gqtlogo'
      })
    }

    await mailer.sendMail({
      from: 'Global Equinox Trade <globalequinoxtrade@gmail.com>',
      to: email,
      subject: subject,
      html: body,
      attachments: attachments
    })

    console.log(`Email sent to ${email}: ${subject}`)
    return true

  } catch (e) {
    console.error('Email error:', e)
    return false
  }
}

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

const uploadDir = path.join(__dirname, 'public', 'uploads')
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

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '')
    const base = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, base + ext)
  }
})

function fileFilter(req, file, cb) {
  const allowed = ['image/png', 'image/jpeg']
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Invalid file type'))
  }
  cb(null, true)
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
})

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

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
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: true, // Changed to true for better session persistence
    saveUninitialized: true, // Changed to true
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

// FIX: Add session debugging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - SessionID: ${req.sessionID}`)
  next()
})

app.use((req, res, next) => {
  res.locals.toast = req.session.toast || null
  delete req.session.toast
  next()
})

function requireLogin(req, res, next) {
  if (!req.session.user) {
    console.log('Access denied: No user session')
    return res.redirect('/login')
  }
  next()
}

function requireSignalActive(req, res, next) {
  const users = loadUsers()
  const user = users.find(u => u.id === req.session.user.id)

  if (!user) return res.redirect('/login')

  if (user.signalLevel === 0) {
    setToast(req, 'error', 'Trading locked. Deposit allowed.')
    return res.redirect('/dashboard')
  }

  next()
}

// Enhanced JSON loading with recovery layer
function loadJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw.trim()) {
      console.warn(`File ${filePath} is empty, using fallback`)
      return fallback
    }
    
    // Backup the current file before parsing
    const backupPath = filePath + '.backup'
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath)
    }
    
    try {
      return JSON.parse(raw)
    } catch (parseError) {
      console.error(`JSON parse error in ${filePath}:`, parseError)
      
      // Try to recover from backup
      try {
        if (fs.existsSync(backupPath)) {
          const backupData = fs.readFileSync(backupPath, 'utf8')
          const parsedBackup = JSON.parse(backupData)
          console.log(`Recovered ${filePath} from backup`)
          return parsedBackup
        }
      } catch (backupError) {
        console.error(`Backup recovery failed for ${filePath}:`, backupError)
      }
      
      // Try to fix common JSON issues
      const fixed = raw
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/'/g, '"')
      
      try {
        const recovered = JSON.parse(fixed)
        console.log(`Recovered ${filePath} by fixing JSON`)
        // Save the fixed version
        fs.writeFileSync(filePath, JSON.stringify(recovered, null, 2))
        return recovered
      } catch (recoveryError) {
        console.error(`JSON recovery failed for ${filePath}:`, recoveryError)
        return fallback
      }
    }
  } catch (readError) {
    console.error(`Error reading ${filePath}:`, readError)
    
    // Try to restore from last known good backup
    const backupPath = filePath + '.backup'
    if (fs.existsSync(backupPath)) {
      try {
        const backupData = fs.readFileSync(backupPath, 'utf8')
        const parsedBackup = JSON.parse(backupData)
        console.log(`Restored ${filePath} from backup after read error`)
        // Restore the backup
        fs.writeFileSync(filePath, backupData)
        return parsedBackup
      } catch (backupError) {
        console.error(`Backup restoration failed for ${filePath}:`, backupError)
      }
    }
    
    return fallback
  }
}

// FIXED: Complete and correct saveJson function
function saveJson(filePath, data) {
  try {
    // Create backup before writing
    if (fs.existsSync(filePath)) {
      const backupPath = filePath + '.backup'
      fs.copyFileSync(filePath, backupPath)
    }

    // Write the new data
    const jsonString = JSON.stringify(data, null, 2)
    fs.writeFileSync(filePath, jsonString)
    
    // Verify the written data
    const verifyData = fs.readFileSync(filePath, 'utf8')
    JSON.parse(verifyData)
    
    console.log(`✅ Data saved successfully to ${filePath}`)
    return true
  } catch (error) {
    console.error(`❌ Error saving ${filePath}:`, error)
    
    // Attempt to restore from backup
    const backupPath = filePath + '.backup'
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, filePath)
        console.log(`Restored ${filePath} from backup after save error`)
      } catch (restoreError) {
        console.error(`Failed to restore ${filePath} from backup:`, restoreError)
      }
    }
    
    return false
  }
}

// Clean loadUsers function
function loadUsers() {
  const filePath = path.join(__dirname, 'database', 'users.json')

  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2))
      return []
    }

    const data = fs.readFileSync(filePath, 'utf8')
    if (!data.trim()) return []

    const users = JSON.parse(data)
    return Array.isArray(users) ? users : []
  } catch (err) {
    console.error('LOAD USERS ERROR:', err)
    return []
  }
}

function ensureSignalLevel() {
  const users = loadUsers()
  let changed = false

  users.forEach(u => {
    if (typeof u.signalLevel !== 'number') {
      u.signalLevel = 100
      changed = true
    }
  })

  if (changed) saveUsers(users)
}

// FIXED: Complete saveUsers function
function saveUsers(data) {
  try {
    const filePath = path.join(__dirname, 'database', 'users.json')
    const backupPath = filePath + '.backup'

    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath)
    }

    if (!Array.isArray(data)) {
      data = []
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))

    return true
  } catch (e) {
    console.error("Save users failed:", e)
    return false
  }
}

// ADDED: recalcUserBalance function
function recalcUserBalance(user) {
  user.deposit = Number(user.deposit || 0)
  user.profit = Number(user.profit || 0)
  user.bonus = Number(user.bonus || 0)

  const totalDeposit = user.deposit
  const totalProfit = user.profit
  const bonus = user.bonus

  user.balance = totalDeposit + totalProfit + bonus
}

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

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (xf) {
    return xf.split(',')[0].trim()
  }
  return req.ip || req.connection.remoteAddress
}

// FIXED: Correct IP checking function
function isAdminIp(req) {
  const clientIp = getClientIp(req)
  const isAllowed = ALLOWED_IPS.includes(clientIp)
  console.log(`IP Check: ${clientIp} - Allowed: ${isAllowed}`)
  return isAllowed
}

function requireAdminIP(req, res, next) {
  next()
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

app.get('/api/stocks', (req, res) => {
  try {
    const stocks = loadJson('./database/stocks.json', [])
    res.json(stocks)
  } catch (e) {
    res.status(500).json({ error: 'Failed to load stocks' })
  }
})

app.get('/about', (req, res) => {
res.render('about');
});

app.get('/FAQ', (req, res) => {
res.render('FAQ');
});

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
LEGAL PAGES
=========================== */

app.get('/terms', (req, res) => {
  res.render('terms')
})

app.get('/privacy-policy', (req, res) => {
  res.render('privacy')
})

app.get('/risk-disclosure', (req, res) => {
  res.render('risk')
})

app.get('/cookie-policy', (req, res) => {
  res.render('cookie')
})

app.get('/aml-policy', (req, res) => {
  res.render('aml')
})


/* ===========================
AUTH
=========================== */
app.get('/', (req, res) => res.render('index'))

app.get('/signup', (req, res) => res.render('signup'))

app.post('/signup', authLimit, async (req, res) => {
  try {
    const { username, name, email, phone, country, password } = req.body
    const users = loadUsers()

    if (users.find(u => u.username === username)) {
      setToast(req, 'error', 'Username exists')
      return res.redirect('/signup')
    }

    const user = {
  id: Date.now(),
  username,
  name,
  email,
  phone,
  country,
  password: password,
  balance: 0,
  profit: 0,
  bonus: 0,
  deposit: 0,
  signalLevel: 100,
  verified: false,
  kycStatus: 'not_verified'
}


    users.push(user)
    saveUsers(users)

    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email
    }

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err)
        setToast(req, 'error', 'Signup error')
        return res.redirect('/signup')
      }
      
      setToast(req, 'success', 'Account created successfully')
      res.redirect('/dashboard')
    })

  } catch (e) {
    console.error('Signup error:', e)
    setToast(req, 'error', 'Signup error')
    res.redirect('/signup')
  }
})

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard')
  
  // Check if password was changed
  const passwordChanged = req.query.passwordChanged === 'true'
  
  res.render('login', { 
    passwordChanged 
  })
})

app.post('/login', authLimit, async (req, res) => {
  try {
    const { username, password } = req.body
    const users = loadUsers()

    function failLogin() {
      setToast(req, 'error', 'Invalid login')
      return res.redirect('/login')
    }

    const user = users.find(u => u.username === username)
    if (!user) {
      return failLogin()
    }

    // Check password - supports both plain text and bcrypt
    let passwordValid = false
    
    if (user.password === password) {
      passwordValid = true
    } else {
      try {
        passwordValid = await bcrypt.compare(password, user.password)
      } catch (err) {
        passwordValid = false
      }
    }
    
    if (!passwordValid) {
      return failLogin()
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email
    }

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err)
        setToast(req, 'error', 'Login error')
        return res.redirect('/login')
      }
      
      console.log('User login successful:', username)
      setToast(req, 'success', 'Login successful')
      res.redirect('/dashboard')
    })

  } catch (e) {
    console.error('Login error:', e)
    setToast(req, 'error', 'Login error')
    res.redirect('/login')
  }
})

app.get('/logout', (req, res) => {
  console.log('User logging out:', req.session.user?.username)
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err)
    }
    res.redirect('/login')
  })
})

/* ===========================
DASHBOARD
=========================== */
app.get('/dashboard', requireLogin, (req, res) => {
  const users = loadUsers()
  const holdings = loadJson('./database/holdings.json', [])
  const trades = loadJson('./database/trades.json', [])
  const subscriptions = loadJson('./database/subscriptions.json', [])
  const stocks = loadJson('./database/stocks.json', [])

  const user = users.find(u => u.id === req.session.user.id)
  const openPositions = user.openPositions || []

  if (!user) return res.redirect('/login')

  user.deposit = Number(user.deposit) || 0
  user.balance = Number(user.balance) || 0
  user.profit = Number(user.profit) || 0

  const userHoldings = holdings.filter(h => h.userId === user.id)
  const userTrades = trades.filter(t => t.userId === user.id)
  const userSubscriptions = subscriptions.filter(s => s.userId === user.id)

  const wins = userTrades.filter(t => t.profit > 0).length
  const total = userTrades.length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  const todayPL = 0
  const riskLevel = 'low'

  let openTrades = userHoldings.length
  let totalPL = 0

  userHoldings.forEach(h => {
    const stock = stocks.find(s => s.id == h.stockId)
    if (!stock) return
    const diff = (Number(stock.price) - Number(h.avgPrice)) * Number(h.quantity)
    totalPL += diff
  })

  res.render('dashboard', {
  user: {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    balance: user.balance,
    deposit: user.deposit,
    profit: user.profit,
    bonus: user.bonus,
    signalLevel: user.signalLevel,
    kycStatus: user.kycStatus || "Not Verified"
  },
  openPositions,
  openTrades,
  totalPL,
  subscriptions: userSubscriptions,
  holdings: userHoldings,
  trades: userTrades,
  winRate,
  todayPL,
  riskLevel,
  admin: req.session.admin
})
})

/* ===========================
COPY TRADER
=========================== */
app.get('/copy-trader', requireLogin, (req, res) => {
  try {
    const traders = loadJson('./database/copytraders.json', [])
    res.render('copytrader', { user: req.session.user, traders })
  } catch {
    setToast(req, 'error', 'Error loading copy traders')
    res.redirect('/dashboard')
  }
})

app.post('/copy-trader/follow', requireLogin, requireSignalActive, async (req, res) => {
try {
const { traderId, amount } = req.body
const invest = Number(amount)

if (!invest || invest <= 0) {
  setToast(req, 'error', 'Invalid investment amount')
  return res.redirect('/copy-trader')
}

const users = loadUsers()
const user = users.find(u => u.id === req.session.user.id)
if (!user) {
  setToast(req, 'error', 'User not found')
  return res.redirect('/copy-trader')
}

user.deposit = Number(user.deposit || 0)
user.profit = Number(user.profit || 0)
user.bonus = Number(user.bonus || 0)

if (user.deposit < invest) {
  setToast(req, 'error', 'Insufficient deposit funds')
  return res.redirect('/copy-trader')
}

const traders = loadJson('./database/copytraders.json', [])
const trader = traders.find(t => t.id == traderId)
if (!trader) {
  setToast(req, 'error', 'Trader not found')
  return res.redirect('/copy-trader')
}

const following = loadJson('./database/following.json', [])
const exists = following.find(f => f.userId === user.id && f.traderId === trader.id)
if (exists) {
  setToast(req, 'info', 'Already following this trader')
  return res.redirect('/copy-trader')
}

user.deposit -= invest

recalcUserBalance(user)

following.push({
  id: Date.now(),
  userId: user.id,
  traderId: trader.id,
  traderName: trader.name,
  amount: invest,
  status: 'active',
  startedAt: new Date().toISOString()
})

saveUsers(users)
saveJson('./database/following.json', following)

await notify(
  user.email,
  'Copy Trader Activated',
  `You started copying ${trader.name} with $${invest}.`
)

setToast(req, 'success', 'Copy trader activated')
res.redirect('/copy-trader')


} catch (err) {
console.error('Copy trader error:', err)
setToast(req, 'error', 'Copy trader failed')
res.redirect('/copy-trader')
}
})


/* ===========================
STOCKS
=========================== */
app.get('/stocks', requireLogin, (req, res) => {
  try {
    const stocks = loadJson('./database/stocks.json', [])
    res.render('stocks', { user: req.session.user, stocks })
  } catch {
    setToast(req, 'error', 'Error loading stocks')
    res.redirect('/dashboard')
  }
})

app.get('/subscription-trade', requireLogin, (req, res) => {
  const stocks = loadJson('./database/stocks.json', [])
  res.render('stocks', { user: req.session.user, stocks })
})

/* ===========================
BUY STOCK
=========================== */
app.post('/stocks/buy', requireLogin, requireSignalActive, async (req, res) => {
  try {
    const { stockId, quantity } = req.body
    const qty = Number(quantity)

    if (!qty || qty <= 0) {
      setToast(req, 'error', 'Invalid quantity')
      return res.redirect('/stocks')
    }

    const stocks = loadJson('./database/stocks.json', [])
    const users = loadUsers()
    const holdings = loadJson('./database/holdings.json', [])
    const trades = loadJson('./database/trades.json', [])

    const user = users.find(u => u.id === req.session.user.id)
    const stock = stocks.find(s => s.id == stockId)

    user.deposit = Number(user.deposit || 0)

    if (!stock) {
      setToast(req, 'error', 'Stock not found')
      return res.redirect('/stocks')
    }

    const totalCost = stock.price * qty

    if (user.deposit < totalCost) {
      setToast(req, 'error', 'Insufficient deposit funds')
      return res.redirect('/stocks')
    }

    let holding = holdings.find(h => h.userId === user.id && h.stockId === stock.id)

    if (holding) {
      const oldTotal = holding.avgPrice * holding.quantity
      const newTotal = stock.price * qty
      const newQty = holding.quantity + qty
      holding.avgPrice = (oldTotal + newTotal) / newQty
      holding.quantity = newQty
    } else {
      holding = {
        id: Date.now(),
        userId: user.id,
        stockId: stock.id,
        stockName: stock.name,
        symbol: stock.symbol,
        quantity: qty,
        avgPrice: stock.price
      }
      holdings.push(holding)
    }

    trades.push({
      id: Date.now(),
      userId: user.id,
      stockId: stock.id,
      stockName: stock.name,
      symbol: stock.symbol,
      side: 'BUY',
      quantity: qty,
      price: stock.price,
      total: totalCost,
      profit: 0,
      timestamp: new Date().toISOString()
    })

    user.deposit -= totalCost
    recalcUserBalance(user)

    saveUsers(users)
    saveJson('./database/holdings.json', holdings)
    saveJson('./database/trades.json', trades)

    await notify(
      user.email,
      "Trade Executed",
      `Your BUY order for ${qty} units of ${stock.name} executed successfully.`
    )

    setToast(req, 'success', 'Stock bought successfully')
    res.redirect('/stocks')

  } catch {
    setToast(req, 'error', 'Error buying stock')
    res.redirect('/stocks')
  }
})

/* ===========================
SELL STOCK
=========================== */
app.post('/stocks/sell', requireLogin, requireSignalActive, async (req, res) => {
  try {
    const { stockId, quantity } = req.body
    const qty = Number(quantity)

    if (!qty || qty <= 0) {
      setToast(req, 'error', 'Invalid quantity')
      return res.redirect('/dashboard')
    }

    const users = loadUsers()
    const holdings = loadJson('./database/holdings.json', [])
    const trades = loadJson('./database/trades.json', [])
    const stocks = loadJson('./database/stocks.json', [])

    const user = users.find(u => u.id === req.session.user.id)
    const stock = stocks.find(s => s.id == stockId)

    if (!user || !stock) {
      setToast(req, 'error', 'Invalid stock')
      return res.redirect('/dashboard')
    }

    const holding = holdings.find(h => h.userId === user.id && h.stockId == stock.id)

    if (!holding) {
      setToast(req, 'error', 'You do not own this stock')
      return res.redirect('/dashboard')
    }

    if (holding.quantity < qty) {
      setToast(req, 'error', 'Not enough units')
      return res.redirect('/dashboard')
    }

    const totalSell = stock.price * qty
    const avgPrice = Number(holding.avgPrice)
    const profit = (stock.price - avgPrice) * qty

    holding.quantity -= qty
    if (holding.quantity === 0) {
      const i = holdings.indexOf(holding)
      holdings.splice(i, 1)
    }

    user.deposit = Number(user.deposit || 0) + totalSell
    user.profit = Number(user.profit || 0) + profit
    recalcUserBalance(user)

    trades.push({
      id: Date.now(),
      userId: user.id,
      stockId: stock.id,
      stockName: stock.name,
      symbol: stock.symbol,
      side: 'SELL',
      quantity: qty,
      price: stock.price,
      total: totalSell,
      profit: profit,
      timestamp: new Date().toISOString()
    })

    saveUsers(users)
    saveJson('./database/holdings.json', holdings)
    saveJson('./database/trades.json', trades)

    await notify(
      user.email,
      "Trade Executed",
      `Your SELL order for ${qty} units of ${stock.name} executed successfully.`
    )

    setToast(req, 'success', 'Stock sold successfully')
    res.redirect('/dashboard')

  } catch {
    setToast(req, 'error', 'Error selling stock')
    res.redirect('/dashboard')
  }
})

app.post('/trade/execute', requireLogin, requireSignalActive, (req, res) => {
const { side, symbol, amount, leverage } = req.body

const users = loadUsers()
const user = users.find(u => u.id === req.session.user.id)
if (!user) return res.redirect('/login')

const margin = Number(amount)
const lev = Number(leverage || 1)

if (margin <= 0 || lev <= 0) {
setToast(req, 'error', 'Invalid trade values')
return res.redirect('/dashboard')
}

if (user.deposit < margin) {
setToast(req, 'error', 'Insufficient funds')
return res.redirect('/dashboard')
}

const entry = getMarketPrice(symbol)
const size = margin * lev

user.deposit -= margin
if (!user.openPositions) user.openPositions = []

user.openPositions.push({
id: Date.now(),
symbol,
side,
margin,
leverage: lev,
size,
entryPrice: entry,
pnl: 0,
status: 'open',
openedAt: Date.now()
})

recalcUserBalance(user)
saveUsers(users)
req.session.user = user

setToast(req, 'success', 'Order executed')
res.redirect('/dashboard')
})

// Add price update loop for unrealized PnL.

setInterval(() => {
const users = loadUsers()

users.forEach(u => {
if (!Array.isArray(u.openPositions) || u.openPositions.length === 0) return

u.openPositions.forEach(p => {
  const price = getMarketPrice(p.symbol)

  if (p.side === 'buy') {
p.pnl = Number((((price - p.entryPrice) / p.entryPrice) * p.margin * p.leverage).toFixed(2))
} else {
p.pnl = Number((((p.entryPrice - price) / p.entryPrice) * p.margin * p.leverage).toFixed(2))
}
})
})
saveUsers(users)
}, 5000)

// Close trade route.

app.post('/trade/close', requireLogin, requireSignalActive, (req, res) => {
const { tradeId } = req.body

const users = loadUsers()
const user = users.find(u => u.id === req.session.user.id)
if (!user || !user.openPositions) return res.redirect('/dashboard')

const pos = user.openPositions.find(p => p.id == tradeId)
if (!pos) return res.redirect('/dashboard')

user.deposit += pos.margin
user.profit = Number(user.profit || 0) + pos.pnl

user.openPositions = user.openPositions.filter(p => p.id != tradeId)

recalcUserBalance(user)
saveUsers(users)
req.session.user = user

setToast(req, 'success', 'Trade closed')
res.redirect('/dashboard')
})

/* ===========================
KYC
=========================== */
app.get('/kyc-verification', requireLogin, (req, res) => {
  try {
    const kycRequests = loadJson('./database/kyc.json', []).filter(
      k => k.userId === req.session.user.id
    )

    res.render('kyc-verification', {
      user: req.session.user,
      kycRequests
    })

  } catch {
    setToast(req, 'error', 'Error loading KYC page')
    res.redirect('/dashboard')
  }
})

app.post(
'/kyc-verification',
requireLogin,
upload.fields([
{ name: 'idFront', maxCount: 1 },
{ name: 'idBack', maxCount: 1 }
]),
async (req, res) => {
  try {
    const { documentType, documentNumber, note } = req.body
    const idFront = req.files?.idFront?.[0]?.filename || null
    const idBack = req.files?.idBack?.[0]?.filename || null

    const kycRequests = loadJson('./database/kyc.json', [])
    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)

    const entry = {
id: Date.now(),
userId: user.id,
userName: user.username,
documentType,
documentNumber,
note,
idFront,
idBack,
status: 'pending',
createdAt: new Date().toISOString()
}

    kycRequests.push(entry)
    saveJson('./database/kyc.json', kycRequests)

    await notify(
      user.email,
      "KYC Submitted",
      "Your KYC submission is under review."
    )

    setToast(req, 'success', 'KYC submitted')
    res.redirect('/kyc-verification')

  } catch {
    setToast(req, 'error', 'Error submitting KYC')
    res.redirect('/kyc-verification')
  }
})

/* ===========================
PACKAGE HISTORY
=========================== */
app.get('/package-history', requireLogin, (req, res) => {
  const subs = loadJson('./database/subscriptions.json', []).filter(
    s => s.userId === req.session.user.id
  )

  res.render('package-history', {
    user: req.session.user,
    subs
  })
})

/* ===========================
DEPOSIT & WITHDRAWAL PAGE
=========================== */
app.get('/deposit-withdrawal', requireLogin, (req, res) => {
  try {
    const deposits = loadJson('./database/deposits.json', [])

    // Load deposit methods directly
    const depositMethods = loadJson('./database/depositMethods.json', [])
      .filter(m => m.enabled !== false)

    const userDeposits = deposits.filter(d => d.userId === req.session.user.id)

    res.render('deposit-withdrawal', {
      user: req.session.user,
      deposits: userDeposits,
      depositMethods
    })

  } catch {
    setToast(req, 'error', 'Error loading deposit page')
    res.redirect('/dashboard')
  }
})

/* ===========================
WITHDRAW PAGE
=========================== */
app.get('/withdraw', requireLogin, (req, res) => {
  try {
    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)

    const withdrawals = loadJson('./database/withdrawals.json', []).filter(
      w => w.userId === req.session.user.id
    )

    res.render('withdraw', {
      user,
      history: withdrawals
    })

  } catch {
    setToast(req, 'error', 'Error loading withdraw page')
    res.redirect('/dashboard')
  }
})

/* ===========================
SUBMIT WITHDRAWAL - FIXED
=========================== */
app.post('/withdraw', requireLogin, requireSignalActive, async (req, res) => {
  try {
    const {
      amount,
      network, 
      bankName,
      accountName,
      accountNumber,
      routingNumber
    } = req.body;

    const users = loadUsers()
    const withdrawals = loadJson('./database/withdrawals.json', [])
    const user = users.find(u => u.id === req.session.user.id)

    const amt = Number(amount)

    if (amt <= 0) {
      setToast(req, 'error', 'Invalid amount')
      return res.redirect('/withdraw')
    }

    // Check if user has enough profit
    if (user.profit < amt) {
      setToast(req, 'error', 'Insufficient profit balance for withdrawal')
      return res.redirect('/withdraw')
    }

    // ALL METHODS ARE NOW AVAILABLE - removed restriction
    // Only require bank details for BANK method
    if (network === 'BANK') {
      if (!bankName || !accountName || !accountNumber || !routingNumber) {
        setToast(req, 'error', 'Please enter complete bank details')
        return res.redirect('/withdraw')
      }
    }

    // Deduct from profit only (not deposit)
    user.profit = Number(user.profit || 0) - amt

    recalcUserBalance(user)

    withdrawals.push({
  id: Date.now(),
  userId: user.id,
  username: user.username,
  name: user.name,
  amount: amt,
  network,
  bankDetails: network === 'BANK' ? {
    bankName,
    accountName,
    accountNumber,
    routingNumber
  } : {},
  status: 'pending',
  date: new Date().toISOString()
})

    saveUsers(users)
    saveJson('./database/withdrawals.json', withdrawals)

    await notify(
      user.email,
      "Withdrawal Submitted",
      `Your withdrawal request of $${amt} via ${network} is pending review.`
    )

    setToast(req, 'success', 'Withdrawal submitted')
    res.redirect('/withdraw')

  } catch {
    setToast(req, 'error', 'Error processing withdrawal')
    res.redirect('/withdraw')
  }
})

/* ===========================
WITHDRAWAL HISTORY
=========================== */
app.get('/withdraw-history', requireLogin, (req, res) => {
  try {
    const userId = req.session.user.id

    const withdrawals = loadJson('./database/withdrawals.json', []).filter(
      w => w.userId === userId
    )

    const users = loadUsers()
    const user = users.find(u => u.id === userId)

    res.render('withdraw-history', {
      user,
      history: withdrawals
    })

  } catch {
    setToast(req, 'error', 'Error loading history')
    res.redirect('/dashboard')
  }
})

/* ===========================
PACKAGES
=========================== */
app.get('/packages', requireLogin, (req, res) => {
  const packages = [
    { name: "Starter", price: 500, profit: "5% weekly" },
    { name: "Standard", price: 1000, profit: "8% weekly" },
    { name: "Premium", price: 2000, profit: "12% weekly" },
    { name: "Advanced", price: 5000, profit: "15% weekly" },
    { name: "Gold", price: 10000, profit: "18% weekly" },
    { name: "Elite", price: 50000, profit: "20% weekly" }
  ]

  res.render('packages', {
    user: req.session.user,
    packages
  })
})

app.post('/packages/subscribe', requireLogin, async (req, res) => {
  const { price } = req.body

  const packages = [
    { name: "Starter", price: 500, profit: "5% weekly" },
    { name: "Standard", price: 1000, profit: "8% weekly" },
    { name: "Premium", price: 2000, profit: "12% weekly" },
    { name: "Advanced", price: 5000, profit: "15% weekly" },
    { name: "Gold", price: 10000, profit: "18% weekly" },
    { name: "Elite", price: 50000, profit: "20% weekly" }
  ]

  const selected = packages.find(p => p.price == price)
  if (!selected) {
    setToast(req, 'error', 'Package not found')
    return res.redirect('/packages')
  }

  const users = loadUsers()
  const user = users.find(u => u.id === req.session.user.id)

  if (user.deposit < selected.price) {
    setToast(req, 'error', 'Insufficient deposit funds')
    return res.redirect('/packages')
  }

  user.deposit -= selected.price
  recalcUserBalance(user)

  const subscriptions = loadJson('./database/subscriptions.json', [])
  subscriptions.push({
    id: Date.now(),
    userId: user.id,
    package: selected.name,
    price: selected.price,
    profit: selected.profit,
    date: new Date().toISOString()
  })

  saveUsers(users)
  saveJson('./database/subscriptions.json', subscriptions)

  await notify(
    user.email,
    "Package Activated",
    `Your ${selected.name} package is now active.`
  )

  setToast(req, 'success', 'Package subscribed')
  res.redirect('/packages')
})

/* ===========================
ACCOUNT SETTINGS
=========================== */
app.get('/account', requireLogin, (req, res) => {
  const users = loadUsers()
  const user = users.find(u => u.id === req.session.user.id)

  res.render('account', { user })
})

// UPDATED: Profile update route with better validation
app.post('/account/update', requireLogin, (req, res) => {
  const { name, username, phone, country } = req.body

  const users = loadUsers()
  const user = users.find(u => u.id === req.session.user.id)

  // Check if username is already taken (if it's being changed)
  if (username !== user.username) {
    const existingUser = users.find(u => u.username === username && u.id !== user.id)
    if (existingUser) {
      setToast(req, 'error', 'Username already taken')
      return res.redirect('/account')
    }
  }

  // Update user fields
  user.name = name || user.name
  user.username = username || user.username
  user.phone = phone || user.phone
  user.country = country || user.country

  saveUsers(users)

  // Update session with new data
  req.session.user.name = user.name
  req.session.user.username = user.username
  req.session.user.email = user.email

  setToast(req, 'success', 'Profile updated successfully')
  res.redirect('/account')
})

// ===========================
// COMPLETE ACCOUNT MANAGEMENT FIX
// ===========================

// UPDATE EMAIL ONLY ROUTE
app.post('/account/update-email', requireLogin, (req, res) => {
  try {
    const { newEmail, password } = req.body

    // Validation
    if (!newEmail || !password) {
      setToast(req, 'error', 'Email and password are required')
      return res.redirect('/account')
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setToast(req, 'error', 'Please enter a valid email address')
      return res.redirect('/account')
    }

    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)

    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/login')
    }

    // Verify password (supports both plain text and bcrypt)
    let passwordValid = false
    
    if (user.password === password) {
      passwordValid = true
    } else {
      try {
        passwordValid = bcrypt.compareSync(password, user.password)
      } catch (err) {
        passwordValid = false
      }
    }

    if (!passwordValid) {
      setToast(req, 'error', 'Password is incorrect')
      return res.redirect('/account')
    }

    // Check if email is already taken by another user
    const existingUser = users.find(u => u.email === newEmail && u.id !== user.id)
    if (existingUser) {
      setToast(req, 'error', 'Email is already registered to another account')
      return res.redirect('/account')
    }

    // Update email
    const oldEmail = user.email
    user.email = newEmail

    // Save users
    saveUsers(users)

    // Update session with new email
    req.session.user.email = newEmail

    // Force session save
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err)
      }

      // Send notification to old email
      try {
        notify(
          oldEmail,
          "Email Address Changed",
          `Your email address has been changed from ${oldEmail} to ${newEmail}. If you didn't make this change, please contact support immediately.`
        )
      } catch (emailErr) {
        console.error('Failed to send email notification:', emailErr)
      }

      // Send notification to new email
      try {
        notify(
          newEmail,
          "Email Address Changed",
          `Your email address has been successfully changed to ${newEmail}. This is now your login email.`
        )
      } catch (emailErr) {
        console.error('Failed to send email notification:', emailErr)
      }

      setToast(req, 'success', 'Email updated successfully')
      res.redirect('/account')
    })

  } catch (error) {
    console.error('Email update error:', error)
    setToast(req, 'error', 'Error updating email')
    res.redirect('/account')
  }
})

// FIXED PASSWORD CHANGE ROUTE - Supports both plain text and hashed passwords
app.post('/account/change-password', requireLogin, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast(req, 'error', 'All password fields are required')
      return res.redirect('/account')
    }

    if (newPassword !== confirmPassword) {
      setToast(req, 'error', 'New passwords do not match')
      return res.redirect('/account')
    }

    if (newPassword.length < 6) {
      setToast(req, 'error', 'Password must be at least 6 characters')
      return res.redirect('/account')
    }

    // Load users
    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)

    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/login')
    }

    // VERIFY CURRENT PASSWORD - Check both plain text and bcrypt
    let passwordValid = false
    
    // Check if it's plain text match
    if (user.password === currentPassword) {
      passwordValid = true
    } else {
      // Check if it's bcrypt hash
      try {
        passwordValid = await bcrypt.compare(currentPassword, user.password)
      } catch (err) {
        console.error('Bcrypt comparison error:', err)
        passwordValid = false
      }
    }

    if (!passwordValid) {
      setToast(req, 'error', 'Current password is incorrect')
      return res.redirect('/account')
    }

    // Update to new password (store as plain text since you don't want hashing)
    user.password = newPassword

    // Save updated user data
    saveUsers(users)

    // Send email notification
    try {
      await notify(
        user.email,
        "Password Changed",
        "Your account password was successfully changed. If you didn't make this change, please contact support immediately."
      )
    } catch (emailErr) {
      console.error('Failed to send password change email:', emailErr)
    }

    // DESTROY SESSION - Force logout so user must login with new password
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err)
      }
      
      // Redirect to login with success message in query parameter
      res.redirect('/login?passwordChanged=true')
    })

  } catch (error) {
    console.error('Password change error:', error)
    setToast(req, 'error', 'Error changing password')
    res.redirect('/account')
  }
})

/* ===========================
SUPPORT
=========================== */
app.get('/support', requireLogin, (req, res) => {
  res.render('support', { user: req.session.user })
})

app.post('/support', requireLogin, async (req, res) => {
  const { subject, message } = req.body

  const users = loadUsers()
  const user = users.find(u => u.id === req.session.user.id)

  await notify(
    user.email,
    "Support Ticket Created",
    "Your support request has been received. Our team will respond shortly."
  )

  setToast(req, 'success', 'Ticket submitted')
  res.redirect('/support')
})

/* ===========================
SUBMIT DEPOSIT
=========================== */
app.post('/deposit', requireLogin, upload.single('proof'), async (req, res) => {
  try {
    const { amount, method } = req.body

    if (!amount || amount <= 0) {
      setToast(req, 'error', 'Invalid amount')
      return res.redirect('/deposit-withdrawal')
    }

    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)

    const depositMethods = loadJson('./database/depositMethods.json', [])
    const methodCfg = depositMethods.find(m => m.name === method && m.enabled !== false)

    if (!methodCfg) {
      setToast(req, 'error', 'Method not available')
      return res.redirect('/deposit-withdrawal')
    }

    const deposits = loadJson('./database/deposits.json', [])
    const proofUrl = req.file ? '/uploads/' + req.file.filename : ''

    deposits.push({
      id: Date.now(),
      userId: user.id,
      username: user.username,
      amount: Number(amount),
      method,
      status: 'pending',
      proofUrl,
      createdAt: new Date().toISOString()
    })

    saveJson('./database/deposits.json', deposits)

    await notify(
      user.email,
      "Deposit Submitted",
      `Your deposit of $${amount} is pending approval.`
    )

    setToast(req, 'success', 'Deposit submitted')
    res.redirect('/deposit-withdrawal')

  } catch {
    setToast(req, 'error', 'Error processing deposit')
    res.redirect('/deposit-withdrawal')
  }
})

app.get('/pl-record', requireLogin, (req, res) => {
  const holdings = loadJson('./database/holdings.json', [])
    .filter(h => h.userId === req.session.user.id)

  let totalProfit = 0

  holdings.forEach(h => {
    const stocks = loadJson('./database/stocks.json', [])
    const stock = stocks.find(s => s.id == h.stockId)
    if (!stock) return

    const diff = (Number(stock.price) - Number(h.avgPrice)) * Number(h.quantity)
    totalProfit += diff
  })

  res.render('pl-record', {
    user: req.session.user,
    holdings,
    totalProfit
  })
})

app.get('/trading-history', requireLogin, (req, res) => {
  const trades = loadJson('./database/trades.json', [])
    .filter(t => t.userId === req.session.user.id)

  res.render('trading-history', {
    user: req.session.user,
    trades
  })
})

app.get('/transactions-history', requireLogin, (req, res) => {
  const deposits = loadJson('./database/deposits.json', [])
    .filter(x => x.userId === req.session.user.id)

  const withdrawals = loadJson('./database/withdrawals.json', [])
    .filter(x => x.userId === req.session.user.id)

  const transactions = [...deposits, ...withdrawals]

  res.render('transactions-history', {
    user: req.session.user,
    transactions
  })
})

/* ===========================
ADMIN SECTION
=========================== */
function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    console.log('Admin access denied: No admin session')
    return res.redirect('/admin-login')
  }
  next()
}

app.get('/admin-login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin')
  res.render('admin-login')
})

app.post('/admin-login', adminLimit, async (req, res) => {
  try {
    console.log("ADMIN LOGIN REQUEST:", req.body)
    const { username, password } = req.body
    
    console.log("ADMIN LOGIN ATTEMPT FOR USERNAME:", username)

    const users = loadUsers()
    console.log("Total users in database:", users.length)
    
    const adminUser = users.find(u => u.role === 'admin' && u.username === username)
    console.log("FOUND ADMIN USER:", adminUser)

    if (!adminUser) {
      console.log("NO ADMIN FOUND FOR:", username)
      logAdminAction(req, 'failed_admin_login', { username, ip: getClientIp(req) })
      setToast(req, 'error', 'Invalid login')
      return res.redirect('/admin-login')
    }

    // Check if admin user has a password
    if (!adminUser.password) {
      console.log("ADMIN HAS NO PASSWORD SET - FIRST TIME LOGIN")
      // First time login - set the password
      if (password) {
        adminUser.password = password // Plain text password
        saveUsers(users)
        console.log("Password set for admin:", username)
      } else {
        setToast(req, 'error', 'Please set a password')
        return res.redirect('/admin-login')
      }
    } else {
      // Verify existing password (supports both plain text and bcrypt)
      let passwordValid = false
      
      if (adminUser.password === password) {
        passwordValid = true
      } else {
        try {
          passwordValid = await bcrypt.compare(password, adminUser.password)
        } catch (err) {
          passwordValid = false
        }
      }
      
      if (!passwordValid) {
        console.log("PASSWORD WRONG FOR:", username)
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
      
      console.log("ADMIN LOGIN SUCCESS:", adminUser.username)
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

app.get('/admin-logout', (req, res) => {
  logAdminAction(req, 'admin_logout', { username: req.session.admin?.username })
  req.session.destroy((err) => {
    if (err) {
      console.error('Admin logout error:', err)
    }
    res.redirect('/admin-login')
  })
})

app.get('/admin', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const users = loadUsers()
    const withdrawals = loadJson('./database/withdrawals.json', [])
    const deposits = loadJson('./database/deposits.json', [])
    const kycRequests = loadJson('./database/kyc.json', [])

    // Calculate stats
    const totalUsers = users.length
    const totalBalance = users.reduce((sum, user) => sum + (Number(user.balance) || 0), 0)
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length
    const pendingDeposits = deposits.filter(d => d.status === 'pending').length
    const pendingKyc = kycRequests.filter(k => k.status === 'pending').length

    res.render('admin-dashboard', {
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

app.get('/admin/users', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const users = loadUsers()
    res.render('admin-users', { admin: req.session.admin, users })
  } catch (error) {
    setToast(req, 'error', 'Error loading users')
    res.redirect('/admin')
  }
})

app.post('/admin/user/:id/login', requireAdmin, requireAdminIP, (req, res) => {
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

app.post('/admin/return', requireAdmin, (req, res) => {
  delete req.session.user

  req.session.save(() => {
    res.redirect('/admin')
  })
})


app.get('/admin/user/:id/balance', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const users = loadUsers()
    const user = users.find(u => u.id == req.params.id)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/users')
    }

    res.render('admin-edit-balance', { admin: req.session.admin, user })

  } catch (error) {
    setToast(req, 'error', 'Error loading user')
    res.redirect('/admin/users')
  }
})

app.post('/admin/user/:id/balance', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const users = loadUsers()
    const user = users.find(u => u.id == req.params.id)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/users')
    }

    const { balance, profit, bonus, deposit } = req.body

    user.deposit = Number(deposit)
    user.profit = Number(profit)
    user.bonus = Number(bonus)

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

app.post('/admin/user/:id/delete', requireAdmin, requireAdminIP, (req, res) => {
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

app.post('/admin/user/:id/signal', requireAdmin, requireAdminIP, (req, res) => {
  const users = loadUsers()
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

app.get('/admin/withdrawals', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const withdrawals = loadJson('./database/withdrawals.json', [])
    res.render('admin-withdrawals', { admin: req.session.admin, withdrawals })
  } catch (error) {
    setToast(req, 'error', 'Error loading withdrawals')
    res.redirect('/admin')
  }
})

app.post('/admin/withdraw/approve', requireAdmin, requireAdminIP, (req, res) => {
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
app.post('/admin/withdraw/reject', requireAdmin, requireAdminIP, (req, res) => {
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

app.get('/admin/deposits', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const deposits = loadJson('./database/deposits.json', [])
    res.render('admin-deposits', { deposits })
  } catch (error) {
    setToast(req, 'error', 'Error loading deposits')
    res.redirect('/admin')
  }
})

app.get('/admin/deposit/add', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const users = loadUsers()
    res.render('admin-add-deposit', { users })
  } catch (error) {
    setToast(req, 'error', 'Error loading add deposit page')
    res.redirect('/admin')
  }
})

app.post('/admin/deposit/add', requireAdmin, requireAdminIP, (req, res) => {
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
      userId,
      userName: user.username,
      amount: Number(amount),
      method,
      status: 'approved',
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

app.post('/admin/deposit/approve', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const { id } = req.body

    const deposits = loadJson('./database/deposits.json', [])
    const users = loadUsers()

    const dep = deposits.find(d => d.id == id)
    if (!dep) {
      setToast(req, 'error', 'Deposit not found')
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

app.post('/admin/deposit/reject', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const { id } = req.body

    const deposits = loadJson('./database/deposits.json', [])
    const dep = deposits.find(d => d.id == id)
    if (!dep) {
      setToast(req, 'error', 'Deposit not found')
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

app.get('/admin/profile', requireAdmin, requireAdminIP, (req, res) => {
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

    res.render('admin-profile', {
      admin: req.session.admin,
      adminUser
    })

  } catch (error) {
    setToast(req, 'error', 'Error loading admin profile')
    res.redirect('/admin')
  }
})

// FIXED: Admin profile update route - Supports both plain text and bcrypt
app.post('/admin/profile', requireAdmin, requireAdminIP, async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body
    console.log("ADMIN PROFILE UPDATE REQUEST:", { username, hasNewPassword: !!newPassword, hasCurrentPassword: !!currentPassword })
    
    const users = loadUsers()

    let adminUser = null

    // Find admin user by session ID
    if (req.session.admin && req.session.admin.id) {
      adminUser = users.find(u => u.id == req.session.admin.id && u.role === 'admin')
      console.log("Found admin by session ID:", adminUser?.username)
    }

    // If not found, find any admin
    if (!adminUser) {
      adminUser = users.find(u => u.role === 'admin')
      console.log("Found admin by role:", adminUser?.username)
    }

    if (!adminUser) {
      console.error("No admin user found in database")
      setToast(req, 'error', 'Admin user not found in database')
      return res.redirect('/admin/profile')
    }

    console.log("Admin user found:", {
      id: adminUser.id,
      username: adminUser.username,
      hasPassword: !!adminUser.password
    })

    // Update username if changed
    if (username && username !== adminUser.username) {
      // Check if username is already taken
      const existingUser = users.find(u => u.username === username && u.id !== adminUser.id)
      if (existingUser) {
        setToast(req, 'error', 'Username already taken')
        return res.redirect('/admin/profile')
      }
      
      console.log(`Username changed from ${adminUser.username} to ${username}`)
      adminUser.username = username
      
      // Update session
      req.session.admin.username = username
    }

    // If new password is provided
    if (newPassword && newPassword.trim()) {
      console.log("Password change requested")
      
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
          console.log("Current password incorrect")
          setToast(req, 'error', 'Current password is incorrect')
          return res.redirect('/admin/profile')
        }
        
        console.log("Current password verified")
      } else {
        // No existing password (first-time setup), current password not required
        console.log("No existing password found (first-time setup)")
      }

      // Validate new password length
      if (newPassword.length < 6) {
        setToast(req, 'error', 'Password must be at least 6 characters')
        return res.redirect('/admin/profile')
      }

      // Set new password (store as plain text)
      adminUser.password = newPassword
      console.log("Password set")
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

app.get('/admin/kyc', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const kycRequests = loadJson('./database/kyc.json', [])
    const users = loadUsers()

    res.render('admin-kyc', {
      admin: req.session.admin,
      kycRequests,
      users
    })

  } catch (error) {
    setToast(req, 'error', 'Error loading KYC requests')
    res.redirect('/admin')
  }
})

app.post('/admin/kyc/approve', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const { id } = req.body

    const kycRequests = loadJson('./database/kyc.json', [])
    const users = loadUsers()

    const request = kycRequests.find(k => k.id == id)
    if (!request) {
      setToast(req, 'error', 'Request not found')
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

app.post('/admin/kyc/reject', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const { id } = req.body

    const kycRequests = loadJson('./database/kyc.json', [])
    const users = loadUsers()

    const request = kycRequests.find(k => k.id == id)
    if (!request) {
      setToast(req, 'error', 'Request not found')
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

app.get('/admin/deposit-methods', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const methods = loadJson('./database/depositMethods.json', [])
    res.render('admin-deposit-methods', {
      admin: req.session.admin,
      methods
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading deposit methods')
    res.redirect('/admin')
  }
})

app.post('/admin/deposit-methods/add', requireAdmin, requireAdminIP, (req, res) => {
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

app.post('/admin/deposit-methods/edit', requireAdmin, requireAdminIP, (req, res) => {
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

app.post('/admin/deposit-methods/delete', requireAdmin, requireAdminIP, (req, res) => {
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

const paymentFile = './database/paymentInstructions.json'

app.get('/admin/payment-settings', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const methods = loadJson('./database/depositMethods.json', [])
    res.render('admin-payment-settings', { admin: req.session.admin, methods })
  } catch (error) {
    setToast(req, 'error', 'Error loading payment methods')
    res.redirect('/admin')
  }
})

app.post('/admin/payment-settings', requireAdmin, requireAdminIP, (req, res) => {
  try {
    const { usdt, btc, cashapp, chime, paypal, giftcard } = req.body

    const data = {
      Crypto: {
        usdt,
        btc
      },
      CashApp: cashapp,
      Chime: chime,
      PayPal: paypal,
      Giftcard: giftcard
    }

    saveJson(paymentFile, data)
    setToast(req, 'success', 'Payment instructions updated')
    res.redirect('/admin/payment-settings')

  } catch (error) {
    setToast(req, 'error', 'Error saving payment settings')
    res.redirect('/admin/payment-settings')
  }
})

// Database recovery endpoint (admin only)
app.get('/admin/database/recovery', requireAdmin, requireAdminIP, (req, res) => {
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
    
    res.render('admin-database-recovery', {
      admin: req.session.admin,
      databases: status
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading database recovery')
    res.redirect('/admin')
  }
})

app.post('/admin/database/restore', requireAdmin, requireAdminIP, (req, res) => {
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