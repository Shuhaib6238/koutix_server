/**
 * @file Product routes — barcode lookup.
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const productController = require("../controllers/product.controller");

const router = Router();

// Customer auth required
router.get("/barcode/:barcode", authenticate, productController.getByBarcode);

module.exports = router;
