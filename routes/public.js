const express = require('express')

module.exports = function createPublicRoutes(deps) {
  const router = express.Router()
  const { loadJson } = deps

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

  router.get('/FAQ', (req, res) => {
    res.render('FAQ')
  })

  router.get('/terms', (req, res) => {
    res.render('terms')
  })

  router.get('/privacy-policy', (req, res) => {
    res.render('privacy')
  })

  router.get('/risk-disclosure', (req, res) => {
    res.render('risk')
  })

  router.get('/cookie-policy', (req, res) => {
    res.render('cookie')
  })

  router.get('/aml-policy', (req, res) => {
    res.render('aml')
  })

  return router
}