const path = require('path')
const dotenv = require('dotenv')

const backendRoot = path.join(__dirname, '..')
dotenv.config({ path: path.join(backendRoot, '.venv', '.env') })
dotenv.config({ path: path.join(backendRoot, '.env') })

const express = require('express')
const cors = require('cors')

const weatherRouter = require('./routes/weatherRoutes')
const crewRoutes = require('./routes/crews')
const exportRoutes = require('./routes/exports')
const classificationRoutes = require('./routes/classification')

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ service: 'backend', health: '/health', weather: '/weather' })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/weather', weatherRouter)
app.use('/api/crews', crewRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/classification', classificationRoutes)

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`)
})
