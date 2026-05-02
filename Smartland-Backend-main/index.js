import express from "express";
import cors from "cors";
import pool from "./db.js";
import userRoutes from "./src/routes/users.js";
import landRoutes from "./src/routes/lands.js";
import statusRoutes from "./src/routes/status.js";
import landChainRoutes from "./src/routes/landChain.js";
import transferRoutes from "./src/routes/transfers.js";
import disputeRoutes from "./src/routes/disputes.js";
import transactionsRoutes from "./src/routes/transactions.js";
import votesRoutes from "./src/routes/votes.js";
import paymentsRoutes from "./src/routes/payments.js";

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json()); // IMPORTANT

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "SmartLand Backend Connected",
      time: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/api/users", userRoutes);
app.use("/api/lands", landRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/chain/lands", landChainRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/votes", votesRoutes);
app.use("/api/payments", paymentsRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`👥 Users API: http://localhost:${PORT}/api/users`);
  console.log(`🏞️  Lands API: http://localhost:${PORT}/api/lands`);
  console.log(`🔁 Transfers API: http://localhost:${PORT}/api/transfers`);
  console.log(`⚖️  Disputes API: http://localhost:${PORT}/api/disputes`);
});