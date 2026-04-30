const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const test = require('node:test')

const PORT = 3210
const BASE_URL = `http://127.0.0.1:${PORT}`

function startServer() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      SESSION_SECRET: 'test-session-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let output = ''
  child.stdout.on('data', chunk => {
    output += chunk.toString()
  })
  child.stderr.on('data', chunk => {
    output += chunk.toString()
  })

  return { child, getOutput: () => output }
}

async function waitForServer() {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/login`)
      if (response.ok) return
    } catch (_) {
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
  throw new Error('Server did not start in time')
}

function sessionCookie(response) {
  const cookie = response.headers.get('set-cookie')
  assert.ok(cookie, 'expected a session cookie')
  return cookie.split(';')[0]
}

function csrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/)
  assert.ok(match, 'expected a CSRF token field')
  return match[1]
}

test('POST signup rejects requests without CSRF token', async () => {
  const response = await fetch(`${BASE_URL}/signup`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      username: `csrf-missing-${Date.now()}`,
      name: 'CSRF Missing',
      email: `csrf-missing-${Date.now()}@example.com`,
      phone: '1234567890',
      country: 'NG',
      password: 'password123'
    })
  })

  assert.equal(response.status, 403)
})

test('signup succeeds with CSRF token', async () => {
  const getResponse = await fetch(`${BASE_URL}/signup`)
  assert.equal(getResponse.status, 200)

  const cookie = sessionCookie(getResponse)
  const token = csrfToken(await getResponse.text())
  const unique = Date.now()

  const response = await fetch(`${BASE_URL}/signup`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      cookie,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      _csrf: token,
      username: `csrf-user-${unique}`,
      name: 'CSRF User',
      email: `csrf-user-${unique}@example.com`,
      phone: '1234567890',
      country: 'NG',
      password: 'password123'
    })
  })

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), '/dashboard')
})

test.before(async () => {
  global.server = startServer()
  await waitForServer()
})

test.after(() => {
  if (global.server?.child && !global.server.child.killed) {
    global.server.child.kill()
  }
})

