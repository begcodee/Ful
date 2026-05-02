import express from "express";
import dotenv from "dotenv";
import pool from "./config/db.js";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  override: true,
});

const app = express();

// CORS configuration - allow your frontend to connect
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
  credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("SmartLand API running");
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database not connected" });
  }
});

// Import API routes
import landsChainRoutes from "./routes/landChain.js";
import usersRoutes from "./routes/users.js";
import landsRoutes from "./routes/lands.js";
import transfersRoutes from "./routes/transfers.js";
import disputesRoutes from "./routes/disputes.js";
import statusRoutes from "./routes/status.js";

// Use routes
app.use("/api/status", statusRoutes);
app.use("/api/chain/lands", landsChainRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/lands", landsRoutes);
app.use("/api/transfers", transfersRoutes);
app.use("/api/disputes", disputesRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🧪 Test DB: http://localhost:${PORT}/test-db`);
});