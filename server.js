/**
 * @file Server entry point.
 * @description Loads env vars, initializes all services, connects DB, starts server.
 */
require("dotenv").config();

// Validate environment variables FIRST — crashes if missing
const env = require("./src/config/env");

const app = require("./app");
const { connectDB } = require("./src/config/db");
const { createRedisClient } = require("./src/config/redis");
const { initFirebase } = require("./src/config/firebase");
const { initStripe } = require("./src/services/stripe.service");
const { initResend } = require("./src/services/resend.service");
const { initS3 } = require("./src/utils/awsS3Service");
const { initPosSyncJob } = require("./src/jobs/posSyncJob");
const logger = require("./src/utils/logger");

async function startServer() {
  try {
    // 1. Initialize Firebase Admin SDK
    initFirebase({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    });

    // 2. Connect to MongoDB Atlas
    await connectDB(env.MONGODB_URI);

    // 3. Connect to Redis (ElastiCache)
    const redis = createRedisClient(env.REDIS_URL);

    // 4. Initialize Stripe
    initStripe(env.STRIPE_SECRET_KEY);

    // 5. Initialize Resend (email)
    initResend(env.RESEND_API_KEY);

    // 6. Initialize AWS S3
    initS3({
      region: env.AWS_REGION,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    });

    // 7. Initialize BullMQ POS sync worker
    if (env.REDIS_URL) {
      initPosSyncJob(redis);
    }

    // 8. Start HTTP server
    const PORT = env.PORT;
    app.listen(PORT, () => {
      logger.info(`🚀 Koutix server running on port ${PORT}`);
      logger.info(`📍 Environment: ${env.NODE_ENV}`);
      logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    logger.error(`💀 Server failed to start: ${err.message}`);
    logger.error(err.stack);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

startServer();
