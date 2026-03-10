/**
 * @file Upload routes — presigned URL generation.
 * Protected: any authenticated user.
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const uploadController = require("../controllers/upload.controller");

const router = Router();

router.post("/presigned-url", authenticate, uploadController.getPresignedUrl);

module.exports = router;
