const fs = require('fs')
const multer = require('multer')
const path = require('path')

const uploadDir = path.join(__dirname, '..', 'public', 'uploads')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '')
    const base = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, base + ext)
  }
})

function fileFilter(req, file, cb) {
  const allowed = ['image/png', 'image/jpeg']
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Invalid file type'))
  }
  cb(null, true)
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
})

module.exports = {
  upload,
  uploadDir
}
