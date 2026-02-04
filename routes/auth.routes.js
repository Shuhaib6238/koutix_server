const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.get('/verify-invitation', authController.verifyInvitation);
router.post('/complete-onboarding', authController.completeOnboarding);
router.post('/signup-chain-manager', authController.signupChainManager);
router.post('/signup-branch-manager', authController.signupBranchManager);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;
