/**
 * @file BullMQ POS Sync Job — runs every 5 minutes per active store.
 * @description Fetches products from POS, upserts into MongoDB.
 */
const { Queue, Worker } = require("bullmq");
const Store = require("../models/Store");
const Product = require("../models/Product");
const { syncInventory } = require("../services/pos/posService");
const logger = require("../utils/logger");

const QUEUE_NAME = "pos-sync";
let posSyncQueue = null;

/**
 * Initialize the POS sync queue and worker.
 * @param {object} redisConnection - IORedis connection options or instance
 */
function initPosSyncJob(redisConnection) {
  if (!redisConnection) {
    logger.warn("⚠️  Redis not available — POS sync jobs disabled");
    return;
  }

  const connection =
    typeof redisConnection === "string"
      ? { url: redisConnection }
      : redisConnection;

  // Create queue
  posSyncQueue = new Queue(QUEUE_NAME, { connection });

  // Schedule repeating job every 5 minutes
  posSyncQueue.add(
    "sync-all-stores",
    {},
    {
      repeat: {
        every: 5 * 60 * 1000, // 5 minutes
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  );

  // Create worker
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logger.info(`🔄 POS sync job started — ${job.name}`);

      // Find all active stores with a non-manual POS type
      const stores = await Store.find({
        status: "active",
        "pos.type": { $ne: null, $ne: "manual" },
      }).select("+pos.encryptedApiKey");

      let synced = 0;
      let errors = 0;

      for (const store of stores) {
        try {
          // Update sync status
          store.pos.syncStatus = "syncing";
          await store.save();

          // Sync inventory
          const result = await syncInventory(store);

          // Upsert products
          for (const product of result.products || []) {
            await Product.findOneAndUpdate(
              { storeId: store._id, sku: product.sku },
              {
                $set: {
                  storeId: store._id,
                  name: product.name,
                  price: product.price,
                  stock: product.stock,
                  barcode: product.barcode,
                  category: product.category,
                  brand: product.brand,
                  posProductId: product.posProductId,
                  lastSyncedAt: new Date(),
                },
                $setOnInsert: {
                  sku: product.sku,
                  isActive: true,
                  vatRate: 5,
                },
              },
              { upsert: true, new: true },
            );
          }

          // Update store sync timestamp
          store.pos.syncStatus = "synced";
          store.pos.lastSyncAt = new Date();
          await store.save();

          synced++;
          logger.info(
            `✅ POS sync completed for store ${store.name} — ${result.synced} products`,
          );
        } catch (err) {
          errors++;
          logger.error(
            `❌ POS sync failed for store ${store.name}: ${err.message}`,
          );

          store.pos.syncStatus = "error";
          await store.save();
        }
      }

      logger.info(
        `🔄 POS sync job completed — ${synced} synced, ${errors} errors`,
      );
      return { synced, errors };
    },
    { connection, concurrency: 2 },
  );

  worker.on("failed", (job, err) => {
    logger.error(`POS sync job ${job?.id} failed: ${err.message}`);
  });

  logger.info("✅ POS sync BullMQ worker initialized (every 5 min)");
}

module.exports = { initPosSyncJob };
