import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import webhookRoutes from "./routes/webhooks";
import userRoutes from "./routes/users";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    if (Buffer.isBuffer(req.body)) {
      req.body = JSON.parse(req.body.toString("utf8"));
    }
    next();
  }
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/webhooks", webhookRoutes);
app.use("/api/users", userRoutes);

// ── Health check ──
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "InvoiceOS API",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ──
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Start ──
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 InvoiceOS API running on http://localhost:${PORT}`);
  });
});
