const express = require('express');
const chainController = require('./chain.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const roleMiddleware = require('../../middleware/role.middleware');
const checkSubscription = require('../../middleware/subscription.middleware');

const router = express.Router();

const partnerController = require('../admin/partner.controller');

router.post('/signup', partnerController.signupChainManager);

router.post('/stores', authMiddleware, checkSubscription, roleMiddleware(['CHAIN_MANAGER', 'ChainManager']), chainController.inviteBranchManager);
router.get('/stores', authMiddleware, checkSubscription, roleMiddleware(['CHAIN_MANAGER', 'ChainManager']), chainController.getBranches);
router.get('/stores/:id/details', authMiddleware, checkSubscription, roleMiddleware(['CHAIN_MANAGER', 'ChainManager']), chainController.getBranchDetails);
router.get('/dashboard', authMiddleware, checkSubscription, roleMiddleware(['CHAIN_MANAGER', 'BRANCH_MANAGER', 'ChainManager', 'BranchManager']), chainController.getDashboardStats);

module.exports = router;
