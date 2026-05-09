const express = require("express");

const { getWeatherForCoordinates } = require("../services/weatherService");
const { getCameraRiskForCoordinates } = require("../services/cameraService");
const { generateAiRiskScore, generateAiRiskScoreBatch } = require("../services/geminiService");
const { fallbackRiskScore } = require("../services/riskEngine");
const { geoBucketKey } = require("../services/geoBucket");
const { sanitizeForLogs } = require("../lib/sanitizeForLogs");

const router = express.Router();

let latestAnalysisResults = [];

/**
 * One HTTP round-trip: dedupes weather + camera/Roboflow by geo bucket, then one batched Gemini call for all crews.
 */
router.post("/analyze-batch", async (req, res) => {
  try {
    const crews = req.body.crews;

    if (!Array.isArray(crews) || crews.length === 0) {
      return res.status(400).json({
        error: "crews must be a non-empty array of { unit_id, lat, lon }",
      });
    }

    const sanitized = crews.map((c) => ({
      unit_id: c.unit_id,
      lat: Number(c.lat),
      lon: Number(c.lon),
    }));

    const invalid = sanitized.some(
      (c) =>
        !c.unit_id ||
        typeof c.unit_id !== "string" ||
        !Number.isFinite(c.lat) ||
        !Number.isFinite(c.lon)
    );

    if (invalid) {
      return res.status(400).json({
        error: "Each crew needs string unit_id and numeric lat, lon",
      });
    }

    const bucketToRep = new Map();
    for (const c of sanitized) {
      const bk = geoBucketKey(c.lat, c.lon);
      if (!bucketToRep.has(bk)) {
        bucketToRep.set(bk, { lat: c.lat, lon: c.lon });
      }
    }

    console.log(
      `[analyze-batch] ${sanitized.length} crew(s) → ${bucketToRep.size} unique geo bucket(s)`
    );
    console.log(
      `[analyze-batch] context: ${bucketToRep.size}× weather + ${bucketToRep.size}× camera (one pair per bucket, not ${sanitized.length}× each)`
    );

    const contextByBucket = new Map();
    let bucketIndex = 0;
    for (const [bk, rep] of bucketToRep) {
      bucketIndex += 1;
      console.log(
        `[analyze-batch] bucket ${bucketIndex}/${bucketToRep.size}: weather + camera for (${rep.lat}, ${rep.lon})`
      );
      const weather = await getWeatherForCoordinates(rep.lat, rep.lon);
      const camera = await getCameraRiskForCoordinates(rep.lat, rep.lon);
      contextByBucket.set(bk, { weather, camera });
    }

    const crewInputs = sanitized.map((c) => {
      const bk = geoBucketKey(c.lat, c.lon);
      const { weather, camera } = contextByBucket.get(bk);
      return {
        coordinatePayload: {
          unit_id: c.unit_id,
          lat: c.lat,
          lon: c.lon,
        },
        weather,
        camera,
      };
    });

    console.log(
      `[analyze-batch] Gemini: 1 batched request for ${crewInputs.length} crew(s) (not ${crewInputs.length} separate API calls)`
    );
    const aiRisks = await generateAiRiskScoreBatch(crewInputs);
    console.log(`[analyze-batch] Gemini batch finished → ${aiRisks.length} risk row(s)`);

    const results = [];

    for (let i = 0; i < sanitized.length; i++) {
      const c = sanitized[i];
      const { weather, camera } = crewInputs[i];
      const coordinatePayload = crewInputs[i].coordinatePayload;
      const aiRisk =
        aiRisks[i] && Number.isFinite(Number(aiRisks[i].risk_score))
          ? aiRisks[i]
          : fallbackRiskScore({ weather, camera });

      const result = {
        ...coordinatePayload,
        weather,
        camera,
        ...aiRisk,
        analyzed_at: new Date().toISOString(),
      };

      results.push(result);

      latestAnalysisResults = latestAnalysisResults.filter(
        (item) => item.unit_id !== c.unit_id
      );
      latestAnalysisResults.push(result);
    }

    return res.json({ results });
  } catch (error) {
    console.error(
      "Analyze batch error:",
      sanitizeForLogs(error?.message || String(error))
    );

    return res.status(500).json({
      error: "Failed to analyze batch",
    });
  }
});

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
    console.error(
      "Analyze error:",
      sanitizeForLogs(error?.message || String(error))
    );

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