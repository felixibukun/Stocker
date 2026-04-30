function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.ip || req.connection.remoteAddress
}

function createAuthMiddleware({ allowedIps, loadUsers, setToast }) {
  function requireLogin(req, res, next) {
    if (!req.session.user) {
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

  function requireAdminIP(req, res, next) {
    const clientIp = getClientIp(req)
    if (allowedIps.includes(clientIp) || allowedIps.includes(clientIp.replace('::ffff:', ''))) {
      return next()
    }

    setToast(req, 'error', 'Admin access is restricted from this IP.')
    return res.redirect('/admin-login')
  }

  return {
    getClientIp,
    requireAdminIP,
    requireLogin,
    requireSignalActive
  }
}

module.exports = {
  createAuthMiddleware,
  getClientIp
}
