const { Worker } = require('bullmq');
const { connection } = require('../queues/integrationQueue');

const analyticsWorker = new Worker('analytics-queue', async job => {
    const { tenantId, type } = job.data;
    console.log(`[Analytics Worker] Started processing job ${job.id}: Compute ${type} for tenant ${tenantId}`);

    try {
        if (type === 'daily_sales') {
            // Stub for aggregating daily sales across all branches
            // e.g. await analyticsService.computeDailySales(tenantId);
            console.log(`[Analytics Worker] Computing daily sales for ${tenantId}...`);
        } else {
            throw new Error(`Unknown analytics type: ${type}`);
        }
    } catch (error) {
        console.error(`[Analytics Worker] Job ${job.id} failed:`, error.message);
        throw error;
    }

    console.log(`[Analytics Worker] Successfully completed job ${job.id}`);
}, {
    connection,
    concurrency: 2
});

analyticsWorker.on('completed', job => {
    console.log(`Analytics job ${job.id} completed!`);
});

module.exports = analyticsWorker;
