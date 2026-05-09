const mockWeather = require("../data/mockWeather.json");

async function getWeatherForCoordinates(lat, lon) {
  try {
    /*
      CEURTY INTEGRATION GOES HERE LATER.

      Expected Ceurty function shape:

      const weather = await ceurtyGetWeather(lat, lon);

      Expected return:
      {
        wind_speed: 18,
        wind_direction: "W",
        aqi: 145,
        temperature: 86,
        humidity: 22
      }
    */

    return {
      ...mockWeather,
      source: "mock_weather",
      lat,
      lon
    };
  } catch (error) {
    console.error("Weather service failed:", error.message);

    return {
      ...mockWeather,
      source: "mock_weather_fallback",
      lat,
      lon
    };
  }
}

module.exports = {
  getWeatherForCoordinates
};