/**
 * @file Branch manager routes — orders, inventory, POS management.
 * Protected: branchManager only.
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const branchController = require("../controllers/branch.controller");

const router = Router();

// All branch routes require branchManager auth
router.use(authenticate, requireRole("branchManager", "chainManager"));

// Orders
router.get("/orders", branchController.getOrders);

// Inventory
router.get("/inventory", branchController.getInventory);
router.patch("/products/:id", branchController.updateProduct);

// POS
router.get("/pos/status", branchController.getPosStatus);
router.post("/pos/sync", branchController.triggerPosSync);
router.post("/pos/test", branchController.testPosConnection);

module.exports = router;
