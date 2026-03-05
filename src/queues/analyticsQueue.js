const { Queue } = require('bullmq');
const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
};

// Define queue lazily to avoid connection on import
let analyticsQueue = null;

function getAnalyticsQueue() {
    if (!analyticsQueue && process.env.USE_REDIS === 'true') {
        analyticsQueue = new Queue('analytics-queue', { connection });
    }
    return analyticsQueue;
}

async function addAnalyticsJob(tenantId, type) {
    const queue = getAnalyticsQueue();
    if (!queue) {
        console.warn(`⚠️ Redis is disabled. Skipping analytics job: ${type}.`);
        return { id: 'no-redis-mock-id' };
    }

    return await queue.add(`analytics-${type}`, {
        tenantId,
        type
    }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
    });
}

module.exports = { analyticsQueue, addAnalyticsJob, connection };
