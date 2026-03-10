/**
 * @file Store routes — public and customer-facing.
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const storeController = require("../controllers/store.controller");

const router = Router();

// PUBLIC — no auth required
router.get("/nearby", storeController.getNearbyStores);
router.get("/promoted", storeController.getPromotedStores);
router.get("/:id", storeController.getStore);
router.get("/:id/operating-hours", storeController.getOperatingHours);

// CUSTOMER — requires Firebase auth
router.get("/:id/products", authenticate, storeController.getStoreProducts);

module.exports = router;
