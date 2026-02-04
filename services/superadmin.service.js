const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const Branch = require('../models/branch.model');

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

  async getDashboardStats() {
    const [
      totalUsers,
      totalChainManagers,
      pendingChainManagers,
      totalOrganizations,
      totalBranches
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'ChainManager' }),
      User.countDocuments({ role: 'ChainManager', status: 'pending' }),
      Organization.countDocuments(),
      Branch.countDocuments()
    ]);

    return {
      users: {
        total: totalUsers,
        chainManagers: {
          total: totalChainManagers,
          pending: pendingChainManagers
        }
      },
      organizations: {
        total: totalOrganizations
      },
      branches: {
        total: totalBranches
      }
    };
  }
}

module.exports = new SuperAdminService();
