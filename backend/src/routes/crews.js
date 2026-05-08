const express = require("express");

const { getWeatherForCoordinates } = require("../services/weatherService");
const { getCameraRiskForCoordinates } = require("../services/cameraService");
const { generateAiRiskScore } = require("../services/geminiService");

const router = express.Router();

let latestAnalysisResults = [];

router.post("/analyze", async (req, res) => {
  try {
    const { unit_id, lat, lon } = req.body;

    if (!unit_id || lat == null || lon == null) {
      return res.status(400).json({
        error: "unit_id, lat, and lon are required"
      });
    }

    const coordinatePayload = {
      unit_id,
      lat: Number(lat),
      lon: Number(lon)
    };

    const weather = await getWeatherForCoordinates(
      coordinatePayload.lat,
      coordinatePayload.lon
    );

    const camera = await getCameraRiskForCoordinates(
      coordinatePayload.lat,
      coordinatePayload.lon
    );

    const aiRisk = await generateAiRiskScore({
      coordinatePayload,
      weather,
      camera
    });

    const result = {
      ...coordinatePayload,
      weather,
      camera,
      ...aiRisk,
      analyzed_at: new Date().toISOString()
    };

    latestAnalysisResults = latestAnalysisResults.filter(
      (item) => item.unit_id !== unit_id
    );

    latestAnalysisResults.push(result);

    res.json(result);
  } catch (error) {
    console.error("Analyze error:", error);

    res.status(500).json({
      error: "Failed to analyze coordinate risk"
    });
  }
});

router.get("/latest", (req, res) => {
  res.json(latestAnalysisResults);
});

function getLatestAnalysisResults() {
  return latestAnalysisResults;
}

module.exports = router;
module.exports.getLatestAnalysisResults = getLatestAnalysisResults;