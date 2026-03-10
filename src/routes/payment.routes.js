const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const paymentController = require("../controllers/payment.controller");

const router = express.Router();

router.post(
  "/session",
  authenticate,
  requireRole("customer"),
  paymentController.createSession,
);

// Webhook route is mounted in app.js before express.json()

router.post("/verify", authenticate, paymentController.verifyPayment);
router.post(
  "/refund/:orderId",
  authenticate,
  requireRole("superAdmin", "branchManager"),
  paymentController.refundPayment,
);

module.exports = router;
