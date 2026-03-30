import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/authRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { startCronJobs } from "./utils/cronJobs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOriginConfig = process.env.CORS_ORIGIN || "http://localhost:5173";
const allowAllOrigins = allowedOriginConfig === "*";
const allowedOrigins = allowedOriginConfig
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json());

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// API routes
app.get("/api/health", (_req, res) => {
  res.status(200).json({ message: "DSR backend running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/reports", reportRoutes);

// SPA fallback: serve index.html for any non-API route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

// Error handling
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
  startCronJobs();
});
