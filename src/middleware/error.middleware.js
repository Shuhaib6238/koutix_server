/**
 * @file Global error handling middleware.
 * No stack traces in production.
 * Handles Mongoose, Zod, and Stripe errors.
 */
const { ZodError } = require("zod");
const logger = require("../utils/logger");

const isProduction = process.env.NODE_ENV === "production";

/**
 * Express global error handler — must have 4 params.
 */
function errorHandler(err, req, res, _next) {
  logger.error(`${err.message} — ${req.method} ${req.originalUrl} — ${req.ip}`);
  if (!isProduction) {
    logger.error(err.stack);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}`,
    });
  }

  // Mongoose cast errors (bad ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Stripe errors
  if (err.type && err.type.startsWith("Stripe")) {
    return res.status(err.statusCode || 402).json({
      success: false,
      message: err.message,
    });
  }

  // Default
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: isProduction ? "Internal Server Error" : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

module.exports = { errorHandler };
