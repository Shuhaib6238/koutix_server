const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Protected routes (ChainManagers only)
router.post('/create-session', authMiddleware, roleMiddleware(['ChainManager']), subscriptionController.createSession);
router.post('/cancel', authMiddleware, roleMiddleware(['ChainManager']), subscriptionController.cancel);
router.post('/change-plan', authMiddleware, roleMiddleware(['ChainManager']), subscriptionController.changePlan);

module.exports = router;
