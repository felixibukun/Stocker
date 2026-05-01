const BCRYPT_ROUNDS = 12

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production')
}

const sessionSecret = process.env.SESSION_SECRET || 'stocker-development-session-secret-change-me'

module.exports = {
  BCRYPT_ROUNDS,
  sessionSecret
}
