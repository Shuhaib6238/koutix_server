/**
 * @file Redis (AWS ElastiCache) client via ioredis with TLS and reconnect events.
 */
const Redis = require("ioredis");
const logger = require("../utils/logger");

let redis = null;

/**
 * Create and return a Redis client.
 * If REDIS_URL is not set, returns a mock client that logs warnings.
 * @param {string} redisUrl - Redis connection URL (rediss:// for TLS)
 * @returns {Redis|object} Redis client or mock
 */
function createRedisClient(redisUrl) {
  if (!redisUrl) {
    logger.warn(
      "⚠️  REDIS_URL not set — using in-memory fallback (not for production)",
    );
    return createMockRedis();
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      logger.info(`🔄 Redis reconnect attempt #${times}, delay ${delay}ms`);
      return delay;
    },
    tls: redisUrl.startsWith("rediss://") ? {} : undefined,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on("connect", () => {
    logger.info("✅ Redis connected");
  });

  client.on("ready", () => {
    logger.info("✅ Redis ready");
  });

  client.on("error", (err) => {
    logger.error(`❌ Redis error: ${err.message}`);
  });

  client.on("close", () => {
    logger.warn("⚠️  Redis connection closed");
  });

  redis = client;
  return client;
}

/**
 * Creates a simple mock Redis client for development without ElastiCache.
 * @returns {object} Mock Redis client
 */
function createMockRedis() {
  const store = new Map();
  const mock = {
    get: async (key) => store.get(key) || null,
    set: async (key, value, ...args) => {
      store.set(key, value);
      return "OK";
    },
    del: async (key) => {
      store.delete(key);
      return 1;
    },
    incr: async (key) => {
      const val = parseInt(store.get(key) || "0", 10) + 1;
      store.set(key, String(val));
      return val;
    },
    expire: async () => 1,
    ttl: async () => -1,
    ping: async () => "PONG",
    quit: async () => "OK",
    disconnect: () => {},
    status: "ready",
  };
  redis = mock;
  return mock;
}

/**
 * Get the current Redis client instance.
 * @returns {Redis|object}
 */
function getRedis() {
  return redis;
}

module.exports = { createRedisClient, getRedis };
