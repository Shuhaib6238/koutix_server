/**
 * @file Winston logger with file + console transports.
 * No stack traces in production error responses.
 */
const { createLogger, format, transports } = require("winston");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";

const logger = createLogger({
  level: isProduction ? "info" : "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: !isProduction }),
    format.splat(),
    format.json(),
  ),
  defaultMeta: { service: "koutix-server" },
  transports: [
    // Write errors to error.log
    new transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),
    // Write everything to combined.log
    new transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// Console output in dev
if (!isProduction) {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  );
} else {
  // In production, still log to console (for ECS CloudWatch)
  logger.add(
    new transports.Console({
      format: format.combine(format.timestamp(), format.json()),
    }),
  );
}

module.exports = logger;
