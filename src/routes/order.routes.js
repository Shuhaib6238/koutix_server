/**
 * @file Order routes — order status update (used across branch + webhook).
 * TODO:RASHID — Add full order flow routes here.
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const branchController = require("../controllers/branch.controller");

const router = Router();

// Branch manager: update order status
router.patch(
  "/:id/status",
  authenticate,
  requireRole("branchManager", "chainManager"),
  branchController.updateOrderStatus,
);

// TODO:RASHID — Add these routes:
// POST /orders — Create new order (customer)
// GET /orders/:id — Get order details
// POST /orders/:id/pay — Process payment
// POST /orders/:id/refund — Process refund

module.exports = router;
