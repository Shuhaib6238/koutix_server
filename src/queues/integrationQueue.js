const { Queue } = require('bullmq');
const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    // username: process.env.REDIS_USER,
    // password: process.env.REDIS_PASSWORD
};

// Define queue for POS Synchronization
const syncQueue = new Queue('pos-sync-queue', { connection });

/**
 * Add a sync job to the queue
 * @param {string} integrationId 
 * @param {string} type - 'products' or 'inventory'
 * @param {string} branchId 
 */
async function addSyncJob(integrationId, type, branchId = null) {
    return await syncQueue.add(`sync-${type}`, {
        integrationId,
        type,
        branchId
    }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
    });
}

module.exports = { syncQueue, addSyncJob, connection };
