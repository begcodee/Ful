import express from "express";
import dotenv from "dotenv";
import pool from "./config/db.js";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  override: true,
});

const requiredEnv = ["DATABASE_URL"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(`⚠️ Missing required env vars: ${missingEnv.join(", ")}`);
}

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.send("SmartLand API running");
});

app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "up" });
  } catch (error) {
    res.status(503).json({ status: "degraded", db: "down", error: error.message });
  }
});

app.get("/test-db", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database not connected" });
  }
});

import landsChainRoutes from "./routes/landChain.js";
import usersRoutes from "./routes/users.js";
import landsRoutes from "./routes/lands.js";
import transfersRoutes from "./routes/transfers.js";
import disputesRoutes from "./routes/disputes.js";
import statusRoutes from "./routes/status.js";

app.use("/api/status", statusRoutes);
app.use("/api/chain/lands", landsChainRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/lands", landsRoutes);
app.use("/api/transfers", transfersRoutes);
app.use("/api/disputes", disputesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`❤️ Health: http://localhost:${PORT}/healthz`);
});
