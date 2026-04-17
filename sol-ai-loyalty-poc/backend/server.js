/**
 * SOL AI Loyalty POC — Express backend
 * Runs on port 4000 by default.
 *
 * All routes are prefixed with /api to match the Next.js rewrite proxy.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const offersRouter = require("./routes/offers");
const explainOfferRouter = require("./routes/explainOffer");
const qrRouter = require("./routes/qr");
const nearbyOffersRouter = require("./routes/nearby-offers");
const ordersRouter = require("./routes/orders");

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/offers", offersRouter);
app.use("/api/explain-offer", explainOfferRouter);
app.use("/api/qr", qrRouter);
app.use("/api/nearby-offers", nearbyOffersRouter);
app.use("/api/orders", ordersRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ code: "NOT_FOUND", message: "Route not found", timestamp: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[backend] Listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
