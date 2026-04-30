const ADMIN_IPS = (process.env.ADMIN_IPS || '102.90.101.126')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean)

const ALLOWED_IPS = ADMIN_IPS.concat(['127.0.0.1', '::1'])
const BCRYPT_ROUNDS = 12

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production')
}

const sessionSecret = process.env.SESSION_SECRET || 'stocker-development-session-secret-change-me'

module.exports = {
  ADMIN_IPS,
  ALLOWED_IPS,
  BCRYPT_ROUNDS,
  sessionSecret
}
