/**
 * @file MongoDB Atlas connection with exponential retry logic.
 * Max 5 retries with 1s → 16s backoff.
 */
const mongoose = require("mongoose");
const logger = require("../utils/logger");

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

/**
 * Connect to MongoDB Atlas with exponential backoff retry.
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise<void>}
 */
async function connectDB(uri) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      logger.info("✅ MongoDB Atlas connected successfully");
      return;
    } catch (err) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s, 16s
      logger.error(
        `❌ MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`,
      );
      if (attempt === MAX_RETRIES) {
        logger.error("💀 All MongoDB connection attempts failed. Exiting.");
        process.exit(1);
      }
      logger.info(`⏳ Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Mongoose connection events
mongoose.connection.on("disconnected", () => {
  logger.warn("⚠️  MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  logger.error(`MongoDB connection error: ${err.message}`);
});

module.exports = { connectDB };
