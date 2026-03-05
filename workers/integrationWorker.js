const { Worker } = require('bullmq');
const integrationService = require('../integrations/integration.service');
const { connection } = require('../queues/integrationQueue');

const integrationWorker = new Worker('pos-sync-queue', async job => {
    const { integrationId, type, branchId } = job.data;
    console.log(`[Worker] Started processing job ${job.id}: Sync ${type} for Integration ${integrationId}`);

    try {
        if (type === 'products') {
            await integrationService.syncProducts(integrationId, branchId);
        } else if (type === 'inventory') {
            await integrationService.syncInventory(integrationId, branchId);
        } else {
            throw new Error(`Unknown sync type: ${type}`);
        }
    } catch (error) {
        console.error(`[Worker] Job ${job.id} failed:`, error.message);
        throw error; // Let BullMQ handle retries
    }

    console.log(`[Worker] Successfully completed job ${job.id}`);
}, {
    connection,
    concurrency: 5 // Process 5 syncs concurrently
});

integrationWorker.on('completed', job => {
    console.log(`Job ${job.id} completed!`);
});

integrationWorker.on('failed', (job, err) => {
    console.log(`Job ${job.id} failed with error ${err.message}`);
});

module.exports = integrationWorker;
