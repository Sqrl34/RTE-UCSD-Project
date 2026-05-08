function buildJsonExport(results) {
  return results.map((item) => ({
    unit_id: item.unit_id,
    lat: item.lat,
    lon: item.lon,
    analyzed_at: item.analyzed_at,
    risk_score: item.risk_score,
    risk_level: item.risk_level,
    primary_reason: item.primary_reason,
    risk_reasons: item.risk_reasons,
    weather: item.weather,
    camera: item.camera
  }));
}

function buildGeoJsonExport(results) {
  return {
    type: "FeatureCollection",
    features: results.map((item) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [item.lon, item.lat]
      },
      properties: {
        unit_id: item.unit_id,
        analyzed_at: item.analyzed_at,
        risk_score: item.risk_score,
        risk_level: item.risk_level,
        primary_reason: item.primary_reason,
        wind_speed: item.weather?.wind_speed,
        wind_direction: item.weather?.wind_direction,
        aqi: item.weather?.aqi,
        smoke_detected: item.camera?.smoke_detected,
        fire_detected: item.camera?.fire_detected,
        visibility_status: item.camera?.visibility_status,
        camera_caption: item.camera?.camera_caption
      }
    }))
  };
}

module.exports = {
  buildJsonExport,
  buildGeoJsonExport
};