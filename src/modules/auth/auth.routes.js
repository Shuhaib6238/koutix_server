const express = require('express');
const authController = require('./auth.controller');
const verifyFirebaseToken = require('../../middleware/firebaseAuth.middleware');
const authMiddleware = require('../../middleware/auth.middleware');
const roleMiddleware = require('../../middleware/role.middleware');

const router = express.Router();

// ══════════════════════════════════════════════════════════════
// NEW AUTH FLOWS (per architecture spec)
// ══════════════════════════════════════════════════════════════

// 1. Register Tenant (Supermarket) — Firebase token required
router.post('/register-tenant', verifyFirebaseToken, authController.registerTenant);

// 2. Login / Get User Profile — works with both Firebase & server JWT
router.get('/me', authController.me);

// 3. Customer Sync — auto-creates customer user on first login
router.post('/customer-sync', authController.customerSync);

// 4. Create Branch Manager (by Chain Manager) — auth + role protected
router.post('/create-branch-manager', authMiddleware, roleMiddleware(['CHAIN_MANAGER', 'ChainManager']), authController.createBranchManager);

// ══════════════════════════════════════════════════════════════
// LEGACY ROUTES (backward compatible)
// ══════════════════════════════════════════════════════════════

router.get('/verify-invitation', authController.verifyInvitation);
router.post('/complete-onboarding', authController.completeOnboarding);
router.post('/signup-chain-manager', authController.signupChainManager);
router.post('/signup-branch-manager', authController.signupBranchManager);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;
