const mockWeather = require("../data/mockWeather.json");
const { buildFusedWeather } = require("../weatherFusion");

function degreesToCardinal(deg) {
  if (deg == null || !Number.isFinite(Number(deg))) return "unknown";

  const directions = [
    "N", "NE", "E", "SE", "S", "SW", "W", "NW"
  ];

  const index = Math.round(Number(deg) / 45) % 8;
  return directions[index];
}

async function getWeatherForCoordinates(lat, lon) {
  try {
    const rawWeather = await buildFusedWeather(lat, lon);
    return normalizeWeather(rawWeather, lat, lon);
  } catch (error) {
    console.error("Weather integration failed:", error.message);

    return normalizeWeather(
      {
        ...mockWeather,
        source: "mock_weather_fallback"
      },
      lat,
      lon
    );
  }
}

function normalizeWeather(raw, lat, lon) {
  const windSpeedMs = Number(raw.wind_speed_ms ?? 0);
  const windSpeedMph = windSpeedMs * 2.23694;

  return {
    wind_speed: Number(windSpeedMph.toFixed(1)),
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
    source: "weather_fusion",
    lat,
    lon,
    raw
  };
}

module.exports = {
  getWeatherForCoordinates
};
