const integrationService = require('./integration.service');
const { addSyncJob } = require('../../queues/integrationQueue');

/**
 * IntegrationController — REST API endpoints for POS integration management
 */
class IntegrationController {

    // ─── CRUD ─────────────────────────────────────────

    async create(req, res) {
        try {
            const tenantId = req.user.org_id || req.user.tenantId;
            if (!tenantId) return res.status(400).json({ message: 'No organization linked' });

            const { name, integrationType, branchId, credentials, settings, scope } = req.body;
            if (!name || !integrationType) {
                return res.status(400).json({ message: 'name and integrationType are required' });
            }

            const integration = await integrationService.createIntegration({
                tenantId,
                branchId: branchId || null,
                integrationType,
                name,
                scope: branchId ? 'BRANCH' : (scope || 'CHAIN'),
                credentials: credentials || {},
                settings: settings || {},
                status: integrationType === 'MANUAL' ? 'ACTIVE' : 'CONFIGURING',
            });

            res.status(201).json(integration);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async getAll(req, res) {
        try {
            const tenantId = req.user.org_id || req.user.tenantId;
            const integrations = await integrationService.getIntegrations(tenantId);
            res.status(200).json(integrations);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async getById(req, res) {
        try {
            const integration = await integrationService.getIntegrationById(req.params.id);
            if (!integration) return res.status(404).json({ message: 'Integration not found' });
            res.status(200).json(integration);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async getForBranch(req, res) {
        try {
            const tenantId = req.user.org_id || req.user.tenantId;
            const { branchId } = req.params;
            const integration = await integrationService.getIntegrationForBranch(tenantId, branchId);
            if (!integration) return res.status(404).json({ message: 'No integration found for this branch' });
            // Strip credentials for branch managers
            const role = req.user.role;
            if (role === 'BRANCH_MANAGER' || role === 'BranchManager') {
                const safe = integration.toObject();
                safe.credentials = { apiUrl: safe.credentials?.apiUrl ? '••••••' : null };
                return res.status(200).json(safe);
            }
            res.status(200).json(integration);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async update(req, res) {
        try {
            const integration = await integrationService.updateIntegration(req.params.id, req.body);
            if (!integration) return res.status(404).json({ message: 'Integration not found' });
            res.status(200).json(integration);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async remove(req, res) {
        try {
            const integration = await integrationService.deleteIntegration(req.params.id);
            if (!integration) return res.status(404).json({ message: 'Integration not found' });
            res.status(200).json({ message: 'Integration removed', id: req.params.id });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    // ─── SYNC OPERATIONS ─────────────────────────────

    async syncProducts(req, res) {
        try {
            const { branchId } = req.body;
            const job = await addSyncJob(req.params.id, 'products', branchId);
            res.status(202).json({ message: 'Product sync queued successfully', jobId: job.id });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async syncInventory(req, res) {
        try {
            const { branchId } = req.body;
            const job = await addSyncJob(req.params.id, 'inventory', branchId);
            res.status(202).json({ message: 'Inventory sync queued successfully', jobId: job.id });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async pushOrder(req, res) {
        try {
            const result = await integrationService.pushOrder(req.params.id, req.body);
            res.status(200).json(result);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async healthCheck(req, res) {
        try {
            const result = await integrationService.healthCheck(req.params.id);
            res.status(200).json(result);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    // ─── LOGS ─────────────────────────────────────────

    async getLogs(req, res) {
        try {
            const { page = 1, limit = 50 } = req.query;
            const result = await integrationService.getLogs(req.params.id, parseInt(page), parseInt(limit));
            res.status(200).json(result);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    async getAllLogs(req, res) {
        try {
            const tenantId = req.user.org_id || req.user.tenantId;
            const { page = 1, limit = 50 } = req.query;
            const result = await integrationService.getLogsByTenant(tenantId, parseInt(page), parseInt(limit));
            res.status(200).json(result);
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }

    // ─── WEBHOOK (for push-model inventory) ───────────

    async handleWebhook(req, res) {
        try {
            const { integrationId, eventType, data } = req.body;
            if (!integrationId) return res.status(400).json({ message: 'integrationId required' });

            const integration = await integrationService.getIntegrationById(integrationId);
            if (!integration) return res.status(404).json({ message: 'Integration not found' });

            if (eventType === 'STOCK_UPDATE' && data) {
                const Product = require('../products/product.model');
                for (const item of (Array.isArray(data) ? data : [data])) {
                    if (item.sku && item.stock != null) {
                        await Product.findOneAndUpdate(
                            { sku: item.sku, org_id: integration.tenantId },
                            { stock: item.stock },
                            { new: true }
                        );
                    }
                }
            }

            res.status(200).json({ received: true });
        } catch (err) {
            res.status(400).json({ message: err.message });
        }
    }
}

module.exports = new IntegrationController();
