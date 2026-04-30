const crypto = require('crypto')

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex')
  }
  return req.session.csrfToken
}

function createCsrfProtection(setToast) {
  return function csrfProtection(req, res, next) {
    const token = ensureCsrfToken(req)
    res.locals.csrfToken = token
    res.locals.csrfField = () => `<input type="hidden" name="_csrf" value="${token}">`

    if (SAFE_METHODS.has(req.method)) {
      return next()
    }

    const submittedToken = req.body?._csrf || req.query?._csrf || req.get('x-csrf-token')
    const submitted = Buffer.from(String(submittedToken || ''))
    const expected = Buffer.from(token)
    if (submitted.length === expected.length && crypto.timingSafeEqual(submitted, expected)) {
      return next()
    }

    setToast(req, 'error', 'Security check failed. Please try again.')
    return res.status(403).send('Security check failed. Please try again.')
  }
}

module.exports = {
  createCsrfProtection
}
