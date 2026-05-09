CrewTrace Backend API

This backend provides a single endpoint that takes in coordinates and returns a full wildfire risk analysis using weather data, camera feeds, and AI.

Base URL
http://localhost:5000

Main Endpoint (Use This)
Analyze Crew / Coordinates

POST /api/crews/analyze
Request Body
{
  "unit_id": "Alpha-1",
  "lat": 34.148,
  "lon": -118.289
}

Response Format
{
  "unit_id": "Alpha-1",
  "lat": 34.148,
  "lon": -118.289,

  "weather": {
    "wind_speed": 12.4,
    "wind_direction": "NW",
    "aqi": null,
    "temperature_f": 75,
    "humidity": 60,
    "confidence": "high"
  },

  "camera": {
    "camera_available": true,
    "hazard_detected": false,
    "smoke_detected": false,
    "fire_detected": false,
    "visibility_status": "clear",
    "camera_caption": "No reliable smoke or fire detected nearby",
    "camera_risk_level": "none",
    "best_camera": "Camera Name",
    "image_url": "https://..."
  },

  "risk_score": 4,
  "risk_level": "Moderate",

  "primary_reason": "Main reason for risk level",
  "risk_reasons": [
    "Reason 1",
    "Reason 2"
  ],

  "explanation": "Plain-English explanation of the situation",

  "recommended_command_review": "What command should check",
  "recommended_questions": [
    "Question 1",
    "Question 2"
  ],

  "confidence": "low | medium | high",
  "analyzed_at": "timestamp"
}

How to Call from Frontend:

async function analyzeCrew(unit_id, lat, lon) {
  const res = await fetch("/api/crews/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ unit_id, lat, lon })
  });

  if (!res.ok) {
    throw new Error("Failed to analyze crew");
  }

  return res.json();
}

Key Fields for UI:
For Map / Markers
crew.lat
crew.lon
crew.risk_score
crew.risk_level

For Crew Cards:
crew.unit_id
crew.risk_level
crew.primary_reason
crew.explanation

Weather Display:
crew.weather.wind_speed
crew.weather.wind_direction
crew.weather.temperature_f
crew.weather.humidity
crew.weather.aqi ?? "N/A"

Camera Display:
crew.camera.camera_available
crew.camera.hazard_detected
crew.camera.camera_caption
crew.camera.image_url

Important Notes
1. Only send coordinates

Frontend should NOT calculate anything.

{ unit_id, lat, lon }

Backend handles:

Weather
Camera analysis
AI risk scoring
2. Response time

This endpoint may take:

2-6 seconds

Because it calls:

NOAA + NASA + realtime weather APIs
Camera image processing + AI detection
Gemini AI

👉 Use loading states in UI.

3. AQI may be null
crew.weather.aqi === null
Display as:
"N/A"

4. Camera availability
crew.camera.camera_available === false

Means no nearby camera — not an error.

5. Always expect fallback-safe responses

Even if:
AI fails
weather API fails
camera fails
Backend still returns valid JSON.

Test Endpoint
GET /

Returns:

{
  "status": "running"
}
Summary

Frontend only needs to:

send coordinates → receive risk analysis → display

Everything else is handled by the backend.

If anything breaks, check:

network request status
response JSON
console errors