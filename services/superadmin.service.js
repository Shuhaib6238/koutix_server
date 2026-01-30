const User = require('../models/user.model');

class SuperAdminService {
  async approveChainManager(userId, email) {
    const query = userId ? { _id: userId } : { email };
    const user = await User.findOneAndUpdate(
      query,
      { status: 'active' },
      { new: true }
    );
    return user;
  }
}

module.exports = new SuperAdminService();
