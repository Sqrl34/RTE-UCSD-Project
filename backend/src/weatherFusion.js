const { sanitizeForLogs } = require('./lib/sanitizeForLogs')

const NOAA_POINTS_URL = 'https://api.weather.gov/points'
const NASA_POWER_URL = 'https://power.larc.nasa.gov/api/temporal/hourly/point'
const OWM_WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'
const OWM_AIR_URL = 'https://api.openweathermap.org/data/2.5/air_pollution'
const TOMORROW_REALTIME_URL = 'https://api.tomorrow.io/v4/weather/realtime'

const SOURCE_NAMES = {
  noaa: 'NOAA',
  nasa: 'NASA_POWER',
  realtime: 'OWM_OR_TOMORROW',
}

const VARIABLE_WEIGHTS = {
  temperature_c: { NOAA: 0.85, NASA_POWER: 0.75, OWM_OR_TOMORROW: 0.95 },
  wind_speed_ms: { NOAA: 0.85, NASA_POWER: 0.92, OWM_OR_TOMORROW: 0.9 },
  wind_direction_deg: { NOAA: 0.85, NASA_POWER: 0.92, OWM_OR_TOMORROW: 0.88 },
  humidity_pct: { NOAA: 0.85, NASA_POWER: 0.8, OWM_OR_TOMORROW: 0.9 },
  rainfall_mm_1h: { NOAA: 0.9, NASA_POWER: 0.7, OWM_OR_TOMORROW: 0.85 },
  aqi: { OWM_OR_TOMORROW: 0.95 },
}

const CONFLICT_THRESHOLDS = {
  temperature_c: 4,
  wind_speed_ms: 6,
  wind_direction_deg: 60,
  humidity_pct: 20,
  rainfall_mm_1h: 2,
  aqi: 40,
}

const cardinalToDeg = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
}

function safeNumber(value) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toIsoTimestamp(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function mphToMs(mph) {
  if (mph === null) return null
  return mph * 0.44704
}

function normalizeDegrees(value) {
  if (value === null) return null
  const mod = value % 360
  return mod < 0 ? mod + 360 : mod
}

function angularDifference(a, b) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function recencyFactor(observedAtIso) {
  if (!observedAtIso) return 0.55
  const ageMinutes = Math.max(0, (Date.now() - new Date(observedAtIso).getTime()) / 60000)
  if (!Number.isFinite(ageMinutes)) return 0.55
  return Math.max(0.25, 1 - ageMinutes / 180)
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${sanitizeForLogs(url)}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

function parseNoaaWindSpeedToMs(rawWindSpeed) {
  if (!rawWindSpeed || typeof rawWindSpeed !== 'string') return null
  const matches = rawWindSpeed.match(/(\d+(\.\d+)?)/g)
  if (!matches || matches.length === 0) return null
  const values = matches.map((entry) => Number(entry)).filter(Number.isFinite)
  if (values.length === 0) return null
  const mph = values.length === 1 ? values[0] : (values[0] + values[1]) / 2
  return mphToMs(mph)
}

function parseNoaaWindDirectionToDeg(rawDirection) {
  if (!rawDirection || typeof rawDirection !== 'string') return null
  const cleaned = rawDirection.trim().toUpperCase()
  return safeNumber(cardinalToDeg[cleaned])
}

async function fetchNoaa(lat, lon) {
  const points = await fetchJson(`${NOAA_POINTS_URL}/${lat},${lon}`)
  const hourlyUrl = points?.properties?.forecastHourly
  if (!hourlyUrl) throw new Error('NOAA points response missing forecastHourly URL')

  const forecast = await fetchJson(hourlyUrl)
  const firstPeriod = forecast?.properties?.periods?.[0]
  if (!firstPeriod) throw new Error('NOAA hourly forecast missing periods')

  const tempRaw = safeNumber(firstPeriod.temperature)
  const tempUnit = firstPeriod.temperatureUnit
  const temperatureC =
    tempRaw === null ? null : tempUnit === 'F' ? (tempRaw - 32) * (5 / 9) : tempRaw

  const precipitationValue = safeNumber(firstPeriod.probabilityOfPrecipitation?.value)
  const rainMm = precipitationValue === null ? null : (precipitationValue / 100) * 1

  return {
    source: SOURCE_NAMES.noaa,
    observedAt: toIsoTimestamp(firstPeriod.startTime),
    values: {
      temperature_c: temperatureC,
      wind_speed_ms: parseNoaaWindSpeedToMs(firstPeriod.windSpeed),
      wind_direction_deg: parseNoaaWindDirectionToDeg(firstPeriod.windDirection),
      humidity_pct: safeNumber(firstPeriod.relativeHumidity?.value),
      rainfall_mm_1h: rainMm,
      aqi: null,
    },
  }
}

function toYYYYMMDD(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

function getLatestNasaHour(parameters) {
  const candidateKeys = Object.keys(parameters?.T2M || {})
    .filter((key) => parameters.T2M[key] !== -999)
    .sort()
  if (candidateKeys.length === 0) return null
  return candidateKeys[candidateKeys.length - 1]
}

const NASA_POWER_LOOKBACK_DAYS = 7

async function fetchNasaPowerForDate(lat, lon, yyyymmdd) {
  const query = new URLSearchParams({
    parameters: 'WS10M,WS50M,WD10M,WD50M,RH2M,T2M,PRECTOTCORR',
    community: 'RE',
    longitude: String(lon),
    latitude: String(lat),
    format: 'JSON',
    start: yyyymmdd,
    end: yyyymmdd,
  })
  const data = await fetchJson(`${NASA_POWER_URL}?${query.toString()}`)
  const parameters = data?.properties?.parameter ?? null
  if (parameters) {
    const keys = Object.keys(parameters.T2M || {})
    const validKeys = keys.filter((k) => parameters.T2M[k] !== -999)
    console.log(`[NASA_POWER] ${yyyymmdd}: ${keys.length} hours, ${validKeys.length} valid`)
  } else {
    console.log(`[NASA_POWER] ${yyyymmdd}: no parameter block in response`)
  }
  return parameters
}

async function fetchNasaPower(lat, lon) {
  let parameters = null
  let latestHour = null

  for (let daysBack = 0; daysBack <= NASA_POWER_LOOKBACK_DAYS; daysBack++) {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - daysBack)
    const yyyymmdd = toYYYYMMDD(date)
    parameters = await fetchNasaPowerForDate(lat, lon, yyyymmdd)
    latestHour = parameters ? getLatestNasaHour(parameters) : null
    if (latestHour) break
  }

  if (!parameters) throw new Error('NASA POWER response missing parameters')
  if (!latestHour) throw new Error(`NASA POWER returned no valid hourly records in the last ${NASA_POWER_LOOKBACK_DAYS} days`)

  const ws10 = safeNumber(parameters.WS10M?.[latestHour])
  const ws50 = safeNumber(parameters.WS50M?.[latestHour])
  const wd10 = safeNumber(parameters.WD10M?.[latestHour])
  const wd50 = safeNumber(parameters.WD50M?.[latestHour])

  const makeObservedAt = `${latestHour.slice(0, 4)}-${latestHour.slice(4, 6)}-${latestHour.slice(
    6,
    8
  )}T${latestHour.slice(8, 10)}:00:00.000Z`

  return {
    source: SOURCE_NAMES.nasa,
    observedAt: makeObservedAt,
    values: {
      temperature_c: safeNumber(parameters.T2M?.[latestHour]),
      wind_speed_ms:
        ws10 !== null && ws50 !== null ? (ws10 + ws50) / 2 : ws50 !== null ? ws50 : ws10,
      wind_direction_deg:
        wd10 !== null && wd50 !== null ? normalizeDegrees((wd10 + wd50) / 2) : normalizeDegrees(wd50 ?? wd10),
      humidity_pct: safeNumber(parameters.RH2M?.[latestHour]),
      rainfall_mm_1h: safeNumber(parameters.PRECTOTCORR?.[latestHour]),
      aqi: null,
    },
  }
}

async function fetchTomorrowRealtime(lat, lon, apiKey) {
  const query = new URLSearchParams({
    location: `${lat},${lon}`,
    apikey: apiKey,
    units: 'metric',
  })
  const data = await fetchJson(`${TOMORROW_REALTIME_URL}?${query.toString()}`)
  const values = data?.data?.values || {}
  const observedAt = toIsoTimestamp(data?.data?.time)

  return {
    source: SOURCE_NAMES.realtime,
    observedAt,
    values: {
      temperature_c: safeNumber(values.temperature),
      wind_speed_ms: safeNumber(values.windSpeed),
      wind_direction_deg: normalizeDegrees(safeNumber(values.windDirection)),
      humidity_pct: safeNumber(values.humidity),
      rainfall_mm_1h: safeNumber(values.precipitationIntensity),
      aqi: safeNumber(values.epaIndex ?? values.usEpaIndex ?? values.aqi),
    },
  }
}

async function fetchOwmRealtime(lat, lon, apiKey) {
  const weatherQuery = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
    units: 'metric',
  })
  const weather = await fetchJson(`${OWM_WEATHER_URL}?${weatherQuery.toString()}`)

  const airQuery = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: apiKey,
  })
  const air = await fetchJson(`${OWM_AIR_URL}?${airQuery.toString()}`)
  const firstAir = air?.list?.[0]

  return {
    source: SOURCE_NAMES.realtime,
    observedAt: toIsoTimestamp((weather?.dt || 0) * 1000),
    values: {
      temperature_c: safeNumber(weather?.main?.temp),
      wind_speed_ms: safeNumber(weather?.wind?.speed),
      wind_direction_deg: normalizeDegrees(safeNumber(weather?.wind?.deg)),
      humidity_pct: safeNumber(weather?.main?.humidity),
      rainfall_mm_1h: safeNumber(weather?.rain?.['1h']) ?? 0,
      aqi: safeNumber(firstAir?.main?.aqi),
    },
  }
}

function scoreCandidate(variableName, candidate) {
  const reliability = VARIABLE_WEIGHTS?.[variableName]?.[candidate.source] ?? 0.5
  return reliability * recencyFactor(candidate.observedAt)
}

function pickCanonicalValue(variableName, candidates) {
  const valid = candidates.filter((candidate) => candidate.value !== null && candidate.value !== undefined)
  if (valid.length === 0) return null

  const ranked = valid
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(variableName, candidate),
    }))
    .sort((a, b) => b.score - a.score)

  return ranked[0]
}

function detectConflict(variableName, candidates) {
  const threshold = CONFLICT_THRESHOLDS[variableName]
  if (!threshold) return false
  const valid = candidates.filter((candidate) => candidate.value !== null && candidate.value !== undefined)
  if (valid.length < 2) return false

  const [a, b] = valid.slice(0, 2)
  if (variableName === 'wind_direction_deg') {
    return angularDifference(a.value, b.value) > threshold
  }

  return Math.abs(a.value - b.value) > threshold
}

function buildCandidatesForVariable(variableName, datasets) {
  return datasets
    .map((dataset) => ({
      source: dataset.source,
      observedAt: dataset.observedAt,
      value: dataset.values[variableName] ?? null,
    }))
    .filter((item) => item.value !== null && item.value !== undefined)
}

function computeConfidence(conflictVariables, datasetCount) {
  if (conflictVariables.length > 0) return 'low'
  if (datasetCount >= 3) return 'high'
  return datasetCount === 2 ? 'medium' : 'low'
}

// Tomorrow.io free tier: 25 calls/hour. Cache per coordinate for 3 min to stay safely under limit.
const REALTIME_CACHE_TTL_MS = 3 * 60 * 1000
const realtimeCache = new Map()

function realtimeCacheKey(lat, lon) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`
}

async function fetchRealtimeSource(lat, lon) {
  const provider = (process.env.WEATHER_REALTIME_PROVIDER || 'tomorrow').toLowerCase()

  const cacheKey = realtimeCacheKey(lat, lon)
  const cached = realtimeCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < REALTIME_CACHE_TTL_MS) {
    const ageSeconds = Math.round((Date.now() - cached.fetchedAt) / 1000)
    console.log(`[REALTIME] cache hit for ${cacheKey} (age: ${ageSeconds}s)`)
    return cached.data
  }

  if (provider === 'tomorrow') {
    if (!process.env.TOMORROW_API_KEY) {
      throw new Error('TOMORROW_API_KEY is required when WEATHER_REALTIME_PROVIDER=tomorrow')
    }
    const data = await fetchTomorrowRealtime(lat, lon, process.env.TOMORROW_API_KEY)
    realtimeCache.set(cacheKey, { fetchedAt: Date.now(), data })
    return data
  }

  if (!process.env.OWM_API_KEY) {
    throw new Error('OWM_API_KEY is required when WEATHER_REALTIME_PROVIDER=owm')
  }
  const data = await fetchOwmRealtime(lat, lon, process.env.OWM_API_KEY)
  realtimeCache.set(cacheKey, { fetchedAt: Date.now(), data })
  return data
}

async function buildFusedWeather(lat, lon) {
  const sourceLabels = ['NOAA', 'NASA_POWER', 'REALTIME']
  const requests = [
    fetchNoaa(lat, lon),
    fetchNasaPower(lat, lon),
    fetchRealtimeSource(lat, lon),
  ]
  const settled = await Promise.allSettled(requests)

  settled.forEach((result, i) => {
    if (result.status === 'rejected') {
      const msg = result.reason?.message || result.reason
      console.error(`[weather] ${sourceLabels[i]} failed: ${sanitizeForLogs(msg)}`)
    } else {
      console.log(`[weather] ${sourceLabels[i]} ok (observedAt: ${result.value.observedAt})`)
    }
  })

  const datasets = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)

  if (datasets.length === 0) {
    const reasons = settled
      .filter((result) => result.status === 'rejected')
      .map((result) =>
        sanitizeForLogs(result.reason?.message || String(result.reason))
      )
    throw new Error(`All weather providers failed: ${reasons.join(' | ')}`)
  }

  const variableNames = [
    'temperature_c',
    'wind_speed_ms',
    'wind_direction_deg',
    'humidity_pct',
    'rainfall_mm_1h',
    'aqi',
  ]

  const canonical = {}
  const conflictVariables = []
  for (const variableName of variableNames) {
    const candidates = buildCandidatesForVariable(variableName, datasets)
    const selected = pickCanonicalValue(variableName, candidates)
    canonical[variableName] = selected ? Number(selected.value.toFixed(2)) : null

    if (detectConflict(variableName, candidates)) {
      conflictVariables.push(variableName)
    }
  }

  return {
    lat,
    lon,
    timestamp: new Date().toISOString(),
    ...canonical,
    confidence: computeConfidence(conflictVariables, datasets.length),
    sources: [...new Set(datasets.map((dataset) => dataset.source))],
    conflicts: conflictVariables,
    refresh_guidance: {
      noaa_nasa_minutes: '15-30',
      realtime_minutes: '2-5',
    },
  }
}

module.exports = {
  buildFusedWeather,
}
