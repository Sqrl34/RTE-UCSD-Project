import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Use the classification route that's present in src/routes
import classificationRoutes from "./src/routes/classification.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("Backend running");
});

// 👇 mount routes here
app.use("/api", classificationRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});