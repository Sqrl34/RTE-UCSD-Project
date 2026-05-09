# CrewTrace

Dashboard-style app for crew locations on a map with **fused weather**, **nearby camera / smoke–fire signals**, and **AI-assisted wildfire risk scores** (Gemini when configured, with safe fallbacks when APIs are missing or rate-limited).

## Repository layout

| Path | Role |
|------|------|
| `frontend/` | React + Vite UI (Leaflet map, crew cards, risk panel) |
| `backend/` | Express API — weather fusion, classification, `/api/crews/analyze` and `/api/crews/analyze-batch` |

Full API reference, every environment variable, quotas, and troubleshooting: **[backend/readme.md](backend/readme.md)**.

## Prerequisites

- **Node.js** (LTS recommended) and npm  
- API keys as needed: see [backend/readme.md](backend/readme.md) (`GEMINI_API_KEY`, `TOMORROW_API_KEY` or `OWM_API_KEY`, `ROBOFLOW_API_KEY`, etc.)

## Quick start

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env` (see [backend/readme.md](backend/readme.md)). On macOS, port **5000** is often taken by **AirPlay**; using **5001** is typical:

```bash
PORT=5001 npm run dev
```

If the backend is not on the default the frontend expects, set **`CLASSIFICATION_URL`** in `backend/.env` to this server’s classification URL (e.g. `http://localhost:5001/api/classification`).

### 2. Frontend

```bash
cd frontend
npm install
```

Optional: create `frontend/.env` so the UI targets your API:

```bash
VITE_API_BASE_URL=http://localhost:5001
```

If unset, the app defaults to `http://localhost:5001` (see `frontend/src/api/crewTraceApi.js`).

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Scripts

**Frontend** (`frontend/`): `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`  

**Backend** (`backend/`): `npm run dev` (nodemon), `npm start`

## Security

- Do **not** commit real `.env` files or API keys.  
- Rotate any key that has been pasted into logs, chat, or a public repo.  
- The backend redacts common secret query parameters in many log and error paths; treat that as a safety net, not a reason to expose keys.

## Stack notes

- **Frontend:** React 19, Vite, Leaflet / react-leaflet  
- **Backend:** Express 5, weather fusion (NOAA, NASA POWER, Tomorrow.io or OpenWeather), Roboflow-based classification, optional Google Gemini for batched risk text/scores on `analyze-batch`
