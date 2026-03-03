const express = require('express');
const superAdminController = require('../controllers/superadmin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = express.Router();

router.get('/chain-managers', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getAllChainManagers);
router.get('/pending-chains', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getPendingChainManagers);
router.get('/approve-chain/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.approveChainManager);
router.get('/reject-chain/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.rejectChainManager);
router.get('/dashboard', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getDashboardStats);
router.get('/supermarkets', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getSupermarkets);
router.get('/branch-managers', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'SuperAdmin']), superAdminController.getAllBranchManagers);

module.exports = router;
