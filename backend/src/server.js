require("dotenv").config();
const express = require("express");
const cors = require("cors");

const crewRoutes = require("./routes/crews");
const exportRoutes = require("./routes/exports");
const classificationRoutes = require("./routes/classification");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "Crew Trace Backend",
    status: "running"
  });
});

app.use("/api/crews", crewRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/classification", classificationRoutes);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});