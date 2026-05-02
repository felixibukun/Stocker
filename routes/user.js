const express = require('express')

module.exports = function createRoutes(deps) {
  const router = express.Router()
  const { bcrypt, getMarketPrice, loadJson, loadUsers, notify, recalcUserBalance, requireLogin, requireSignalActive, saveJson, saveUsers, setToast, upload } = deps

router.get('/dashboard', requireLogin, (req, res) => {
  const users = loadUsers()
  const holdings = loadJson('./database/holdings.json', [])
  const trades = loadJson('./database/trades.json', [])
  const subscriptions = loadJson('./database/subscriptions.json', [])
  const stocks = loadJson('./database/stocks.json', [])

  const user = users.find(u => u.id === req.session.user.id)

if (!user) return res.redirect('/login')

const openPositions = Array.isArray(user.openPositions)
  ? user.openPositions
      .filter(p => p && p.status !== 'closed')
      .map(p => ({
        ...p,
        entryPrice: Number(p.entryPrice || p.price || 0),
        margin: Number(p.margin || p.amount || 0),
        leverage: Number(p.leverage || 1),
        size: Number(p.size || p.margin || p.amount || 0),
        pnl: Number(p.pnl || p.profit || 0),
        side: p.side || 'buy',
        symbol: p.symbol || 'N/A'
      }))
  : []

user.deposit = Number(user.deposit || 0)
user.profit = Number(user.profit || 0)
user.bonus = Number(user.bonus || 0)

recalcUserBalance(user)
saveUsers(users)

  const userHoldings = holdings.filter(h => h.userId === user.id)
  const userTrades = trades.filter(t => t.userId === user.id)
  const userSubscriptions = subscriptions.filter(s => s.userId === user.id)

  // const wins = userTrades.filter(t => t.profit > 0).length
  // const total = userTrades.length
  // const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  const today = new Date().toISOString().slice(0, 10)

const manualTrades = userTrades.filter(t => t.type === 'manual-trade' || t.type === 'copy-trade')

const closedTrades = manualTrades.filter(t => t.status === 'closed')
const openManualTrades = manualTrades.filter(t => t.status === 'open')

const winningTrades = closedTrades.filter(t => Number(t.profit || t.pnl || 0) > 0)

const winRate = closedTrades.length > 0
  ? Math.round((winningTrades.length / closedTrades.length) * 100)
  : 0

const todayPL = closedTrades
  .filter(t => String(t.closedAt || t.timestamp || '').slice(0, 10) === today)
  .reduce((sum, t) => sum + Number(t.profit || t.pnl || 0), 0)

const liveFloatingPL = openPositions.reduce((sum, p) => {
  return sum + Number(p.pnl || 0)
}, 0)

const totalExposure = openPositions.reduce((sum, p) => {
  return sum + Number(p.size || p.margin || 0)
}, 0)

const availableMargin = Number(user.deposit || 0)

const riskLevel = openPositions.length >= 10 || totalExposure > availableMargin * 5
  ? 'high'
  : openPositions.length >= 4 || totalExposure > availableMargin * 2
  ? 'medium'
  : 'low'

  let openTrades = openPositions.length
  let totalPL = 0

  userHoldings.forEach(h => {
    const stock = stocks.find(s => s.id == h.stockId)
    if (!stock) return
    const diff = (Number(stock.price) - Number(h.avgPrice)) * Number(h.quantity)
    totalPL += diff
  })

  res.render('user/dashboard', {
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
  kycStatus: user.kycStatus || "Not Verified",
  openPositions,
  trades: userTrades.filter(t => t.type === 'manual-trade' || t.type === 'copy-trade')
},
  openPositions,
  openTrades,
  totalPL,
  subscriptions: userSubscriptions,
  holdings: userHoldings,
  trades: userTrades,
  stocks,   // IMPORTANT FIX
  winRate,
todayPL,
liveFloatingPL,
totalExposure,
availableMargin,
closedTradesCount: closedTrades.length,
openTradesCount: openManualTrades.length,
riskLevel,
  admin: req.session.admin
})
})

/* ===========================
COPY TRADER
=========================== */
router.get('/copy-trader', requireLogin, (req, res) => {
  try {
    const traders = loadJson('./database/copytraders.json', [])
    res.render('user/copytrader', { user: req.session.user, traders })
  } catch {
    setToast(req, 'error', 'Error loading copy traders')
    res.redirect('/dashboard')
  }
})

router.post('/copy-trader/follow', requireLogin, requireSignalActive, async (req, res) => {
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
// const exists = following.find(f => f.userId === user.id && f.traderId === trader.id)
// if (exists) {
//   setToast(req, 'info', 'Already following this trader')
//   return res.redirect('/copy-trader')
// }


user.deposit -= invest
const trades = loadJson('./database/trades.json', [])

trades.push({
  id: Date.now(),
  userId: user.id,
  type: 'copy-trade',
  symbol: trader.name,
  side: 'COPY',
  margin: invest,
  leverage: 1,
  size: invest,
  price: 0,
  profit: 0,
  status: 'open',
  timestamp: new Date().toISOString()
})

saveJson('./database/trades.json', trades)

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
router.get('/stocks', requireLogin, (req, res) => {
  try {
    const stocks = loadJson('./database/stocks.json', [])
    res.render('user/stocks', { user: req.session.user, stocks })
  } catch {
    setToast(req, 'error', 'Error loading stocks')
    res.redirect('/dashboard')
  }
})

router.get('/subscription-trade', requireLogin, (req, res) => {
  const stocks = loadJson('./database/stocks.json', [])
  res.render('user/stocks', { user: req.session.user, stocks })
})

/* ===========================
BUY STOCK
=========================== */
router.post('/stocks/buy', requireLogin, requireSignalActive, async (req, res) => {
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
router.post('/stocks/sell', requireLogin, requireSignalActive, async (req, res) => {
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

router.post('/trade/execute', requireLogin, requireSignalActive, async (req, res) => {
  const { side, symbol, amount, leverage } = req.body

  const users = loadUsers()
  const trades = loadJson('./database/trades.json', [])

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

  const entry = await getMarketPrice(symbol)

if (!entry || entry <= 0) {
  setToast(req, 'error', 'Live market price unavailable. Try again.')
  return res.redirect('/dashboard')
}
  const size = margin * lev

  const tradeId = Date.now()

  // SAVE TRADE TO DATABASE
  trades.push({
    id: tradeId,
    userId: user.id,
    type: 'manual-trade',
    symbol,
    side,
    margin,
    leverage: lev,
    size,
    price: entry,
    profit: 0,
    status: 'open',
    timestamp: new Date().toISOString()
  })

  // KEEP OPEN POSITION
  if (!user.openPositions) user.openPositions = []

  user.openPositions.push({
    id: tradeId,
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

  user.deposit -= margin
  recalcUserBalance(user)

  saveUsers(users)
  saveJson('./database/trades.json', trades)

  req.session.user = user

  setToast(req, 'success', 'Order executed')
  res.redirect('/dashboard')
})

// Add price update loop for unrealized PnL.
setInterval(async () => {
  try {
    const users = loadUsers()

    for (const u of users) {
      if (!Array.isArray(u.openPositions)) continue

      for (const p of u.openPositions) {
        const price = await getMarketPrice(p.symbol)
        if (!price || price <= 0) continue

        p.currentPrice = price

        const entryPrice = Number(p.entryPrice || p.price || 0)
        const margin = Number(p.margin || 0)
        const leverage = Number(p.leverage || 1)

        if (!entryPrice || !margin) continue

        if (String(p.side).toLowerCase() === 'buy') {
          p.pnl = ((price - entryPrice) / entryPrice) * margin * leverage
        } else {
          p.pnl = ((entryPrice - price) / entryPrice) * margin * leverage
        }

        // 🔥 THIS IS THE FIX
        const trades = loadJson('./database/trades.json', [])
        const trade = trades.find(t => t.id == p.id)

        if (trade && trade.status === 'open') {
          trade.pnl = p.pnl
        }

        saveJson('./database/trades.json', trades)
      }
    }

    // saveUsers(users)
  } catch (err) {
    console.error('Live PnL update error:', err.message)
  }
}, 5000)

// Close trade route.
router.post('/trade/close', requireLogin, requireSignalActive, (req, res) => {
  const { tradeId } = req.body

  const users = loadUsers()
  const trades = loadJson('./database/trades.json', [])

  const user = users.find(u => u.id === req.session.user.id)
  if (!user || !user.openPositions) return res.redirect('/dashboard')

  const pos = user.openPositions.find(p => p.id == tradeId)
  if (!pos) return res.redirect('/dashboard')

  user.deposit += pos.margin
  user.profit = Number(user.profit || 0) + pos.pnl

  // UPDATE TRADE IN DATABASE
  const trade = trades.find(t => t.id == tradeId)
  if (trade) {
    trade.profit = pos.pnl
    trade.status = 'closed'
    trade.closedAt = new Date().toISOString()
  }

  user.openPositions = user.openPositions.filter(p => p.id != tradeId)

  recalcUserBalance(user)

  saveUsers(users)
  saveJson('./database/trades.json', trades)

  req.session.user = user

  setToast(req, 'success', 'Trade closed')
  res.redirect('/dashboard')
})

/* ===========================
KYC
=========================== */
router.get('/kyc-verification', requireLogin, (req, res) => {
  try {
    const kycRequests = loadJson('./database/kyc.json', []).filter(
      k => k.userId === req.session.user.id
    )

    res.render('user/kyc-verification', {
      user: req.session.user,
      kycRequests
    })

  } catch {
    setToast(req, 'error', 'Error loading KYC page')
    res.redirect('/dashboard')
  }
})

router.post(
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
router.get('/package-history', requireLogin, (req, res) => {
  const subs = loadJson('./database/subscriptions.json', []).filter(
    s => s.userId === req.session.user.id
  )

  res.render('user/package-history', {
    user: req.session.user,
    subs
  })
})

/* ===========================
DEPOSIT & WITHDRAWAL PAGE
=========================== */
router.get('/deposit-withdrawal', requireLogin, (req, res) => {
  try {
    const deposits = loadJson('./database/deposits.json', [])

    // Load deposit methods directly
    const depositMethods = loadJson('./database/depositMethods.json', [])
      .filter(m => m.enabled !== false)

    const userDeposits = deposits.filter(d => d.userId === req.session.user.id)

    res.render('user/deposit-withdrawal', {
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
router.get('/withdraw', requireLogin, (req, res) => {
  try {
    const users = loadUsers()
    const user = users.find(u => u.id === req.session.user.id)

    const withdrawals = loadJson('./database/withdrawals.json', [])
  .filter(w => w.userId === req.session.user.id)
  .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))

    res.render('user/withdraw', {
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
router.post('/withdraw', requireLogin, requireSignalActive, async (req, res) => {
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
router.get('/withdraw-history', requireLogin, (req, res) => {
  try {
    const userId = req.session.user.id

    const withdrawals = loadJson('./database/withdrawals.json', [])
  .filter(w => w.userId === req.session.user.id)
  .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))

    const users = loadUsers()
    const user = users.find(u => u.id === userId)

    res.render('user/withdraw-history', {
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
router.get('/packages', requireLogin, (req, res) => {
  const packages = [
    { name: "Starter", price: 500, profit: "5% weekly" },
    { name: "Standard", price: 1000, profit: "8% weekly" },
    { name: "Premium", price: 2000, profit: "12% weekly" },
    { name: "Advanced", price: 5000, profit: "15% weekly" },
    { name: "Gold", price: 10000, profit: "18% weekly" },
    { name: "Elite", price: 50000, profit: "20% weekly" }
  ]

  res.render('user/packages', {
    user: req.session.user,
    packages
  })
})

router.post('/packages/subscribe', requireLogin, async (req, res) => {
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
router.get('/account', requireLogin, (req, res) => {
  const users = loadUsers()
  const user = users.find(u => u.id === req.session.user.id)

  res.render('user/account', { user })
})

// UPDATED: Profile update route with better validation
router.post('/account/update', requireLogin, (req, res) => {
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
router.post('/account/update-email', requireLogin, async (req, res) => {
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
      user.password = await bcrypt.hash(password, BCRYPT_ROUNDS)
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
router.post('/account/change-password', requireLogin, async (req, res) => {
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

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

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
router.get('/support', requireLogin, (req, res) => {
  res.render('user/support', { user: req.session.user })
})

router.post('/support', requireLogin, async (req, res) => {
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
router.post('/deposit', requireLogin, upload.single('proof'), async (req, res) => {
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

router.get('/pl-record', requireLogin, (req, res) => {
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

  res.render('user/pl-record', {
    user: req.session.user,
    holdings,
    totalProfit
  })
})

router.get('/trading-history', requireLogin, (req, res) => {
  const trades = loadJson('./database/trades.json', [])
    .filter(t =>
      t.userId === req.session.user.id &&
      (t.type === 'manual-trade' || t.type === 'copy-trade')
    )

  res.render('user/trading-history', {
    user: req.session.user,
    trades
  })
})

router.get('/transactions-history', requireLogin, (req, res) => {
  const deposits = loadJson('./database/deposits.json', [])
    .filter(x => x.userId === req.session.user.id)

  const withdrawals = loadJson('./database/withdrawals.json', [])
    .filter(x => x.userId === req.session.user.id)

  const transactions = [...deposits, ...withdrawals].sort((a, b) => {
  return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)
})

  res.render('user/transactions-history', {
    user: req.session.user,
    transactions
  })
})



  return router
}