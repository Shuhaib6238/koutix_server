const { Queue } = require('bullmq');
const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    // username: process.env.REDIS_USER,
    // password: process.env.REDIS_PASSWORD
};

// Define queue for Analytics Aggregation
const analyticsQueue = new Queue('analytics-queue', { connection });

/**
 * Add an analytics job to the queue
 * @param {string} tenantId 
 * @param {string} type - 'daily_sales', 'branch_metrics'
 */
async function addAnalyticsJob(tenantId, type) {
    return await analyticsQueue.add(`analytics-${type}`, {
        tenantId,
        type
    }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
    });
}

module.exports = { analyticsQueue, addAnalyticsJob, connection };
