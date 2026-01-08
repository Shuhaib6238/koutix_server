const adminService = require("../services/admin.service");

class AdminController {
  async signup(req, res) {
    try {
      const { storeName, email, password } = req.body;
      if (!storeName || !email || !password) {
        return res
          .status(400)
          .json({ message: "Store Name, Email, and Password are required" });
      }

      const result = await adminService.signup(storeName, email, password);
      res.status(201).json({
        message: "Admin and Store created successfully",
        data: result,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and Password are required" });
      }

      const result = await adminService.login(email, password);
      res.status(200).json(result);
    } catch (error) {
      const status = error.message.includes("Access denied") ? 403 : 401;
      res.status(status).json({ message: error.message });
    }
  }
}

module.exports = new AdminController();
