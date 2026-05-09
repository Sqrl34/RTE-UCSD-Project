# CrewTrace Backend API

The backend takes crew coordinates, fuses weather (NOAA, NASA POWER, and a realtime provider), runs nearby camera + smoke/fire classification, and returns wildfire-style risk scores (Gemini when configured, with rule-based fallbacks when APIs fail or hit quota).

---

## Quick start

1. **Install dependencies** (from this folder):

   ```bash
   cd backend
   npm install
   ```

2. **Create `.env`** in `backend/` (same folder as `package.json`). See [Environment variables](#environment-variables) below. At minimum, set keys for the realtime weather provider you use and any optional AI keys you want.

3. **Run the server**:

   ```bash
   npm run dev
   ```

   Default URL: `http://localhost:5000` unless you set `PORT`.

4. **Point the frontend at this server**  
   In `frontend/.env` (or your Vite env), set:

   ```bash
   VITE_API_BASE_URL=http://localhost:<PORT>
   ```

   Use the same host and port as `PORT` (see next section).

---

## Port and macOS (AirPlay)

On many Macs, **port 5000 is used by AirPlay Receiver** (AirTunes). If `http://localhost:5000` returns 403 or not your API, run the backend on another port:

```bash
PORT=5001 npm run dev
```

Then set `VITE_API_BASE_URL=http://localhost:5001` and, if the backend calls its own classification route, set **`CLASSIFICATION_URL`** to match (see below).

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `5000`). |
| `GEMINI_API_KEY` | No | If unset, risk scores use the **local fallback** (weather + camera heuristics). If set, `/api/crews/analyze-batch` uses **one** batched Gemini request per batch (not one call per crew). |
| `GEMINI_MODEL` | No | Default `gemini-2.5-flash`. |
| `WEATHER_REALTIME_PROVIDER` | No | `tomorrow` (default) or `owm`. |
| `TOMORROW_API_KEY` | Yes* | *Required when provider is `tomorrow`.* Tomorrow.io realtime weather. |
| `OWM_API_KEY` | Yes* | *Required when provider is `owm`.* OpenWeatherMap key for weather + air quality. |
| `ROBOFLOW_API_KEY` | No | If missing, classification warns at startup; camera path may not detect smoke/fire reliably. |
| `CLASSIFICATION_URL` | No | URL for `POST .../api/classification` **as seen by this Node process**. Default `http://localhost:5000/api/classification`. If you use `PORT=5001`, set e.g. `http://localhost:5001/api/classification`. |
| `WEATHER_CACHE_TTL_MS` | No | Weather cache TTL (default 10 minutes). |
| `CAMERA_CACHE_TTL_MS` | No | Camera/classification cache TTL (default 15 minutes). |
| `ANALYZE_GEO_BUCKET_DECIMALS` | No | Rounds lat/lon for deduping weather + camera fetches across nearby crews. |
| `CLASSIFICATION_MAX_CAMERAS` | No | Max cameras analyzed per coordinate (default 3, cap 10). |
| `CLASSIFICATION_MULTI_CROP` | No | Set `true` for legacy multi-crop mode (more Roboflow calls). |
| `ROBOFLOW_CONFIDENCE_MIN` | No | Roboflow confidence floor (default 35). |

**Secrets:** Do not commit `.env`. If a key ever appears in logs or chat, **rotate it** in the provider’s dashboard. The backend **redacts** common query parameters (e.g. `apikey`, `appid`) in error strings before logging or returning some error messages, but that is not a substitute for keeping keys private.

---

## API quotas and behavior

- **Gemini (free tier):** Daily request limits apply per model/project. If you exceed them, you will see `RESOURCE_EXHAUSTED` / 429-style errors in logs; the API still returns JSON using **fallback** risk scoring for affected calls.
- **Tomorrow.io / OpenWeather:** Rate limits apply. Realtime failures are logged; fusion can still use NOAA + NASA POWER when realtime fails.
- **`POST /api/crews/analyze-batch`:** Fetches **weather + camera once per geographic bucket** (not once per crew when crews share a bucket), then **one** Gemini `generateContent` for the whole batch when `GEMINI_API_KEY` is set.

Server logs include lines such as `[analyze-batch] context: …` and `[gemini] batch: invoking 1× generateContent` so you can confirm deduplication and a single batched AI call per batch request.

---

## Base URL

```
http://localhost:<PORT>
```

---

## Main endpoints

### Analyze one crew

`POST /api/crews/analyze`

**Body:**

```json
{
  "unit_id": "Alpha-1",
  "lat": 34.148,
  "lon": -118.289
}
```

### Analyze many crews (dashboard)

`POST /api/crews/analyze-batch`

**Body:**

```json
{
  "crews": [
    { "unit_id": "Alpha-1", "lat": 34.148, "lon": -118.289 },
    { "unit_id": "Alpha-2", "lat": 34.15, "lon": -118.29 }
  ]
}
```

**Response:** `{ "results": [ /* same shape as single analyze per crew */ ] }`

### Latest analyses

`GET /api/crews/latest` — in-memory snapshot from recent analyze calls.

### Other routes

- `GET /` — service index and route list  
- `POST /api/weather/fused` — fused weather for `{ lat, lon }`  
- `POST /api/classification` — camera / Roboflow pipeline for a coordinate  

---

## Response shape (single crew / each batch item)

```json
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
  "risk_reasons": ["Reason 1", "Reason 2"],

  "explanation": "Plain-English explanation of the situation",

  "recommended_command_review": "What command should check",
  "recommended_questions": ["Question 1", "Question 2"],

  "analyzed_at": "timestamp"
}
```

---

## Calling from the frontend

**Single crew:**

```javascript
async function analyzeCrew(unit_id, lat, lon) {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  const res = await fetch(`${base}/api/crews/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unit_id, lat, lon }),
  });

  if (!res.ok) throw new Error("Failed to analyze crew");
  return res.json();
}
```

**Batch:**

```javascript
async function analyzeCrewBatch(crews) {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  const res = await fetch(`${base}/api/crews/analyze-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crews }),
  });
  if (!res.ok) throw new Error("Failed to analyze batch");
  const data = await res.json();
  return data.results;
}
```

---

## Key fields for UI

**Map / markers:** `lat`, `lon`, `risk_score`, `risk_level`  

**Crew cards:** `unit_id`, `risk_level`, `primary_reason`, `explanation`  

**Weather:** `weather.wind_speed`, `weather.wind_direction`, `weather.temperature_f`, `weather.humidity`, `weather.aqi ?? "N/A"`  

**Camera:** `camera.camera_available`, `camera.hazard_detected`, `camera.camera_caption`, `camera.image_url`  

---

## Important notes

1. **Only send coordinates (and `unit_id`) from the client.** Do not compute risk on the frontend; the backend owns weather, camera, and scoring.

2. **Response time:** Often on the order of a few seconds per analyze (external APIs + optional Gemini). Use loading states.

3. **`aqi` may be null** — display as `"N/A"`.

4. **`camera.camera_available === false`** means no usable nearby camera, not necessarily a hard error.

5. **Responses stay JSON-shaped even when upstream services fail** — fallbacks and partial fusion are expected; inspect `weather` / `camera` / `risk_score` for plausibility.

---

## Troubleshooting

| Symptom | What to do |
|--------|------------|
| 403 on `localhost:5000` | Often not Express — try another port (`PORT=5001`) or disable AirPlay Receiver using port 5000. |
| Frontend cannot reach API | Align `VITE_API_BASE_URL` with `PORT` and CORS (backend enables CORS for typical dev). |
| Camera always mock / errors | Set `CLASSIFICATION_URL` to this server’s classification URL if not on port 5000. |
| Gemini / Tomorrow / OWM 429 in logs | Check provider quotas and billing; rotate keys if leaked; expect heuristic or partial data until quotas reset. |
| Duplicate work in dev | Two browser tabs or two overlapping `analyze-batch` requests each do full work; the frontend may dedupe Strict Mode double-fetches, but multiple clients do not share that state. |

---

## Test route

`GET /` returns JSON describing the running service and main endpoints.
