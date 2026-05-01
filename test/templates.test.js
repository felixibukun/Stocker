const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = process.cwd()
const viewsDir = path.join(root, 'views')

function jsSources() {
  const files = [path.join(root, 'server.js')]
  const routesDir = path.join(root, 'routes')
  if (fs.existsSync(routesDir)) {
    for (const file of fs.readdirSync(routesDir).filter(name => name.endsWith('.js'))) {
      files.push(path.join(routesDir, file))
    }
  }
  return files.map(file => fs.readFileSync(file, 'utf8')).join('\n')
}

test('all EJS render targets exist', () => {
  const renderTargets = new Set()
  const renderPattern = /res\.render\('([^']+)'/g

  for (const match of jsSources().matchAll(renderPattern)) {
    renderTargets.add(match[1])
  }

  const missing = [...renderTargets]
    .filter(view => !fs.existsSync(path.join(viewsDir, `${view}.ejs`)))
    .sort()

  assert.deepEqual(missing, [])
})

test('templates do not reference removed CSRF locals', () => {
  const references = []
  const csrfPattern = /csrfField|csrfToken|_csrf/

  function scan(dir) {
    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        scan(fullPath)
        continue
      }

      if (!name.endsWith('.ejs')) continue

      const relativePath = path.relative(viewsDir, fullPath)
      const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)
      lines.forEach((line, index) => {
        if (csrfPattern.test(line)) {
          references.push(`${relativePath}:${index + 1}`)
        }
      })
    }
  }

  scan(viewsDir)

  assert.deepEqual(references, [])
})

test('POST forms declare an action', () => {
  const missing = []
  const formPattern = /<form\b(?=[^>]*\bmethod=["']POST["'])[^>]*>/gi

  function scan(dir) {
    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        scan(fullPath)
        continue
      }

      if (!name.endsWith('.ejs')) continue

      const relativePath = path.relative(viewsDir, fullPath)
      const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)

      lines.forEach((line, index) => {
        if (!formPattern.test(line)) {
          formPattern.lastIndex = 0
          return
        }

        formPattern.lastIndex = 0
        if (!/\baction=["'][^"']+["']/.test(line)) {
          missing.push(`${relativePath}:${index + 1}`)
        }
      })
    }
  }

  scan(viewsDir)

  assert.deepEqual(missing, [])
})
