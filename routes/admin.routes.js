const express = require("express");
const adminController = require("../controllers/admin.controller");

const router = express.Router();

router.post("/signup", adminController.signup);
router.post("/login", adminController.login);

module.exports = router;
