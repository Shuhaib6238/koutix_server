const express = require("express");
const adminController = require('./admin.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const roleMiddleware = require('../../middleware/role.middleware');

const router = express.Router();

router.post("/signup", adminController.signup);
router.post("/login", adminController.login);
router.get("/dashboard", authMiddleware, roleMiddleware(["admin"]), adminController.getDashboardStats);

module.exports = router;
