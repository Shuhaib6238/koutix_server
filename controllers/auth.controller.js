const authService = require('../services/auth.service');

class AuthController {
  async signup(req, res) {
    try {
      const { email, password, displayName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      const user = await authService.signup(email, password, displayName);
      res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      const data = await authService.login(email, password);
      res.status(200).json(data);
    } catch (error) {
      res.status(401).json({ message: error.message });
    }
  }
}

module.exports = new AuthController();
