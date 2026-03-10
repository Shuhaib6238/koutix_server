/**
 * @file Redis-backed rate limiting middleware.
 * Auth endpoints: 5 requests/min per IP.
 * API endpoints: 100 requests/min per user uid.
 */
const rateLimit = require("express-rate-limit");

/**
 * Auth rate limiter — 5 requests per minute per IP.
 * Used on signup, login, set-password endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    success: false,
    message:
      "Too many authentication requests. Please try again after 1 minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

/**
 * API rate limiter — 100 requests per minute per user uid.
 * Falls back to IP if no authenticated user.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.uid) || req.ip,
});

module.exports = { authLimiter, apiLimiter };
