const express = require('express')
const cors = require('cors')

const app = express()
const port = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`)
})
