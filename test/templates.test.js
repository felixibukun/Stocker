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

test('POST forms include a CSRF field', () => {
  const missing = []
  const formPattern = /<form\b(?=[^>]*\bmethod=["']POST["'])[^>]*>/gi

  for (const file of fs.readdirSync(viewsDir).filter(name => name.endsWith('.ejs'))) {
    const fullPath = path.join(viewsDir, file)
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)

    lines.forEach((line, index) => {
      if (!formPattern.test(line)) {
        formPattern.lastIndex = 0
        return
      }

      formPattern.lastIndex = 0
      const nearby = lines.slice(index, index + 4).join('\n')
      if (!nearby.includes('<%- csrfField() %>')) {
        missing.push(`${file}:${index + 1}`)
      }
    })
  }

  assert.deepEqual(missing, [])
})
