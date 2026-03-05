const express = require('express');
const router = express.Router();
const subscriptionController = require('./subscription.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const roleMiddleware = require('../../middleware/role.middleware');

// Public — load available plans
router.get('/plans', subscriptionController.getPlans);

// Protected routes (ChainManagers only)
router.post('/create-session', authMiddleware, roleMiddleware(['CHAIN_MANAGER', 'ChainManager']), subscriptionController.createSession);
router.post('/cancel', authMiddleware, roleMiddleware(['CHAIN_MANAGER', 'ChainManager']), subscriptionController.cancel);
router.post('/change-plan', authMiddleware, roleMiddleware(['CHAIN_MANAGER', 'ChainManager']), subscriptionController.changePlan);

module.exports = router;
