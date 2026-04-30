const fs = require('fs')
const nodemailer = require('nodemailer')
const path = require('path')

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'globalequinoxtrade@gmail.com',
    pass: process.env.MAIL_PASS
  }
})

function titleFor(subject) {
  const lower = subject.toLowerCase()
  if (lower.includes('verify')) return 'Email Verification'
  if (lower.includes('trade executed') || lower.includes('copy trader')) return 'Trade Executed'
  if (lower.includes('deposit')) return 'Deposit Update'
  if (lower.includes('withdrawal')) return 'Withdrawal Update'
  if (lower.includes('kyc')) return 'KYC Status'
  if (lower.includes('support')) return 'Support Ticket'
  if (lower.includes('package')) return 'Package Update'
  return 'Global Equinox Trade'
}

function subtitleFor(subject) {
  const lower = subject.toLowerCase()
  if (lower.includes('verify')) return 'Complete your account setup'
  if (lower.includes('trade executed') || lower.includes('copy trader')) return 'Your trade is confirmed'
  if (lower.includes('deposit')) return 'Your deposit status'
  if (lower.includes('withdrawal')) return 'Your withdrawal status'
  if (lower.includes('kyc')) return 'Identity verification update'
  if (lower.includes('support')) return 'Your request is in review'
  if (lower.includes('package')) return 'Subscription status'
  return 'Secure Financial Services'
}

function emailBody(subject, message) {
  const title = titleFor(subject)
  const subtitle = subtitleFor(subject)

  return `
    <div style="background:#0a0a0a; padding:40px; font-family:Arial;">
      <div style="max-width:520px; margin:auto; background:#111; border-radius:14px; padding:30px; border:1px solid #1f1f1f;">
        <div style="text-align:center; margin-bottom:20px;">
          <img src="cid:gqtlogo" style="width:90px;">
        </div>
        <h2 style="color:#fff; text-align:center; margin:0;">${title}</h2>
        <p style="color:#aaa; text-align:center; font-size:14px; margin-top:5px;">${subtitle}</p>
        <div style="background:#1b1b1b; padding:22px; border-radius:10px; border:1px solid #2c2c2c; margin-top:25px;">
          <p style="color:#fff; text-align:center; font-size:16px; margin-top:6px; margin-bottom:6px;">${message}</p>
        </div>
        <p style="color:#555; text-align:center; font-size:12px; margin-top:24px; line-height:18px;">
          This is an automated message from Global Equinox Trade.
        </p>
      </div>
    </div>`
}

async function notify(email, subject, message) {
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'temp', 'custom', 'img', 'logo.png')
    const attachments = fs.existsSync(logoPath)
      ? [{ filename: 'logo.png', path: logoPath, cid: 'gqtlogo' }]
      : []

    await mailer.sendMail({
      from: 'Global Equinox Trade <globalequinoxtrade@gmail.com>',
      to: email,
      subject,
      html: emailBody(subject, message),
      attachments
    })

    return true
  } catch (e) {
    console.error('Email error:', e)
    return false
  }
}

module.exports = {
  notify
}
