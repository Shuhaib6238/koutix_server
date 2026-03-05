const express = require('express');
const superAdminController = require('./superadmin.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const roleMiddleware = require('../../middleware/role.middleware');

const router = express.Router();

router.get('/chain-managers', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getAllChainManagers);
router.get('/pending-chains', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getPendingChainManagers);
router.get('/branch-managers', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getAllBranchManagers);
router.get('/dashboard', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getDashboardStats);
router.get('/supermarkets', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getSupermarkets);
router.put('/deactivate-user/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.deactivateUser);
router.put('/approve-chain/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.approveChainManager);
router.put('/reject-chain/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.rejectChainManager);

module.exports = router;
