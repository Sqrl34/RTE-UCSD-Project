function parseJsonResponse(text, res) {
  if (!res.ok) {
    throw new Error(text || `Request failed (${res.status})`);
  }
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Response was not a JSON object");
    }
    return data;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(text?.slice(0, 120) || "Non-JSON body");
    }
    throw e;
  }
}

/**
 * POST /api/crews/analyze-batch — one request for all crews; dedupes weather + camera on server.
 */
export async function analyzeCrewBatch(apiBase, crews) {
  const base = String(apiBase).replace(/\/$/, "");
  const res = await fetch(`${base}/api/crews/analyze-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      crews: crews.map((c) => ({
        unit_id: c.unit_id,
        lat: c.lat,
        lon: c.lon,
      })),
    }),
  });

  const text = await res.text();
  const data = parseJsonResponse(text, res);

  if (!Array.isArray(data.results)) {
    throw new Error("Batch response missing results array");
  }

  return data.results;
}

/**
 * POST /api/crews/analyze — full weather, camera, and AI risk analysis.
 * @see backend/readme.md
 */
export async function analyzeCrew(apiBase, { unit_id, lat, lon }) {
  const base = String(apiBase).replace(/\/$/, "");
  const res = await fetch(`${base}/api/crews/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ unit_id, lat, lon }),
  });

  const text = await res.text();
  return parseJsonResponse(text, res);
}

/**
 * Default 5001: macOS often binds AirPlay to 5000, which breaks fetch (403).
 * Override with VITE_API_BASE_URL for other hosts/ports.
 */
export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001";
}
