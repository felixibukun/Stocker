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

test('signup succeeds', async () => {
  const unique = Date.now()
  const response = await fetch(`${BASE_URL}/signup`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      username: `signup-user-${unique}`,
      name: 'Signup User',
      email: `signup-user-${unique}@example.com`,
      phone: '1234567890',
      country: 'NG',
      password: 'password123'
    })
  })

  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), '/dashboard')
})

test('auth pages render', async () => {
  for (const path of ['/login', '/signup', '/admin-login']) {
    const response = await fetch(`${BASE_URL}${path}`)
    assert.equal(response.status, 200)
  }
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
