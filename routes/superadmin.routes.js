const express = require('express');
const superAdminController = require('../controllers/superadmin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = express.Router();

router.get('/chain-managers', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.getAllChainManagers);
// New specific routes
router.get('/dashboard', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.getDashboardStats);
router.get('/supermarkets', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.getSupermarkets);
router.get('/branch-managers', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.getAllBranchManagers);

module.exports = router;
