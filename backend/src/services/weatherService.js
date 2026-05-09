const mockWeather = require("../data/mockWeather.json");
const { buildFusedWeather } = require("../weatherFusion");
const { sanitizeForLogs } = require("../lib/sanitizeForLogs");
const { geoBucketKey } = require("./geoBucket");

const weatherCache = new Map();
const WEATHER_CACHE_TTL_MS =
  Number(process.env.WEATHER_CACHE_TTL_MS) || 10 * 60 * 1000;

function degreesToCardinal(deg) {
  if (deg == null || !Number.isFinite(Number(deg))) return "unknown";

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(Number(deg) / 45) % 8;

  return directions[index];
}

function attachWeatherCoords(weather, lat, lon) {
  const raw = weather.raw
    ? { ...weather.raw, lat, lon }
    : weather.raw;
  return {
    ...weather,
    lat,
    lon,
    raw,
  };
}

async function getWeatherForCoordinatesUncached(lat, lon) {
  try {
    const rawWeather = await buildFusedWeather(lat, lon);
    return normalizeWeather(rawWeather, lat, lon);
  } catch (error) {
    console.error("Weather integration failed:", sanitizeForLogs(error.message));

    return normalizeWeather(
      {
        ...mockWeather,
        source: "mock_weather_fallback",
      },
      lat,
      lon
    );
  }
}

async function getWeatherForCoordinates(lat, lon) {
  const key = geoBucketKey(lat, lon);
  const now = Date.now();
  const hit = weatherCache.get(key);
  if (hit && now - hit.at < WEATHER_CACHE_TTL_MS) {
    return attachWeatherCoords(hit.payload, lat, lon);
  }

  const payload = await getWeatherForCoordinatesUncached(lat, lon);
  weatherCache.set(key, { at: now, payload });
  return attachWeatherCoords(payload, lat, lon);
}

function normalizeWeather(raw, lat, lon) {
  const windSpeedMs =
    raw.wind_speed_ms == null ? null : Number(raw.wind_speed_ms);

  const windSpeedMph =
    windSpeedMs == null ? null : Number((windSpeedMs * 2.23694).toFixed(1));

  return {
    wind_speed: windSpeedMph,
    wind_speed_ms: windSpeedMs,
    wind_direction: degreesToCardinal(raw.wind_direction_deg),
    wind_direction_deg: raw.wind_direction_deg ?? null,
    aqi: raw.aqi == null ? null : Number(raw.aqi),
    temperature_c: raw.temperature_c ?? null,
    temperature_f:
      raw.temperature_c != null
        ? Number(((raw.temperature_c * 9) / 5 + 32).toFixed(1))
        : null,
    humidity: raw.humidity_pct ?? null,
    rainfall_mm_1h: raw.rainfall_mm_1h ?? null,
    confidence: raw.confidence ?? "unknown",
    sources: raw.sources ?? [],
    conflicts: raw.conflicts ?? [],
    source:
      raw.source === "mock_weather_fallback"
        ? "mock_weather_fallback"
        : "weather_fusion",
    lat,
    lon,
    raw
  };
}

module.exports = {
  getWeatherForCoordinates,
};