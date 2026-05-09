const express = require('express')
const { buildFusedWeather } = require('../weatherFusion')

const provider = (process.env.WEATHER_REALTIME_PROVIDER || 'tomorrow').toLowerCase()
console.log(`[weather] Realtime provider: ${provider}`)
if (provider === 'tomorrow' && !process.env.TOMORROW_API_KEY) {
  console.warn('[weather] WARNING: TOMORROW_API_KEY is not set — realtime source will fail')
} else if (provider === 'owm' && !process.env.OWM_API_KEY) {
  console.warn('[weather] WARNING: OWM_API_KEY is not set — realtime source will fail')
} else {
  console.log('[weather] API key present for realtime provider')
}

const weatherRouter = express.Router()

weatherRouter.get('/', (_req, res) => {
  res.json({
    scope: 'weather',
    endpoints: {
      fused: 'POST /weather/fused — JSON body: { lat, lon }',
    },
  })
})

// Hardcoded test coordinate — San Diego (32.88, -117.23)
weatherRouter.get('/test', async (_req, res) => {
  const TEST_LAT = 32.88
  const TEST_LON = -117.23

  try {
    const weather = await buildFusedWeather(TEST_LAT, TEST_LON)
    return res.json({ _test: true, lat: TEST_LAT, lon: TEST_LON, ...weather })
  } catch (error) {
    return res.status(502).json({
      _test: true,
      error: 'Weather fusion failed',
      message: error.message,
    })
  }
})

weatherRouter.post('/fused', async (req, res) => {
  const lat = Number(req.body?.lat)
  const lon = Number(req.body?.lon)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({
      error: 'Invalid coordinates',
      message: 'Provide numeric lat and lon in request body.',
    })
  }

  try {
    const weather = await buildFusedWeather(lat, lon)
    return res.json(weather)
  } catch (error) {
    return res.status(502).json({
      error: 'Weather fusion failed',
      message: error.message,
    })
  }
})

module.exports = weatherRouter
