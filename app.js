/**
 * @file Express application — main entry point.
 * @description Mounts all middleware, routes, and error handler.
 * TODO:RASHID markers show where Rashid will add order/payment routes.
 */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const hpp = require("hpp");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const logger = require("./src/utils/logger");
const { apiLimiter } = require("./src/middleware/rateLimiter.middleware");
const { errorHandler } = require("./src/middleware/error.middleware");

const app = express();

// ─── Security Middleware ─────────────────────────────────
app.use(helmet());
app.use(hpp());
app.use(mongoSanitize());

// ─── CORS ────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// ─── Logging ─────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// ─── Webhooks — MUST be before express.json() ────────────
const webhookRoutes = require("./src/routes/webhook.routes");
app.use("/webhooks", webhookRoutes);

// ─── Body Parsing ────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Rate Limiting ───────────────────────────────────────
app.use(apiLimiter);

// ─── Health Check ────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Auth Routes (Public) ────────────────────────────────
const authRoutes = require("./src/routes/auth.routes");
app.use("/auth", authRoutes);

// ─── Store Routes (Public + Customer) ────────────────────
const storeRoutes = require("./src/routes/store.routes");
app.use("/stores", storeRoutes);

// ─── Product Routes (Customer) ───────────────────────────
const productRoutes = require("./src/routes/product.routes");
app.use("/products", productRoutes);

// ─── Chain Manager Routes ────────────────────────────────
const chainRoutes = require("./src/routes/chain.routes");
app.use("/chain", chainRoutes);

// ─── Branch Manager Routes ───────────────────────────────
const branchRoutes = require("./src/routes/branch.routes");
app.use("/branch", branchRoutes);

// ─── Order Routes ────────────────────────────────────────
// TODO:RASHID — Implement full order creation, payment, and refund routes
const orderRoutes = require("./src/routes/order.routes");
app.use("/orders", orderRoutes);

// ─── Admin Routes (Super Admin) ──────────────────────────
const adminRoutes = require("./src/routes/admin.routes");
app.use("/admin", adminRoutes);

// ─── Upload Routes ───────────────────────────────────────
const uploadRoutes = require("./src/routes/upload.routes");
app.use("/upload", uploadRoutes);

// ─── POS Routes ──────────────────────────────────────────
const posRoutes = require("./src/routes/pos.routes");
app.use("/pos", posRoutes);

// TODO:RASHID — Add these route mounts:
// app.use('/payments', paymentRoutes); — Payment processing routes
// app.use('/refunds', refundRoutes); — Refund handling routes

// ─── 404 Handler ─────────────────────────────────────────
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ────────────────────────────────
app.use(errorHandler);

module.exports = app;
