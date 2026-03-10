/**
 * @file Auth routes — signup, sync, set-password.
 */
const { Router } = require("express");
const { authLimiter } = require("../middleware/rateLimiter.middleware");
const authController = require("../controllers/auth.controller");

const router = Router();

// Rate limit all auth endpoints: 5 requests/min per IP
router.use(authLimiter);

/** Chain Manager Signup */
router.post("/signup/chain", authController.signupChain);

/** Standalone Store Signup */
router.post("/signup/standalone", authController.signupStandalone);

/** Sync user after Firebase login */
router.post("/sync-user", authController.syncUser);

/** Set password (branch manager invite activation) */
router.post("/set-password", authController.setPassword);

module.exports = router;
