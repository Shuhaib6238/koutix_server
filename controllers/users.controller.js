const userService = require('../services/users.service');

class UserController {
  async getProfile(req, res) {
    try {
      // Assuming user ID is available in req.user from auth middleware
      // For now, we might need to pass it in params or body if middleware isn't fully set up for this
      const userId = req.params.id || req.user?.id;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      const user = await userService.getUserById(userId);
      res.status(200).json(user);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.params.id || req.user?.id;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      const user = await userService.updateUserProfile(userId, req.body);
      res.status(200).json({
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async uploadProfileImage(req, res) {
    try {
      const userId = req.params.id || req.user?.id;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const imagePath = `/uploads/${req.file.filename}`;
      const user = await userService.updateUserProfile(userId, { profileImage: imagePath });

      res.status(200).json({
        message: 'Profile image uploaded successfully',
        profileImage: imagePath,
        data: user
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new UserController();
