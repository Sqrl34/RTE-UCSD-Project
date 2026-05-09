const express = require("express");

const { getLatestAnalysisResults } = require("./crews");
const {
  buildJsonExport,
  buildGeoJsonExport
} = require("../services/exportService");

const router = express.Router();

router.get("/json", (req, res) => {
  const results = getLatestAnalysisResults();
  res.json(buildJsonExport(results));
});

router.get("/geojson", (req, res) => {
  const results = getLatestAnalysisResults();
  res.json(buildGeoJsonExport(results));
});

module.exports = router;