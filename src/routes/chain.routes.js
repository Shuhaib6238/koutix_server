/**
 * @file Chain routes — branch management endpoints.
 * Protected: chainManager only.
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const chainController = require("../controllers/chain.controller");

const router = Router();

// All chain routes require chainManager auth
router.use(authenticate, requireRole("chainManager"));

router.post("/branches", chainController.addBranch);
router.get("/branches", chainController.listBranches);
router.patch("/branches/:id", chainController.updateBranch);
router.delete("/branches/:id", chainController.deleteBranch);

module.exports = router;
