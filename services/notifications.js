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
  if (lower.includes('verify')) return 'Complete your account setup to unlock full access'
  if (lower.includes('trade executed') || lower.includes('copy trader')) return 'Your trade has been confirmed and executed'
  if (lower.includes('deposit')) return 'Your deposit has been received'
  if (lower.includes('withdrawal')) return 'Your withdrawal request has been received'
  if (lower.includes('kyc')) return 'Identity verification status update'
  if (lower.includes('support')) return 'Your support request is under review'
  if (lower.includes('package')) return 'Subscription or package status update'
  return 'Secure. Transparent. Always On.'
}

function iconFor(subject) {
  const lower = subject.toLowerCase()
  if (lower.includes('verify')) return '✉'
  if (lower.includes('trade executed') || lower.includes('copy trader')) return '⟳'
  if (lower.includes('deposit')) return '↓'
  if (lower.includes('withdrawal')) return '↑'
  if (lower.includes('kyc')) return '◈'
  if (lower.includes('support')) return '◎'
  if (lower.includes('package')) return '◇'
  return '◆'
}

function accentColorFor(subject) {
  const lower = subject.toLowerCase()
  if (lower.includes('verify')) return '#1a56db'
  if (lower.includes('trade executed') || lower.includes('copy trader')) return '#b8860b'
  if (lower.includes('deposit')) return '#0e7c4a'
  if (lower.includes('withdrawal')) return '#c2410c'
  if (lower.includes('kyc')) return '#6d28d9'
  if (lower.includes('support')) return '#0369a1'
  if (lower.includes('package')) return '#b8860b'
  return '#b8860b'
}

function extraContentFor(subject) {
  const lower = subject.toLowerCase()

  if (lower.includes('verify')) {
    return `
      <tr>
        <td style="padding: 0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#f0f4ff; border:1px solid #c7d7f5; border-radius:8px; padding:18px 20px;">
                <p style="margin:0 0 6px; color:#1e3a6e; font-family:'Georgia',serif; font-size:11px; letter-spacing:2px; text-transform:uppercase;">Why verify?</p>
                <p style="margin:0; color:#4a5568; font-size:13px; line-height:22px;">Verifying your email protects your account, enables withdrawals, and ensures all important trade notifications reach you securely.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  }

  if (lower.includes('trade') || lower.includes('copy trader')) {
    return `
      <tr>
        <td style="padding: 0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="48%" style="background:#f8f9fb; border:1px solid #dde3ee; border-radius:8px; padding:16px; text-align:center;">
                <p style="margin:0; color:#6b7a99; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family:'Georgia',serif;">Status</p>
                <p style="margin:6px 0 0; color:#0e7c4a; font-size:15px; font-weight:700; letter-spacing:1px;">EXECUTED</p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#f8f9fb; border:1px solid #dde3ee; border-radius:8px; padding:16px; text-align:center;">
                <p style="margin:0; color:#6b7a99; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family:'Georgia',serif;">Platform</p>
                <p style="margin:6px 0 0; color:#b8860b; font-size:15px; font-weight:700; letter-spacing:1px;">GEQ TRADE</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  }

  if (lower.includes('deposit')) {
    return `
      <tr>
        <td style="padding: 0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#f0faf5; border:1px solid #a7d7bc; border-radius:8px; padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color:#1e3a6e; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family:'Georgia',serif; padding-bottom:12px;" colspan="2">Deposit Details</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7a99; font-size:13px; padding:5px 0; border-bottom:1px solid #d1ead9;">Processing Time</td>
                    <td style="color:#1a202c; font-size:13px; font-weight:600; text-align:right; padding:5px 0; border-bottom:1px solid #d1ead9;">Instant / A few minutes</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7a99; font-size:13px; padding:5px 0; padding-top:8px;">Support</td>
                    <td style="color:#0e7c4a; font-size:13px; font-weight:600; text-align:right; padding:5px 0; padding-top:8px;">24/7 Available</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  }

  if (lower.includes('withdrawal')) {
    return `
      <tr>
        <td style="padding: 0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#fff8f0; border:1px solid #f4c89a; border-left:3px solid #c2410c; border-radius:0 8px 8px 0; padding:16px 20px;">
                <p style="margin:0 0 6px; color:#7c2d12; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family:'Georgia',serif;">Important Notice</p>
                <p style="margin:0; color:#4a5568; font-size:13px; line-height:22px;">Withdrawals are processed within a few minutes. Ensure your withdrawal details are accurate — funds sent to incorrect addresses cannot be recovered.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  }

  return ''
}

function emailBody(subject, message) {
  const title = titleFor(subject)
  const subtitle = subtitleFor(subject)
  const icon = iconFor(subject)
  const accent = accentColorFor(subject)
  const extra = extraContentFor(subject)
  const year = new Date().getFullYear()
  const timestamp = new Date().toUTCString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background:#eef1f7; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">

  <!-- Preheader text (hidden) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; color:#eef1f7; font-size:1px;">
    ${title} — ${subtitle}
  </div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f7;">
    <tr>
      <td align="center" style="padding: 48px 16px;">

        <!-- Main card -->
        <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 40px rgba(15,30,80,0.13);">

          <!-- Navy header -->
          <tr>
            <td style="background:#0f2255; padding: 28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="cid:gqtlogo" width="44" height="44" alt="GEQ" style="display:block; border-radius:8px;">
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="color:#a0b4d0; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family:'Georgia',serif;">Secure Notification</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gold accent bar -->
          <tr>
            <td style="height:3px; background:linear-gradient(90deg, #8b6914, ${accent}, #8b6914);"></td>
          </tr>

          <!-- Icon + Title -->
          <tr>
            <td style="padding: 40px 40px 24px; text-align:center; background:#ffffff;">
              <div style="display:inline-block; width:68px; height:68px; line-height:68px; border-radius:50%; background:#f0f4ff; border:1px solid #c7d7f5; font-size:28px; color:${accent}; text-align:center;">
                ${icon}
              </div>
              <h1 style="margin:20px 0 6px; color:#0f2255; font-size:22px; font-weight:700; letter-spacing:-0.3px; font-family:'Georgia',serif;">
                ${title}
              </h1>
              <p style="margin:0; color:#8896b0; font-size:13px; letter-spacing:0.3px;">${subtitle}</p>
            </td>
          </tr>

          <!-- Accent rule -->
          <tr>
            <td style="padding: 0 40px 28px;">
              <div style="height:1px; background:linear-gradient(90deg, transparent, ${accent}55, transparent);"></div>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding: 0 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#f8f9fb; border:1px solid #dde3ee; border-left:3px solid ${accent}; border-radius:0 8px 8px 0; padding:20px 22px;">
                    <p style="margin:0; color:#1a202c; font-size:15px; line-height:26px;">${message}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dynamic section -->
          ${extra}

          <!-- Info strip -->
          <tr>
            <td style="padding: 0 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" style="text-align:center; padding:14px 8px; background:#f8f9fb; border:1px solid #dde3ee; border-right:none; border-radius:8px 0 0 8px;">
                    <p style="margin:0; color:#8896b0; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; font-family:'Georgia',serif;">Platform</p>
                    <p style="margin:4px 0 0; color:#0f2255; font-size:12px; font-weight:700;">GEQ Trade</p>
                  </td>
                  <td width="34%" style="text-align:center; padding:14px 8px; background:#f8f9fb; border:1px solid #dde3ee; border-left:none; border-right:none;">
                    <p style="margin:0; color:#8896b0; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; font-family:'Georgia',serif;">Security</p>
                    <p style="margin:4px 0 0; color:#0e7c4a; font-size:12px; font-weight:700;">256-bit SSL</p>
                  </td>
                  <td width="33%" style="text-align:center; padding:14px 8px; background:#f8f9fb; border:1px solid #dde3ee; border-left:none; border-radius:0 8px 8px 0;">
                    <p style="margin:0; color:#8896b0; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; font-family:'Georgia',serif;">Support</p>
                    <p style="margin:4px 0 0; color:#0f2255; font-size:12px; font-weight:700;">24 / 7</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Timestamp -->
          <tr>
            <td style="padding: 0 40px 20px; text-align:center;">
              <p style="margin:0; color:#c0cad8; font-size:11px; letter-spacing:0.3px;">Sent at ${timestamp}</p>
            </td>
          </tr>

          <!-- Navy footer -->
          <tr>
            <td style="background:#0f2255; padding:26px 40px; text-align:center; border-top:3px solid ${accent};">
              <p style="margin:0 0 6px; color:#a0b4d0; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family:'Georgia',serif;">Global Equinox Trade</p>
              <p style="margin:0; color:#3a5070; font-size:11px; line-height:18px;">
                This is a secure automated notification. Do not reply to this email.<br>
                If you did not request this, please contact support immediately.
              </p>
              <p style="margin:14px 0 0; color:#2a3f5a; font-size:10px;">© ${year} Global Equinox Trade. All rights reserved.</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`
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