require('dotenv').config()
const express = require('express')
const path = require('path')
const session = require('express-session')
const fs = require('fs')
const { loadUsers, saveUsers } = require('./database/database')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const app = express()

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20
})

const uploadDir = path.join(__dirname, 'public', 'uploads')
const equityHistoryPath = path.join(__dirname, "data", "equityHistory.json")

function loadEquity() {
  try { return JSON.parse(fs.readFileSync(equityHistoryPath)) }
  catch { return [] }
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

// -----------------------------------------------------
// CONFIG
// -----------------------------------------------------
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
)

// expose toast to all views
app.use((req, res, next) => {
  res.locals.toast = req.session.toast || null
  delete req.session.toast
  next()
})
const PORT = process.env.PORT || 3000
app.listen(PORT, "0.0.0.0", () => {
console.log("Server started")
})

// -----------------------------------------------------
// HELPERS
// -----------------------------------------------------
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login')
  next()
}

function loadJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw.trim()) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    return false
  }
}

function logTransaction(userId, type, amount, method) {
  const transactions = loadJson('./database/transactions.json', []);

  transactions.push({
    id: Date.now(),
    userId,
    type,          // deposit or withdrawal
    amount: Number(amount),
    method,        // cashapp, paypal, crypto, etc
    date: new Date().toISOString()
  });

  saveJson('./database/transactions.json', transactions);
}

function setToast(req, type, message) {
  req.session.toast = { type, message }
}

// -----------------------------------------------------
// LIVE STOCK PRICE SIMULATOR
// -----------------------------------------------------
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
  } catch (error) {
  }
}, 10000)

app.get('/api/stocks', (req, res) => {
  try {
    const stocks = loadJson('./database/stocks.json', [])
    res.json(stocks)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load stocks' })
  }
})

/* ===========================
   COPY TRADER AUTO PROFIT
=========================== */
setInterval(() => {
  try {
    const following = loadJson('./database/following.json', [])
    const users = loadUsers()

    following.forEach(f => {
      const user = users.find(u => u.id === f.userId)
      if (!user) return

      const profitRate = (Math.random() * 0.01 + 0.005) / 100
      const profit = Number((user.balance * profitRate).toFixed(2))

      user.balance += profit
      user.profit = Number(user.profit || 0) + profit

      f.lastProfit = profit
      f.updatedAt = new Date().toISOString()
    })

    saveUsers(users)
    saveJson('./database/following.json', following)
  } catch (error) {
  }
}, 15000)

// -----------------------------------------------------
// AUTH ROUTES
// -----------------------------------------------------
app.get('/', (req, res) => res.render('index'))

app.get('/signup', (req, res) => res.render('signup'))

app.post('/signup', authLimit, (req, res) => {
  try {
    const { username, name, email, phone, country, password } = req.body
    const users = loadUsers()

    if (users.find(u => u.username === username)) {
      setToast(req, 'error', 'Username already exists')
      return res.redirect('/signup')
    }

    users.push({
      id: Date.now(),
      username,
      name,
      email,
      phone,
      country,
      password,
      balance: 0,
      profit: 0,
      bonus: 0,
      deposit: 0
    })

    saveUsers(users)
    setToast(req, 'success', 'Account created, please login.')
    res.redirect('/login')
  } catch (error) {
    setToast(req, 'error', 'Error creating account')
    res.redirect('/signup')
  }
})

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard')
  res.render('login')
})

app.post('/login', authLimit, (req, res) => {
  try {
    const { username, password } = req.body
    const users = loadUsers()

    const user = users.find(u => u.username === username && u.password === password)
    if (!user) {
      setToast(req, 'error', 'Invalid username or password')
      return res.redirect('/login')
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      name: user.name
    }

    setToast(req, 'success', 'Login successful')
    res.redirect('/dashboard')
  } catch (error) {
    setToast(req, 'error', 'Login error')
    res.redirect('/login')
  }
})

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'))
})

// -----------------------------------------------------
// DASHBOARD
// -----------------------------------------------------
app.get('/dashboard', requireLogin, (req, res) => {
  const users = loadUsers();
  const holdings = loadJson('./database/holdings.json', []);
  const trades = loadJson('./database/trades.json', []);
  const subscriptions = loadJson('./database/subscriptions.json', []);
  const stocks = loadJson('./database/stocks.json', []);

  const user = users.find(u => u.id === req.session.user.id);

  if (!user) {
    setToast(req, 'error', 'User not found');
    return res.redirect('/login');
  }

  user.deposit = Number(user.deposit) || 0;
  user.balance = Number(user.balance) || 0;
  user.profit = Number(user.profit) || 0;

  const userHoldings = holdings.filter(h => h.userId === user.id);
  const userTrades = trades.filter(t => t.userId === user.id);
  const userSubscriptions = subscriptions.filter(s => s.userId === user.id);

  const openTrades = userHoldings.length;

  // REAL TOTAL P L
  let totalPL = 0;
  userHoldings.forEach(h => {
    const stock = stocks.find(s => s.id == h.stockId);
    if (!stock) return;

    const currentPrice = Number(stock.price);
    const avgPrice = Number(h.avgPrice);
    const qty = Number(h.quantity);

    const pl = (currentPrice - avgPrice) * qty;
    totalPL += pl;
  });

  res.render('dashboard', {
    user: {
      ...req.session.user,
      balance: user.balance,
      deposit: user.deposit,
      profit: user.profit,
      bonus: user.bonus,
      kycStatus: user.kycStatus || "Not Verified"
    },
    openTrades,
    totalPL,
    subscriptions: userSubscriptions,
    holdings: userHoldings,
    trades: userTrades
  });
});



// -----------------------------------------------------
// COPY TRADER
// -----------------------------------------------------
app.get('/copy-trader', requireLogin, (req, res) => {
  try {
    const traders = loadJson('./database/copytraders.json', [])
    res.render('copytrader', { user: req.session.user, traders })
  } catch (error) {
    setToast(req, 'error', 'Error loading copy traders')
    res.redirect('/dashboard')
  }
})

app.post('/copy-trader/follow', requireLogin, (req, res) => {
  try {
    const { traderId } = req.body
    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)
    user.balance = Number(user.balance)


    const traders = loadJson('./database/copytraders.json', [])
    const trader = traders.find(t => t.id == traderId)

    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/copy-trader')
    }
    if (!trader) {
      setToast(req, 'error', 'Trader not found')
      return res.redirect('/copy-trader')
    }

    if (user.balance < 300) {
      setToast(req, 'error', 'You need at least $300 to copy a trader')
      return res.redirect('/copy-trader')
    }

    const following = loadJson('./database/following.json', [])
    const exists = following.find(f => f.userId === user.id && f.traderId === trader.id)

    if (exists) {
      setToast(req, 'info', 'You are already copying this trader')
      return res.redirect('/copy-trader')
    }

    following.push({
      id: Date.now(),
      userId: user.id,
      traderId: trader.id,
      traderName: trader.name,
      startedAt: new Date().toISOString()
    })

    saveJson('./database/following.json', following)
    saveUsers(users)

    setToast(req, 'success', 'Copy Trader activated successfully')
    res.redirect('/copy-trader')
  } catch (error) {
    setToast(req, 'error', 'Error following trader')
    res.redirect('/copy-trader')
  }
})

// -----------------------------------------------------
// STOCKS & TRADING
// -----------------------------------------------------
app.get('/stocks', requireLogin, (req, res) => {
  try {
    const stocks = loadJson('./database/stocks.json', [])
    res.render('stocks', { user: req.session.user, stocks })
  } catch (error) {
    setToast(req, 'error', 'Error loading stocks')
    res.redirect('/dashboard')
  }
})

app.get('/subscription-trade', requireLogin, (req, res) => {
  const stocks = loadJson('./database/stocks.json', [])
  res.render('stocks', { user: req.session.user, stocks })
})

app.post('/stocks/buy', requireLogin, (req, res) => {
  try {
    const { stockId, quantity } = req.body;
    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      setToast(req, 'error', 'Invalid quantity');
      return res.redirect('/stocks');
    }

    const stocks = loadJson('./database/stocks.json', []);
    const users = loadUsers();
    const holdings = loadJson('./database/holdings.json', []);
    const trades = loadJson('./database/trades.json', []);

    const user = users.find(u => u.id === req.session.user.id);
    const stock = stocks.find(s => s.id == stockId);

    if (!user) {
      setToast(req, 'error', 'User not found');
      return res.redirect('/stocks');
    }
    if (!stock) {
      setToast(req, 'error', 'Stock not found');
      return res.redirect('/stocks');
    }

    // Force numbers
    user.deposit = Number(user.deposit);
    stock.price = Number(stock.price);

    const totalCost = stock.price * qty;

    // CHECK DEPOSIT ONLY
    if (user.deposit < totalCost) {
      setToast(req, 'error', 'Insufficient deposit funds');
      return res.redirect('/stocks');
    }

    // Update or create holding
    let holding = holdings.find(h => h.userId === user.id && h.stockId === stock.id);

    if (holding) {
      const oldTotal = holding.avgPrice * holding.quantity;
      const newTotal = stock.price * qty;
      const newQty = holding.quantity + qty;
      holding.avgPrice = (oldTotal + newTotal) / newQty;
      holding.quantity = newQty;
    } else {
      holding = {
        id: Date.now(),
        userId: user.id,
        stockId: stock.id,
        stockName: stock.name,
        symbol: stock.symbol,
        quantity: qty,
        avgPrice: stock.price
      };
      holdings.push(holding);
    }

    // Log trade
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
    });

    // Subtract from deposit
    user.deposit -= totalCost;

    // Save
    saveUsers(users);
    saveJson('./database/holdings.json', holdings);
    saveJson('./database/trades.json', trades);

    setToast(req, 'success', 'Stock purchased successfully');
    res.redirect('/stocks');

  } catch (error) {
    setToast(req, 'error', 'Error buying stock');
    res.redirect('/stocks');
  }
});
app.post("/stocks/sell", requireLogin, (req, res) => {
  try {
    const { stockId, quantity } = req.body;
    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      setToast(req, 'error', 'Invalid quantity');
      return res.redirect('/dashboard');
    }

    const users = loadUsers();
    const holdings = loadJson('./database/holdings.json', []);
    const trades = loadJson('./database/trades.json', []);
    const stocks = loadJson('./database/stocks.json', []);

    const user = users.find(u => u.id === req.session.user.id);
    if (!user) {
      setToast(req, 'error', 'User not found');
      return res.redirect('/dashboard');
    }

    const stock = stocks.find(s => s.id == stockId);
    if (!stock) {
      setToast(req, 'error', 'Stock not found');
      return res.redirect('/dashboard');
    }

    stock.price = Number(stock.price);

    // Check holding
    const holding = holdings.find(h => h.userId === user.id && h.stockId == stock.id);

    if (!holding) {
      setToast(req, 'error', 'You do not own this stock');
      return res.redirect('/dashboard');
    }

    if (holding.quantity < qty) {
      setToast(req, 'error', 'Not enough units to sell');
      return res.redirect('/dashboard');
    }

    // Calculate earnings
    const totalSell = stock.price * qty;
    const avgPrice = Number(holding.avgPrice);
    const profit = (stock.price - avgPrice) * qty;

    // Update holding
    holding.quantity -= qty;

    if (holding.quantity === 0) {
      // remove completely
      const index = holdings.indexOf(holding);
      holdings.splice(index, 1);
    }

    // Add money to user's balance
    user.balance = Number(user.balance || 0) + totalSell;

    // Save closed trade
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
    });

    // Save changes
    saveUsers(users);
    saveJson('./database/holdings.json', holdings);
    saveJson('./database/trades.json', trades);

    setToast(req, 'success', 'Stock sold successfully');
    res.redirect('/dashboard');

  } catch (error) {
    setToast(req, 'error', 'Error selling stock');
    res.redirect('/dashboard');
  }
});


// USER KYC VERIFICATION
app.get('/kyc-verification', requireLogin, (req, res) => {
  try {
    const kycRequests = loadJson('./database/kyc.json', [])
      .filter(k => k.userId === req.session.user.id)

    res.render('kyc-verification', {
      user: req.session.user,
      kycRequests
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading KYC page')
    res.redirect('/dashboard')
  }
})

app.post('/kyc-verification', requireLogin, (req, res) => {
  try {
    const { documentType, documentNumber, note } = req.body

    const kycRequests = loadJson('./database/kyc.json', [])
    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)

    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/kyc-verification')
    }

    const entry = {
      id: Date.now(),
      userId: user.id,
      userName: user.username,
      documentType,
      documentNumber,
      note,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    kycRequests.push(entry)
    saveJson('./database/kyc.json', kycRequests)

    setToast(req, 'success', 'KYC submitted, awaiting review')
    res.redirect('/kyc-verification')
  } catch (error) {
    setToast(req, 'error', 'Error submitting KYC')
    res.redirect('/kyc-verification')
  }
})
app.get('/package-history', requireLogin, (req, res) => {
  const subs = loadJson('./database/subscriptions.json', [])
    .filter(s => s.userId === req.session.user.id)

  res.render('package-history', {
    user: req.session.user,
    subs
  })
})

// -----------------------------------------------------
// P/L PAGES
// -----------------------------------------------------
app.get('/pl-record', requireLogin, (req, res) => {
  try {
    const trades = loadJson('./database/trades.json', [])
      .filter(t => t.userId === req.session.user.id)

    const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0)

    res.render('pl-record', {
      user: req.session.user,
      trades,
      totalProfit
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading P/L record')
    res.redirect('/dashboard')
  }
})

app.get('/trading-history', requireLogin, (req, res) => {
  try {
    const trades = loadJson('./database/trades.json', [])
      .filter(t => t.userId === req.session.user.id)

    res.render('trading-history', {
      user: req.session.user,
      trades
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading trading history')
    res.redirect('/dashboard')
  }
})

// -----------------------------------------------------
// TRANSACTIONS HISTORY
// -----------------------------------------------------
app.get('/transactions-history', requireLogin, (req, res) => {
  try {
    const userId = req.session.user.id

    const deposits = loadJson('./database/deposits.json', [])
      .filter(d => d.userId === userId)

    const withdrawals = loadJson('./database/withdrawals.json', [])
      .filter(w => w.userId === userId)

    const following = loadJson('./database/following.json', [])
      .filter(f => f.userId === userId)

    const followingTx = following.map(f => ({
      type: 'copy-trade',
      amount: f.lastProfit || 0,
      status: 'profit',
      date: f.updatedAt || f.startedAt
    }))

    const all = [
      ...deposits.map(d => ({
        type: 'deposit',
        amount: d.amount,
        status: d.status,
        date: d.createdAt || d.date
      })),
      ...withdrawals.map(w => ({
        type: 'withdrawal',
        amount: w.amount,
        status: w.status,
        date: w.date
      })),
      ...followingTx
    ].sort((a, b) => new Date(b.date) - new Date(a.date))

    res.render('transactions-history', {
      user: req.session.user,
      transactions: all
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading transactions history')
    res.redirect('/dashboard')
  }
})

app.get('/deposit-withdrawal', requireLogin, (req, res) => {
  try {
    const deposits = loadJson('./database/deposits.json', [])
    const instructions = loadJson('./database/paymentInstructions.json', {})
    const depositMethods = loadJson('./database/depositMethods.json', [])
      .filter(m => m.enabled !== false)

    const userDeposits = deposits.filter(d => d.userId === req.session.user.id)

    res.render('deposit-withdrawal', {
      user: req.session.user,
      deposits: userDeposits,
      instructions,
      depositMethods
    })
  } catch (error) {
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
    const fullUser = users.find(u => u.id === req.session.user.id)

    const withdrawals = loadJson('./database/withdrawals.json', [])
      .filter(w => w.userId === req.session.user.id)

    res.render('withdraw', { 
      user: fullUser,
      history: withdrawals
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading withdraw page')
    res.redirect('/dashboard')
  }
})


/* ===========================
   WITHDRAW SUBMISSION
=========================== */
app.post('/withdraw', requireLogin, (req, res) => {
  try {
    const { amount, wallet, network } = req.body

    const users = loadUsers()
    const withdrawals = loadJson('./database/withdrawals.json', [])

    const user = users.find(u => u.id === req.session.user.id)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/withdraw')
    }

    const amt = Number(amount)

    if (amt <= 0 || amt > user.balance) {
      setToast(req, 'error', 'Invalid withdrawal amount')
      return res.redirect('/withdraw')
    }

    withdrawals.push({
      id: Date.now(),
      userId: user.id,
      amount: amt,
      wallet,
      network,
      status: 'pending',
      date: new Date().toISOString()
    })

    user.balance -= amt

    saveUsers(users)
    saveJson('./database/withdrawals.json', withdrawals)

    setToast(req, 'success', 'Withdrawal submitted and pending approval')
    res.redirect('/withdraw')
  } catch (error) {
    setToast(req, 'error', 'Error processing withdrawal')
    res.redirect('/withdraw')
  }
})

/* ===========================
   USER WITHDRAWAL HISTORY
=========================== */
app.get('/withdraw-history', requireLogin, (req, res) => {
  try {
    const userId = req.session.user.id

    const withdrawals = loadJson('./database/withdrawals.json', [])
      .filter(w => w.userId === userId)

    const users = loadUsers()
    const fullUser = users.find(u => u.id === userId)

    res.render('withdraw-history', {
      user: fullUser,
      history: withdrawals
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading withdrawal history')
    res.redirect('/dashboard')
  }
})

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

app.get('/account', requireLogin, (req, res) => {
  const users = loadUsers()
  const user = users.find(u => u.id === req.session.user.id)

  if (!user) {
    setToast(req, 'error', 'User not found')
    return res.redirect('/dashboard')
  }

  res.render('account', { user })
})

app.post('/account/update', requireLogin, (req, res) => {
  const { name, username, phone, country } = req.body

  const users = loadUsers()
  const user = users.find(u => u.id === req.session.user.id)

  if (!user) {
    setToast(req, 'error', 'User not found')
    return res.redirect('/account')
  }

  user.name = name
  user.username = username
  user.phone = phone
  user.country = country

  saveUsers(users)

  setToast(req, 'success', 'Profile updated')
  res.redirect('/account')
})



app.get('/support', requireLogin, (req, res) => {
  res.render('support', { user: req.session.user })
})
app.post('/support', requireLogin, (req, res) => {
const { subject, message } = req.body
setToast(req, 'success', 'Support ticket submitted')
res.redirect('/support')
})
app.post('/deposit', requireLogin, upload.single('proof'), (req, res) => {
  try {
    const { amount, method } = req.body

    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/deposit-withdrawal')
    }

    const depositMethods = loadJson('./database/depositMethods.json', [])
    const methodCfg = depositMethods.find(m => m.name === method && m.enabled !== false)
    if (!methodCfg) {
      setToast(req, 'error', 'Deposit method not available')
      return res.redirect('/deposit-withdrawal')
    }

    if (method === 'Bank Transfer') {
      setToast(req, 'error', 'Bank Transfer is not available at the moment')
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

    setToast(req, 'success', 'Deposit submitted, awaiting approval')
    res.redirect('/deposit-withdrawal')
  } catch (error) {
    setToast(req, 'error', 'Error processing deposit')
    res.redirect('/deposit-withdrawal')
  }
})
app.post('/packages/subscribe', requireLogin, (req, res) => {
  const { price } = req.body;

  const packages = [
    { name: "Starter", price: 500, profit: "5% weekly" },
    { name: "Standard", price: 1000, profit: "8% weekly" },
    { name: "Premium", price: 2000, profit: "12% weekly" },
    { name: "Advanced", price: 5000, profit: "15% weekly" },
    { name: "Gold", price: 10000, profit: "18% weekly" },
    { name: "Elite", price: 50000, profit: "20% weekly" }
  ];

  const selected = packages.find(p => p.price == price);

  if (!selected) {
    setToast(req, "error", "Package not found");
    return res.redirect("/packages");
  }

  const users = loadUsers();
  const user = users.find(u => u.id === req.session.user.id);

  if (!user) {
    setToast(req, "error", "User not found");
    return res.redirect("/packages");
  }

  if (user.balance < selected.price) {
    setToast(req, "error", "Insufficient balance");
    return res.redirect("/packages");
  }

  user.balance -= selected.price;

  const subscriptions = loadJson("./database/subscriptions.json", []);
  subscriptions.push({
    id: Date.now(),
    userId: user.id,
    package: selected.name,
    price: selected.price,
    profit: selected.profit,
    date: new Date().toISOString()
  });

  saveJson("./database/subscriptions.json", subscriptions);
  saveUsers(users);

  setToast(req, "success", "Package subscribed successfully");
  res.redirect("/packages");
});




// -----------------------------------------------------
// ADMIN AUTH MIDDLEWARE
// -----------------------------------------------------
function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.redirect('/admin-login')
  next()
}

// -----------------------------------------------------
// ADMIN LOGIN PAGE
// -----------------------------------------------------
app.get('/admin-login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin')
  res.render('admin-login')
})

app.post('/admin-login', (req, res) => {
  try {
    const { username, password } = req.body

    let users = loadUsers()

    let adminUser = users.find(u => u.role === 'admin')
    if (!adminUser) {
      adminUser = {
        id: Date.now(),
        username: 'admin',
        password: '12345',
        name: 'Administrator',
        email: '',
        phone: '',
        country: '',
        role: 'admin',
        balance: 0,
        profit: 0,
        bonus: 0,
        deposit: 0
      }
      users.push(adminUser)
      saveUsers(users)
    }

    adminUser = users.find(
      u => u.role === 'admin' && u.username === username && u.password === password
    )

    if (!adminUser) {
      setToast(req, 'error', 'Invalid admin login')
      return res.redirect('/admin-login')
    }

    req.session.admin = {
      id: adminUser.id,
      username: adminUser.username
    }

    setToast(req, 'success', 'Admin login successful')
    res.redirect('/admin')
  } catch (error) {
    setToast(req, 'error', 'Admin login error')
    res.redirect('/admin-login')
  }
})

// -----------------------------------------------------
// ADMIN LOGOUT
// -----------------------------------------------------
app.get('/admin-logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin-login'))
})

// -----------------------------------------------------
// ADMIN DASHBOARD
// -----------------------------------------------------
app.get('/admin', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
    const withdrawals = loadJson('./database/withdrawals.json', [])
    const deposits = loadJson('./database/deposits.json', [])
    const kycRequests = loadJson('./database/kyc.json', [])

    res.render('admin-dashboard', {
      admin: req.session.admin,
      users,
      withdrawals,
      deposits,
      kycRequests
    })
  } catch (error) {
    setToast(req, 'error', 'Error loading admin dashboard')
    res.redirect('/admin-login')
  }
})

// -----------------------------------------------------
// VIEW ALL USERS
// -----------------------------------------------------
app.get('/admin/users', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
    res.render('admin-users', { admin: req.session.admin, users })
  } catch (error) {
    setToast(req, 'error', 'Error loading users')
    res.redirect('/admin')
  }
})

// -----------------------------------------------------
// EDIT USER BALANCE PAGE
// -----------------------------------------------------
app.get('/admin/user/:id/balance', requireAdmin, (req, res) => {
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

app.post('/admin/user/:id/balance', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
    const user = users.find(u => u.id == req.params.id)
    if (!user) {
      setToast(req, 'error', 'User not found')
      return res.redirect('/admin/users')
    }

    const { balance, profit, bonus, deposit } = req.body

    user.balance = Number(balance)
    user.profit = Number(profit)
    user.bonus = Number(bonus)
    user.deposit = Number(deposit)

    saveUsers(users)
    setToast(req, 'success', 'User balances updated')
    res.redirect('/admin/users')
  } catch (error) {
    setToast(req, 'error', 'Error updating user balance')
    res.redirect('/admin/users')
  }
})

app.post('/admin/user/:id/delete', requireAdmin, (req, res) => {
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

    setToast(req, 'success', 'User and related data deleted')
    res.redirect('/admin/users')
  } catch (error) {
    setToast(req, 'error', 'Error deleting user')
    res.redirect('/admin/users')
  }
})

// -----------------------------------------------------
// WITHDRAWAL APPROVAL
// -----------------------------------------------------
app.get('/admin/withdrawals', requireAdmin, (req, res) => {
  try {
    const withdrawals = loadJson('./database/withdrawals.json', [])
    res.render('admin-withdrawals', { admin: req.session.admin, withdrawals })
  } catch (error) {
    setToast(req, 'error', 'Error loading withdrawals')
    res.redirect('/admin')
  }
})

app.post('/admin/withdraw/approve', requireAdmin, (req, res) => {
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

    setToast(req, 'success', 'Withdrawal approved')
    res.redirect('/admin/withdrawals')
  } catch (error) {
    setToast(req, 'error', 'Error approving withdrawal')
    res.redirect('/admin/withdrawals')
  }
})

app.post('/admin/withdraw/reject', requireAdmin, (req, res) => {
  try {
    const { id } = req.body

    const withdrawals = loadJson('./database/withdrawals.json', [])
    const users = loadUsers()

    const w = withdrawals.find(x => x.id == id)
    if (!w) return res.redirect('/admin/withdrawals')

    w.status = 'rejected'

    const user = users.find(u => u.id === w.userId)
    if (user) {
      user.balance += w.amount
    }

    saveJson('./database/withdrawals.json', withdrawals)
    saveUsers(users)

    setToast(req, 'success', 'Withdrawal rejected')
    res.redirect('/admin/withdrawals')
  } catch (error) {
    setToast(req, 'error', 'Error rejecting withdrawal')
    res.redirect('/admin/withdrawals')
  }
})

// show deposits
app.get('/admin/deposits', requireAdmin, (req, res) => {
  try {
    const deposits = loadJson('./database/deposits.json', [])
    res.render('admin-deposits', { deposits })
  } catch (error) {
    setToast(req, 'error', 'Error loading deposits')
    res.redirect('/admin')
  }
})

// add deposit page
app.get('/admin/deposit/add', requireAdmin, (req, res) => {
  try {
    const users = loadUsers()
    res.render('admin-add-deposit', { users })
  } catch (error) {
    setToast(req, 'error', 'Error loading add deposit page')
    res.redirect('/admin')
  }
})

// save deposit
app.post('/admin/deposit/add', requireAdmin, (req, res) => {
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
    user.balance = Number(user.balance || 0) + Number(amount)

    saveUsers(users)
    saveJson('./database/deposits.json', deposits)

    setToast(req, 'success', 'Deposit added for user')
    res.redirect('/admin/deposits')
  } catch (error) {
    setToast(req, 'error', 'Error adding deposit')
    res.redirect('/admin/deposit/add')
  }
})

app.post('/admin/deposit/approve', requireAdmin, (req, res) => {
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
    user.balance = Number(user.balance || 0) + Number(dep.amount)

    saveJson('./database/deposits.json', deposits)
    saveUsers(users)

    setToast(req, 'success', 'Deposit approved')
    res.redirect('/admin/deposits')
  } catch (error) {
    setToast(req, 'error', 'Error approving deposit')
    res.redirect('/admin/deposits')
  }
})

// ... (all the previous code remains the same until the last part)

app.post('/admin/deposit/reject', requireAdmin, (req, res) => {
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

    setToast(req, 'success', 'Deposit rejected')
    res.redirect('/admin/deposits')
  } catch (error) {
    setToast(req, 'error', 'Error rejecting deposit')
    res.redirect('/admin/deposits')
  }
})

// ADMIN PROFILE PAGE
app.get('/admin/profile', requireAdmin, (req, res) => {
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

// SAVE ADMIN PROFILE
app.post('/admin/profile', requireAdmin, (req, res) => {
  try {
    const { username, password } = req.body
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

    adminUser.username = username
    adminUser.password = password

    saveUsers(users)

    req.session.admin.username = username

    setToast(req, 'success', 'Admin login details updated')
    res.redirect('/admin/profile')
  } catch (error) {
    setToast(req, 'error', 'Error updating admin profile')
    res.redirect('/admin/profile')
  }
})

// ADMIN KYC LIST
app.get('/admin/kyc', requireAdmin, (req, res) => {
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

// ADMIN APPROVE KYC
app.post('/admin/kyc/approve', requireAdmin, (req, res) => {
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

    setToast(req, 'success', 'KYC approved')
    res.redirect('/admin/kyc')
  } catch (error) {
    setToast(req, 'error', 'Error approving KYC')
    res.redirect('/admin/kyc')
  }
})

// ADMIN REJECT KYC
app.post('/admin/kyc/reject', requireAdmin, (req, res) => {
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

    setToast(req, 'success', 'KYC rejected')
    res.redirect('/admin/kyc')
  } catch (error) {
    setToast(req, 'error', 'Error rejecting KYC')
    res.redirect('/admin/kyc')
  }
})

// ADMIN DEPOSIT METHODS LIST
app.get('/admin/deposit-methods', requireAdmin, (req, res) => {
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

// ADD METHOD
app.post('/admin/deposit-methods/add', requireAdmin, (req, res) => {
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

// EDIT METHOD
app.post('/admin/deposit-methods/edit', requireAdmin, (req, res) => {
  try {
    const { id, name } = req.body
    const enabled = req.body.enabled === 'on'

    const methods = loadJson('./database/depositMethods.json', [])
    const method = methods.find(m => m.id == id)
    if (!method) {
      setToast(req, 'error', 'Method not found')
      return res.redirect('/admin/deposit-methods')
    }

    method.name = name
    method.enabled = enabled

    saveJson('./database/depositMethods.json', methods)
    setToast(req, 'success', 'Deposit method updated')
    res.redirect('/admin/deposit-methods')
  } catch (error) {
    setToast(req, 'error', 'Error updating deposit method')
    res.redirect('/admin/deposit-methods')
  }
})

// DELETE METHOD
app.post('/admin/deposit-methods/delete', requireAdmin, (req, res) => {
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

// Load payment instructions
app.get('/admin/payment-settings', requireAdmin, (req, res) => {
  try {
    const instructions = loadJson(paymentFile, {})
    res.render('admin-payment-settings', { admin: req.session.admin, instructions })
  } catch (error) {
    setToast(req, 'error', 'Error loading payment settings')
    res.redirect('/admin')
  }
})

// Save payment instructions
app.post('/admin/payment-settings', requireAdmin, (req, res) => {
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


