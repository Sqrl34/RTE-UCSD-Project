const path = require("path");
const dotenv = require("dotenv");

const backendRoot = path.join(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.join(backendRoot, ".env", ".env") });

const express = require("express");
const cors = require("cors");

const crewRoutes = require("./routes/crews");
const exportRoutes = require("./routes/exports");
const classificationRoutes = require("./routes/classification");
const weatherRoutes = require("./routes/weatherRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({
    name: "CrewTrace",
    status: "running",
    endpoints: {
      health: "GET /health",
      analyzeCrew: "POST /api/crews/analyze",
      latestCrews: "GET /api/crews/latest",
      classification: "POST /api/classification",
      weatherFused: "POST /api/weather/fused",
      exportJson: "GET /api/export/json",
      exportGeoJson: "GET /api/export/geojson"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/crews", crewRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/classification", classificationRoutes);
app.use("/api/weather", weatherRoutes);

// Optional compatibility route from main branch
app.use("/weather", weatherRoutes);

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

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});