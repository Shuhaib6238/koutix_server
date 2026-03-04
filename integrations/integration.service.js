const Integration = require('../models/integration.model');
const IntegrationLog = require('../models/integrationLog.model');
const Product = require('../models/product.model');
const IntegrationFactory = require('./integration.factory');

/**
 * IntegrationService — orchestrates CRUD, syncing, and health checks
 */
class IntegrationService {

    // ─── CRUD ─────────────────────────────────────────

    async createIntegration(data) {
        const integration = new Integration(data);
        await integration.save();
        await this._log(integration, 'CONNECTION', 'SUCCESS', `Integration "${data.name}" created`);
        return integration;
    }

    async getIntegrations(tenantId) {
        return Integration.find({ tenantId }).sort({ createdAt: -1 });
    }

    async getIntegrationById(id) {
        return Integration.findById(id);
    }

    async getIntegrationForBranch(tenantId, branchId) {
        // 1. Check branch-level override
        const branchIntegration = await Integration.findOne({ tenantId, branchId, status: { $ne: 'DISCONNECTED' } });
        if (branchIntegration) return branchIntegration;
        // 2. Fallback to chain-level
        return Integration.findOne({ tenantId, scope: 'CHAIN', branchId: null, status: { $ne: 'DISCONNECTED' } });
    }

    async updateIntegration(id, data) {
        const integration = await Integration.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (integration) {
            await this._log(integration, 'CONFIG_CHANGE', 'SUCCESS', 'Integration settings updated');
        }
        return integration;
    }

    async deleteIntegration(id) {
        const integration = await Integration.findByIdAndDelete(id);
        if (integration) {
            await this._log(integration, 'DISCONNECTION', 'SUCCESS', `Integration "${integration.name}" removed`);
        }
        return integration;
    }

    // ─── SYNC OPERATIONS ─────────────────────────────

    async syncProducts(integrationId, branchId) {
        const integration = await Integration.findById(integrationId);
        if (!integration) throw new Error('Integration not found');

        const adapter = IntegrationFactory.getAdapter(integration);
        const start = Date.now();

        try {
            const result = await adapter.syncProducts(branchId);

            // Upsert products into MongoDB
            for (const prod of result.products) {
                await Product.findOneAndUpdate(
                    { sku: prod.sku, org_id: integration.tenantId },
                    { ...prod, org_id: integration.tenantId },
                    { upsert: true, new: true }
                );
            }

            // Update integration stats
            await Integration.findByIdAndUpdate(integrationId, {
                lastSyncTime: new Date(),
                lastSyncStatus: result.errors > 0 ? 'PARTIAL' : 'SUCCESS',
                status: 'ACTIVE',
                $inc: { 'syncStats.totalProductsSynced': result.synced }
            });

            await this._log(integration, 'PRODUCT_SYNC', result.errors > 0 ? 'PARTIAL' : 'SUCCESS',
                `Synced ${result.synced} products, ${result.errors} errors`,
                { synced: result.synced, errors: result.errors }, Date.now() - start, result.synced, result.errors
            );

            return result;
        } catch (err) {
            await Integration.findByIdAndUpdate(integrationId, {
                lastSyncStatus: 'FAILED',
                'syncStats.lastError': err.message,
                $inc: { 'syncStats.totalErrors': 1 }
            });
            await this._log(integration, 'PRODUCT_SYNC', 'FAILED', err.message, null, Date.now() - start);
            throw err;
        }
    }

    async syncInventory(integrationId, branchId) {
        const integration = await Integration.findById(integrationId);
        if (!integration) throw new Error('Integration not found');

        const adapter = IntegrationFactory.getAdapter(integration);
        const start = Date.now();

        try {
            const result = await adapter.syncInventory(branchId);

            // Update stock levels
            for (const item of result.items) {
                await Product.findOneAndUpdate(
                    { sku: item.sku, org_id: integration.tenantId },
                    { stock: item.stock },
                    { new: true }
                );
            }

            await Integration.findByIdAndUpdate(integrationId, {
                lastSyncTime: new Date(),
                lastSyncStatus: result.errors > 0 ? 'PARTIAL' : 'SUCCESS',
                status: 'ACTIVE',
            });

            await this._log(integration, 'INVENTORY_SYNC', result.errors > 0 ? 'PARTIAL' : 'SUCCESS',
                `Updated ${result.synced} stock levels`, null, Date.now() - start, result.synced, result.errors
            );

            return result;
        } catch (err) {
            await this._log(integration, 'INVENTORY_SYNC', 'FAILED', err.message, null, Date.now() - start);
            throw err;
        }
    }

    async pushOrder(integrationId, orderData) {
        const integration = await Integration.findById(integrationId);
        if (!integration) throw new Error('Integration not found');

        const adapter = IntegrationFactory.getAdapter(integration);
        const start = Date.now();

        try {
            const result = await adapter.pushOrder(orderData);

            if (result.success) {
                await Integration.findByIdAndUpdate(integrationId, {
                    $inc: { 'syncStats.totalOrdersPushed': 1 }
                });
                await this._log(integration, 'ORDER_PUSH', 'SUCCESS',
                    `Order pushed: ${result.posOrderId}`, { posOrderId: result.posOrderId }, Date.now() - start
                );
            } else {
                await this._log(integration, 'ORDER_PUSH', 'FAILED', result.error || 'Order push failed', null, Date.now() - start);
            }

            return result;
        } catch (err) {
            await this._log(integration, 'ORDER_PUSH', 'FAILED', err.message, null, Date.now() - start);
            throw err;
        }
    }

    async healthCheck(integrationId) {
        const integration = await Integration.findById(integrationId);
        if (!integration) throw new Error('Integration not found');

        const adapter = IntegrationFactory.getAdapter(integration);
        const result = await adapter.healthCheck();

        // Update status based on health
        const newStatus = result.healthy ? 'ACTIVE' : 'ERROR';
        if (integration.status !== newStatus) {
            await Integration.findByIdAndUpdate(integrationId, { status: newStatus });
        }

        await this._log(integration, 'HEALTH_CHECK', result.healthy ? 'SUCCESS' : 'FAILED',
            result.message, { latency: result.latency }
        );

        return result;
    }

    // ─── LOGS ─────────────────────────────────────────

    async getLogs(integrationId, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            IntegrationLog.find({ integrationId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            IntegrationLog.countDocuments({ integrationId })
        ]);
        return { logs, total, page, pages: Math.ceil(total / limit) };
    }

    async getLogsByTenant(tenantId, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            IntegrationLog.find({ tenantId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            IntegrationLog.countDocuments({ tenantId })
        ]);
        return { logs, total, page, pages: Math.ceil(total / limit) };
    }

    // ─── PRIVATE HELPERS ──────────────────────────────

    async _log(integration, eventType, status, message, details = null, duration = 0, itemsProcessed = 0, itemsFailed = 0) {
        try {
            await IntegrationLog.create({
                tenantId: integration.tenantId,
                branchId: integration.branchId,
                integrationId: integration._id,
                integrationType: integration.integrationType,
                eventType, status, message, details, duration, itemsProcessed, itemsFailed
            });
        } catch (err) {
            console.error('Failed to write integration log:', err.message);
        }
    }
}

module.exports = new IntegrationService();
