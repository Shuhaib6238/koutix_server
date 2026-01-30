const express = require('express');
const superAdminController = require('../controllers/superadmin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = express.Router();

router.post('/chain-manager', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.createChainManager);
router.get('/chain-managers', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.getAllChainManagers);
router.post('/approve-chain-manager', authMiddleware, roleMiddleware(['SuperAdmin']), superAdminController.approveChainManager);

module.exports = router;
