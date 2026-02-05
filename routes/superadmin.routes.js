const express = require('express');
const superAdminController = require('../controllers/superadmin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = express.Router();

router.post('/chain-manager', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.createChainManager);
router.get('/chain-managers', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.getAllChainManagers);
router.post('/approve-chain-manager', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.approveChainManager);
// New specific routes
router.get('/pending-chains', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.getPendingChainManagers);
router.put('/approve-chain/:chainId', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.approveChainManagerById);
router.put('/reject-chain/:chainId', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.rejectChainManager);

router.get('/dashboard', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.getDashboardStats);

module.exports = router;
