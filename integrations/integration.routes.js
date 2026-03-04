const express = require('express');
const integrationController = require('./integration.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const checkSubscription = require('../middlewares/subscription.middleware');

const router = express.Router();

// ─── Chain Manager: Full CRUD ───────────────────────

const chainOnly = roleMiddleware(['CHAIN_MANAGER', 'ChainManager']);
const chainOrBranch = roleMiddleware(['CHAIN_MANAGER', 'ChainManager', 'BRANCH_MANAGER', 'BranchManager']);

// Create integration
router.post('/', authMiddleware, checkSubscription, chainOnly,
    (req, res) => integrationController.create(req, res));

// Get all integrations (for the tenant)
router.get('/', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.getAll(req, res));

// Get integration for a specific branch (with chain fallback)
router.get('/branch/:branchId', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.getForBranch(req, res));

// Get all logs for the tenant
router.get('/logs', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.getAllLogs(req, res));

// Get specific integration
router.get('/:id', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.getById(req, res));

// Update integration (chain manager only)
router.put('/:id', authMiddleware, checkSubscription, chainOnly,
    (req, res) => integrationController.update(req, res));

// Delete integration (chain manager only)
router.delete('/:id', authMiddleware, checkSubscription, chainOnly,
    (req, res) => integrationController.remove(req, res));

// ─── Sync Operations ───────────────────────────────

// Trigger product sync
router.post('/:id/sync/products', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.syncProducts(req, res));

// Trigger inventory sync
router.post('/:id/sync/inventory', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.syncInventory(req, res));

// Push order to POS
router.post('/:id/sync/order', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.pushOrder(req, res));

// Health check
router.get('/:id/health', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.healthCheck(req, res));

// Get logs for a specific integration
router.get('/:id/logs', authMiddleware, checkSubscription, chainOrBranch,
    (req, res) => integrationController.getLogs(req, res));

// ─── Webhook (public — POS pushes data to Koutix) ──

router.post('/webhook', (req, res) => integrationController.handleWebhook(req, res));

module.exports = router;
