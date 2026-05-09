const express = require("express");
const sharp = require("sharp");
const FormData = require("form-data");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const router = express.Router();

const camerasData = require("../data/alert_california_cameras.json");

const ROBOFLOW_MODEL_URL = "https://detect.roboflow.com/wildfire-smoke/1";
const ROBOFLOW_CONFIDENCE = 10;

// Smaller radius + camera cap to reduce noise and API calls
const MAX_DISTANCE_MILES = 5;
const MAX_CAMERAS = 5;

if (!process.env.ROBOFLOW_API_KEY) {
  console.warn("ROBOFLOW_API_KEY is missing. Set it in backend/.env");
}

function webMercatorToLatLon(x, y) {
  const R = 6378137;
  const lon = (x / R) * (180 / Math.PI);
  const lat =
    (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);

  return { lat, lon };
}

function getCameraLatLon(camera) {
  const gx = camera.geometry?.x;
  const gy = camera.geometry?.y;

  if (gx == null || gy == null) return null;

  return webMercatorToLatLon(gx, gy);
}

function milesBetween(lat1, lon1, lat2, lon2) {
  const R = 3958.8;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchImageBuffer(imageURL) {
  const response = await fetch(imageURL);

  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function postToRoboflow(imageBuffer) {
  const form = new FormData();

  form.append("file", imageBuffer, {
    filename: "image.jpg",
    contentType: "image/jpeg",
  });

  const url =
    `${ROBOFLOW_MODEL_URL}` +
    `?api_key=${process.env.ROBOFLOW_API_KEY}` +
    `&confidence=${ROBOFLOW_CONFIDENCE}`;

  const response = await fetch(url, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  return response.json();
}

function buildCropRegions(width, height) {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  const centerW = Math.floor(width * 0.6);
  const centerH = Math.floor(height * 0.6);

  return [
    { left: 0, top: 0, width, height },
    { left: 0, top: 0, width, height: halfH },
    { left: 0, top: halfH, width, height: height - halfH },
    { left: 0, top: 0, width: halfW, height },
    { left: halfW, top: 0, width: width - halfW, height },
    {
      left: Math.floor((width - centerW) / 2),
      top: Math.floor((height - centerH) / 2),
      width: centerW,
      height: centerH,
    },
  ];
}

async function makeCrop(originalBuffer, region) {
  return sharp(originalBuffer)
    .extract(region)
    .resize({ width: 1024, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

function getBestPrediction(results) {
  const all = results.flatMap((r) => r.predictions || []);
  all.sort((a, b) => b.confidence - a.confidence);

  return {
    best: all[0] || null,
    all,
  };
}

// Stricter thresholds to reduce false positives
function classifyRisk(best) {
  if (!best || best.confidence < 0.35) {
    return {
      detected: false,
      riskLevel: "none",
      message: "No reliable smoke or fire detected",
    };
  }

  if (best.confidence >= 0.7) {
    return {
      detected: true,
      riskLevel: "high",
      message: "Likely smoke/fire detected",
    };
  }

  if (best.confidence >= 0.5) {
    return {
      detected: true,
      riskLevel: "medium",
      message: "Possible smoke detected",
    };
  }

  return {
    detected: true,
    riskLevel: "low",
    message: "Weak smoke/fire signal detected",
  };
}

async function analyzeCamera(camera) {
  const imageBuffer = await fetchImageBuffer(camera.imageURL);
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image dimensions");
  }

  const crops = buildCropRegions(metadata.width, metadata.height);
  const results = [];

  for (const region of crops) {
    const crop = await makeCrop(imageBuffer, region);
    const result = await postToRoboflow(crop);
    results.push(result);
  }

  const { best } = getBestPrediction(results);
  const risk = classifyRisk(best);

  return {
    cameraName: camera.cameraName,
    imageURL: camera.imageURL,
    distanceMiles: Number(camera.distanceMiles.toFixed(2)),
    detected: risk.detected,
    riskLevel: risk.riskLevel,
    message: risk.message,
    confidence: best ? Number(best.confidence.toFixed(2)) : 0,
    class: risk.detected && best ? best.class : null,
    bbox:
      risk.detected && best
        ? {
            x: best.x,
            y: best.y,
            width: best.width,
            height: best.height,
          }
        : null,
  };
}

function buildOverallSummary(cameraResults) {
  const validDetections = cameraResults.filter((cam) => cam.detected);

  if (validDetections.length === 0) {
    return {
      overallDetected: false,
      overallRiskLevel: "none",
      bestCamera: null,
      highestConfidence: 0,
      message: "No reliable smoke or fire detected nearby",
    };
  }

  const best = validDetections.sort((a, b) => b.confidence - a.confidence)[0];

  return {
    overallDetected: true,
    overallRiskLevel: best.riskLevel,
    bestCamera: best.cameraName,
    highestConfidence: best.confidence,
    message: best.message,
  };
}

router.post("/", async (req, res) => {
  try {
    const lat = Number(req.body.x);
    const lon = Number(req.body.y);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        error: "Invalid coordinates. Send { x: latitude, y: longitude }.",
      });
    }

    const nearby = camerasData
      .map((camera) => {
        const coords = getCameraLatLon(camera);
        if (!coords || !camera.imageURL) return null;

        const distance = milesBetween(lat, lon, coords.lat, coords.lon);

        return {
          ...camera,
          distanceMiles: distance,
        };
      })
      .filter((camera) => camera && camera.distanceMiles <= MAX_DISTANCE_MILES)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, MAX_CAMERAS);

    const cameras = [];

    for (const camera of nearby) {
      try {
        const result = await analyzeCamera(camera);
        cameras.push(result);
      } catch (err) {
        cameras.push({
          cameraName: camera.cameraName,
          imageURL: camera.imageURL,
          distanceMiles: Number(camera.distanceMiles.toFixed(2)),
          detected: false,
          riskLevel: "unknown",
          message: "Camera image analysis failed",
          confidence: 0,
          class: null,
          bbox: null,
        });
      }
    }

    const summary = buildOverallSummary(cameras);

    return res.status(200).json({
      requestedCoordinate: { x: lat, y: lon },
      radiusMiles: MAX_DISTANCE_MILES,
      cameraCount: cameras.length,
      ...summary,
      cameras,
    });
  } catch (err) {
    console.error("classification error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

module.exports = router;

// CALL
// POST http://localhost:5000/api/classification
// Content-Type: application/json
// {
//   "x": 34.148,
//   "y": -118.289
// }

// Returns
// {
//   "requestedCoordinate": {
//       "x": 34.148,
//       "y": -118.289
//   },
//   "radiusMiles": 5,
//   "cameraCount": 2,
//   "overallDetected": false,
//   "overallRiskLevel": "none",
//   "bestCamera": null,
//   "highestConfidence": 0,
//   "message": "No reliable smoke or fire detected nearby",
//   "cameras": [
//       {
//           "cameraName": "Verdugo Peak 1",
//           "imageURL": "https://cameras.alertcalifornia.org/public-camera-data/Axis-VerdugoPeak1/latest-frame.jpg",
//           "distanceMiles": 4.69,
//           "detected": false,
//           "riskLevel": "none",
//           "message": "No reliable smoke or fire detected",
//           "confidence": 0.26,
//           "class": null,
//           "bbox": null
//       },
//       {
//           "cameraName": "Verdugo Peak 2",
//           "imageURL": "https://cameras.alertcalifornia.org/public-camera-data/Axis-VerdugoPeak2/latest-frame.jpg",
//           "distanceMiles": 4.69,
//           "detected": false,
//           "riskLevel": "none",
//           "message": "No reliable smoke or fire detected",
//           "confidence": 0,
//           "class": null,
//           "bbox": null
//       }
//   ]
// }