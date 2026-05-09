const mockWeather = require("../data/mockWeather.json");
const { buildFusedWeather } = require("../weatherFusion");

async function getWeatherForCoordinates(lat, lon) {
  try {
    const fused = await buildFusedWeather(lat, lon);
    return {
      wind_speed: fused.wind_speed_ms,
      wind_direction: fused.wind_direction_deg,
      aqi: fused.aqi,
      temperature: fused.temperature_c,
      humidity: fused.humidity_pct,
      rainfall_mm_1h: fused.rainfall_mm_1h,
      confidence: fused.confidence,
      sources: fused.sources,
      conflicts: fused.conflicts,
      source: "fused_weather",
      lat,
      lon,
    };
  } catch (error) {
    console.error("Weather fusion failed, falling back to mock:", error.message);
    return {
      ...mockWeather,
      source: "mock_weather_fallback",
      lat,
      lon,
    };
  }
}

module.exports = {
  getWeatherForCoordinates
};