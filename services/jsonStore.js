const fs = require('fs')

function loadJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw.trim()) {
      console.warn(`File ${filePath} is empty, using fallback`)
      return fallback
    }

    const backupPath = filePath + '.backup'
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath)
    }

    try {
      return JSON.parse(raw)
    } catch (parseError) {
      console.error(`JSON parse error in ${filePath}:`, parseError)

      try {
        if (fs.existsSync(backupPath)) {
          const backupData = fs.readFileSync(backupPath, 'utf8')
          const parsedBackup = JSON.parse(backupData)
          console.log(`Recovered ${filePath} from backup`)
          return parsedBackup
        }
      } catch (backupError) {
        console.error(`Backup recovery failed for ${filePath}:`, backupError)
      }

      const fixed = raw
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/'/g, '"')

      try {
        const recovered = JSON.parse(fixed)
        console.log(`Recovered ${filePath} by fixing JSON`)
        fs.writeFileSync(filePath, JSON.stringify(recovered, null, 2))
        return recovered
      } catch (recoveryError) {
        console.error(`JSON recovery failed for ${filePath}:`, recoveryError)
        return fallback
      }
    }
  } catch (readError) {
    console.error(`Error reading ${filePath}:`, readError)

    const backupPath = filePath + '.backup'
    if (fs.existsSync(backupPath)) {
      try {
        const backupData = fs.readFileSync(backupPath, 'utf8')
        const parsedBackup = JSON.parse(backupData)
        console.log(`Restored ${filePath} from backup after read error`)
        fs.writeFileSync(filePath, backupData)
        return parsedBackup
      } catch (backupError) {
        console.error(`Backup restoration failed for ${filePath}:`, backupError)
      }
    }

    return fallback
  }
}

function saveJson(filePath, data) {
  try {
    if (fs.existsSync(filePath)) {
      const backupPath = filePath + '.backup'
      fs.copyFileSync(filePath, backupPath)
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return true
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error)

    const backupPath = filePath + '.backup'
    if (fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, filePath)
        console.log(`Restored ${filePath} from backup after save error`)
      } catch (restoreError) {
        console.error(`Failed to restore ${filePath} from backup:`, restoreError)
      }
    }

    return false
  }
}

module.exports = {
  loadJson,
  saveJson
}
