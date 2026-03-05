const { Queue } = require('bullmq');
const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
};

// Define queue lazily to avoid connection on import
let syncQueue = null;

function getSyncQueue() {
    if (!syncQueue && process.env.USE_REDIS === 'true') {
        syncQueue = new Queue('pos-sync-queue', { connection });
    }
    return syncQueue;
}

async function addSyncJob(integrationId, type, branchId = null) {
    const queue = getSyncQueue();
    if (!queue) {
        console.warn(`⚠️ Redis is disabled. Skipping background job for sync-${type}.`);
        return { id: 'no-redis-mock-id' };
    }

    return await queue.add(`sync-${type}`, {
        integrationId,
        type,
        branchId
    }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
    });
}

module.exports = { syncQueue, addSyncJob, connection };
