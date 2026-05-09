const mockCamera = require("../data/mockCamera.json");
const { geoBucketKey } = require("./geoBucket");
const { sanitizeForLogs } = require("../lib/sanitizeForLogs");

const CLASSIFICATION_URL =
  process.env.CLASSIFICATION_URL || "http://localhost:5000/api/classification";

const cameraCache = new Map();
const CAMERA_CACHE_TTL_MS =
  Number(process.env.CAMERA_CACHE_TTL_MS) || 15 * 60 * 1000;

function attachCameraCoords(camera, lat, lon) {
  const raw = camera.raw
    ? {
        ...camera.raw,
        requestedCoordinate: { x: lat, y: lon },
      }
    : camera.raw;
  return {
    ...camera,
    lat,
    lon,
    raw,
  };
}

async function getCameraRiskForCoordinatesUncached(lat, lon) {
  const response = await fetch(CLASSIFICATION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      x: lat,
      y: lon,
    }),
  });

  if (!response.ok) {
    throw new Error(`Classification route failed with status ${response.status}`);
  }

  const rawCamera = await response.json();
  return normalizeCamera(rawCamera, lat, lon);
}

async function getCameraRiskForCoordinates(lat, lon) {
  const key = geoBucketKey(lat, lon);
  const now = Date.now();
  const hit = cameraCache.get(key);
  if (hit && now - hit.at < CAMERA_CACHE_TTL_MS) {
    return attachCameraCoords(hit.payload, lat, lon);
  }

  try {
    const payload = await getCameraRiskForCoordinatesUncached(lat, lon);
    cameraCache.set(key, { at: now, payload });
    return attachCameraCoords(payload, lat, lon);
  } catch (error) {
    console.error("Camera integration failed:", sanitizeForLogs(error.message));

    return normalizeCamera(
      {
        ...mockCamera,
        source: "mock_camera_fallback",
      },
      lat,
      lon
    );
  }
}

function normalizeCamera(raw, lat, lon) {
  const cameras = Array.isArray(raw.cameras) ? raw.cameras : [];

  const bestCamera =
    cameras.find((camera) => camera.detected) ||
    cameras[0] ||
    null;

  const detectedClass = bestCamera?.class || "";
  const message = raw.message || bestCamera?.message || "No camera summary available.";

  const lowerText = `${detectedClass} ${message}`.toLowerCase();

  const peakConfidence = Number(
    raw.highestConfidence ?? bestCamera?.confidence ?? 0
  );

  const hazardDetected =
    Boolean(raw.overallDetected ?? raw.detected ?? false) &&
    peakConfidence >= 0.52;

  const smokeDetected =
    hazardDetected &&
    (lowerText.includes("smoke") || lowerText.includes("wildfire"));

  const fireDetected =
    hazardDetected &&
    (lowerText.includes("fire") || lowerText.includes("flame"));

  return {
    camera_available: Number(raw.cameraCount || cameras.length || 0) > 0,

    hazard_detected: hazardDetected,
    smoke_detected: smokeDetected,
    fire_detected: fireDetected,

    visibility_status: hazardDetected ? "reduced" : "clear",

    camera_caption: message,
    condition_change: "unknown",

    camera_risk_level: raw.overallRiskLevel || bestCamera?.riskLevel || "unknown",
    best_camera: raw.bestCamera || bestCamera?.cameraName || null,
    highest_confidence: Number(raw.highestConfidence || bestCamera?.confidence || 0),

    image_url: bestCamera?.imageURL || null,
    cameras,

    source: raw.source || "classification_route",
    lat,
    lon,

    raw
  };
}

module.exports = {
  getCameraRiskForCoordinates
};