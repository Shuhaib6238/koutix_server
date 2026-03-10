/**
 * @file Admin routes — Super Admin only.
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const adminController = require("../controllers/admin.controller");

const router = Router();

// All admin routes require superAdmin
router.use(authenticate, requireRole("superAdmin"));

router.get("/stats", adminController.getStats);
router.get("/stores", adminController.getAllStores);
router.patch("/stores/:id/approve", adminController.approveStore);
router.patch(
  "/stores/:id/subscription",
  adminController.updateStoreSubscription,
);
router.get("/users", adminController.getUsers);
router.patch("/users/:id/role", adminController.updateUserRole);
router.get("/promotions", adminController.getPromotions);

module.exports = router;
