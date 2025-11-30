const express = require('express')
const app = express()

app.get('/', (req, res) => {
res.send('Stocker is live')
})

app.listen(3000, '0.0.0.0', () => {
console.log('Server running on port 3000')
})
