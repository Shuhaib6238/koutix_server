const express = require("express");
const adminController = require("../controllers/admin.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

const router = express.Router();

router.post("/signup", adminController.signup);
router.post("/login", adminController.login);
router.get("/dashboard", authMiddleware, roleMiddleware(["admin"]), adminController.getDashboardStats);

module.exports = router;
