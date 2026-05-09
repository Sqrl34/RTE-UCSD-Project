const express = require("express");
const fs = require("fs/promises");
const sharp = require("sharp");
const FormData = require("form-data");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const router = express.Router();

const IMAGE_PATH =
  "C:/Users/atwri/Downloads/dllookout.jpg";

const ROBOFLOW_MODEL_URL = "https://detect.roboflow.com/wildfire-smoke/1";
const ROBOFLOW_CONFIDENCE = 10;

if (!process.env.ROBOFLOW_API_KEY) {
  console.warn("ROBOFLOW_API_KEY is missing. Set it in backend/.env");
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

  const json = await response.json();
  return json;
}

function buildCropRegions(width, height) {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  const centerW = Math.floor(width * 0.6);
  const centerH = Math.floor(height * 0.6);
  const centerLeft = Math.floor((width - centerW) / 2);
  const centerTop = Math.floor((height - centerH) / 2);

  return [
    { left: 0, top: 0, width, height },
    { left: 0, top: 0, width, height: halfH },
    { left: 0, top: halfH, width, height: height - halfH },
    { left: 0, top: 0, width: halfW, height },
    { left: halfW, top: 0, width: width - halfW, height },
    { left: centerLeft, top: centerTop, width: centerW, height: centerH },
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
  const allPredictions = [];

  for (const result of results) {
    const preds = result.predictions || [];
    for (const p of preds) {
      allPredictions.push(p);
    }
  }

  allPredictions.sort((a, b) => b.confidence - a.confidence);

  return {
    best: allPredictions[0] || null,
    all: allPredictions,
  };
}

function classifyRisk(bestPrediction, allPredictions) {
  if (!bestPrediction) {
    return {
      detected: false,
      riskLevel: "none",
      message: "No smoke or fire detected",
    };
  }

  const confidence = bestPrediction.confidence;
  const smokeCount = allPredictions.length;

  if (confidence >= 0.6) {
    return {
      detected: true,
      riskLevel: "high",
      message: "Likely smoke/fire detected",
    };
  }

  if (confidence >= 0.3 || smokeCount >= 2) {
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

router.post("/:id", async (req, res) => {
  try {
    if (req.params.id !== "1") {
      return res.status(400).json({ error: "invalid id parameter" });
    }

    try {
      await fs.access(IMAGE_PATH);
    } catch {
      return res.status(404).json({
        error: "image file not found",
        path: IMAGE_PATH,
      });
    }

    const originalBuffer = await fs.readFile(IMAGE_PATH);
    const metadata = await sharp(originalBuffer).metadata();

    const width = metadata.width;
    const height = metadata.height;

    if (!width || !height) {
      return res.status(400).json({ error: "invalid image dimensions" });
    }

    const cropRegions = buildCropRegions(width, height);

    const results = [];

    for (const region of cropRegions) {
      const crop = await makeCrop(originalBuffer, region);
      const result = await postToRoboflow(crop);
      results.push(result);
    }

    const { best, all } = getBestPrediction(results);
    const risk = classifyRisk(best, all);

    const response = best
      ? {
          detected: risk.detected,
          riskLevel: risk.riskLevel,
          message: risk.message,
          confidence: Number(best.confidence.toFixed(2)),
          class: best.class,
          bbox: {
            x: best.x,
            y: best.y,
            width: best.width,
            height: best.height,
          },
        }
      : {
          detected: false,
          riskLevel: "none",
          message: "No smoke or fire detected",
          confidence: 0,
          class: null,
          bbox: null,
        };

    return res.status(200).json(response);
  } catch (err) {
    console.error("classification error:", err);
    return res.status(500).json({ error: "internal server error" });
  }
});

module.exports = router;