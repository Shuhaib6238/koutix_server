const Integration = require('../models/integration.model');
const integrationService = require('./integration.service');

/**
 * IntegrationScheduler — runs periodic sync jobs for active integrations.
 * Uses setInterval (no Redis/BullMQ dependency needed for MVP).
 * Can be upgraded to BullMQ later for production.
 */
class IntegrationScheduler {
    constructor() {
        this._intervals = new Map();
        this._running = false;
    }

    /**
     * Start the scheduler — finds all ACTIVE integrations with auto-sync
     * and schedules their sync jobs.
     */
    async start() {
        if (this._running) return;
        this._running = true;
        console.log('📡 Integration Scheduler started');

        // Initial load
        await this._loadJobs();

        // Re-check for new/changed integrations every 2 minutes
        this._reloadInterval = setInterval(() => this._loadJobs(), 2 * 60 * 1000);
    }

    stop() {
        this._running = false;
        for (const [id, interval] of this._intervals) {
            clearInterval(interval);
        }
        this._intervals.clear();
        if (this._reloadInterval) clearInterval(this._reloadInterval);
        console.log('📡 Integration Scheduler stopped');
    }

    async _loadJobs() {
        try {
            const integrations = await Integration.find({
                status: 'ACTIVE',
                integrationType: { $ne: 'MANUAL' },
            });

            // Stop old jobs that are no longer active
            for (const [id] of this._intervals) {
                if (!integrations.find(i => i._id.toString() === id)) {
                    clearInterval(this._intervals.get(id));
                    this._intervals.delete(id);
                }
            }

            // Start new jobs
            for (const integration of integrations) {
                const id = integration._id.toString();
                if (!this._intervals.has(id)) {
                    const intervalMs = (integration.settings?.syncIntervalMinutes || 10) * 60 * 1000;
                    const job = setInterval(() => this._runSync(integration), intervalMs);
                    this._intervals.set(id, job);
                    console.log(`  ⏰ Scheduled sync for "${integration.name}" every ${integration.settings?.syncIntervalMinutes || 10} min`);
                }
            }
        } catch (err) {
            console.error('Scheduler load error:', err.message);
        }
    }

    async _runSync(integration) {
        const id = integration._id.toString();
        console.log(`🔄 Auto-sync: ${integration.name} (${integration.integrationType})`);
        try {
            if (integration.settings?.autoProductSync) {
                await integrationService.syncProducts(id, integration.branchId);
            }
            if (integration.settings?.autoInventorySync) {
                await integrationService.syncInventory(id, integration.branchId);
            }
        } catch (err) {
            console.error(`  ❌ Auto-sync failed for ${integration.name}: ${err.message}`);
        }
    }
}

module.exports = new IntegrationScheduler();
