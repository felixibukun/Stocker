const express = require('express')

module.exports = function createPublicRoutes(deps) {
  const router = express.Router()
  const { loadJson, saveJson, setToast } = deps

  router.get('/api/stocks', (req, res) => {
    try {
      const stocks = loadJson('./database/stocks.json', [])
      res.json(stocks)
    } catch (e) {
      res.status(500).json({ error: 'Failed to load stocks' })
    }
  })

  router.get('/about', (req, res) => {
    res.render('about')
  })

  router.get('/contact', (req, res) => {
    res.redirect('/#about')
  })

  router.post('/contact', (req, res) => {
    try {
      const messages = loadJson('./database/contactMessages.json', [])
      messages.push({
        id: Date.now(),
        name: req.body.name || '',
        email: req.body.email || '',
        message: req.body.message || '',
        createdAt: new Date().toISOString()
      })
      saveJson('./database/contactMessages.json', messages)
      setToast(req, 'success', 'Message sent successfully')
    } catch (e) {
      setToast(req, 'error', 'Unable to send message right now')
    }
    res.redirect('/#about')
  })

  router.get('/FAQ', (req, res) => {
    res.render('FAQ')
  })

  router.get('/faq', (req, res) => {
    res.redirect('/FAQ')
  })

  router.get('/terms', (req, res) => {
    res.render('terms')
  })

  router.get('/privacy-policy', (req, res) => {
    res.render('privacy')
  })

  router.get('/privacy', (req, res) => {
    res.redirect('/privacy-policy')
  })

  router.get('/risk-disclosure', (req, res) => {
    res.render('risk')
  })

  router.get('/risk', (req, res) => {
    res.redirect('/risk-disclosure')
  })

  router.get('/cookie-policy', (req, res) => {
    res.render('cookie')
  })

  router.get('/cookies', (req, res) => {
    res.redirect('/cookie-policy')
  })

  router.get('/aml-policy', (req, res) => {
    res.render('aml')
  })

  router.get('/aml', (req, res) => {
    res.redirect('/aml-policy')
  })

  router.get('/verify', (req, res) => {
    if (!req.session.user) return res.redirect('/login')
    res.render('verify')
  })

  router.post('/verify', (req, res) => {
    if (!req.session.user) return res.redirect('/login')
    setToast(req, 'success', 'Email verification received')
    res.redirect('/dashboard')
  })

  router.get('/resend-code', (req, res) => {
    if (!req.session.user) return res.redirect('/login')
    setToast(req, 'success', 'A new verification code has been requested')
    res.redirect('/verify')
  })

  return router
}
