const User = require('../models/user.model');

class UserService {
  async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateUserProfile(userId, updateData) {
    // Prevent updating sensitive fields via profile update
    const { firebaseUid, email, role, ...profileData } = updateData;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: profileData },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}

module.exports = new UserService();
