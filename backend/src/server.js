require("dotenv").config();

const express = require("express");
const cors = require("cors");

const crewRoutes = require("./routes/crews");
const exportRoutes = require("./routes/exports");
const classificationRoutes = require("./routes/classification");
const weatherRoutes = require("./routes/weatherRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({
    name: "CrewTrace",
    status: "running",
    endpoints: {
      analyzeCrew: "POST /api/crews/analyze",
      latestCrews: "GET /api/crews/latest",
      classification: "POST /api/classification",
      weatherFused: "POST /api/weather/fused",
      exportJson: "GET /api/export/json",
      exportGeoJson: "GET /api/export/geojson"
    }
  });
});

app.use("/api/crews", crewRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/classification", classificationRoutes);
app.use("/api/weather", weatherRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  res.status(500).json({
    error: "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});