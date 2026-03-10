/**
 * @file Order routes
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const orderController = require("../controllers/order.controller");

const router = Router();

// Create order - customers only
router.post(
  "/",
  authenticate,
  requireRole("customer"),
  orderController.createOrder,
);

// Get my orders - customers only
router.get(
  "/my",
  authenticate,
  requireRole("customer"),
  orderController.getMyOrders,
);

// Get order by id - customer or branchManager
router.get(
  "/:id",
  authenticate,
  requireRole("customer", "branchManager", "chainManager"),
  orderController.getOrderById,
);

// Get digital receipt
router.get(
  "/:id/receipt",
  authenticate,
  requireRole("customer", "branchManager"),
  orderController.getDigitalReceipt,
);

// Update status - branchManager or customer (cancel)
router.patch(
  "/:id/status",
  authenticate,
  requireRole("customer", "branchManager", "superAdmin"),
  orderController.updateOrderStatus,
);

module.exports = router;
