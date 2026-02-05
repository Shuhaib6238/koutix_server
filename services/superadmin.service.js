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

  async rejectChainManager(userId) {
    // We can either set status to 'rejected' (if Enum allows) or delete.
    // User model status enum: ['pending', 'active', 'inactive']. 
    // 'inactive' seems appropriate for rejection or we can add 'rejected'.
    // Use 'inactive' for now to be safe with Schema validation.
    const user = await User.findByIdAndUpdate(
      userId,
      { status: 'inactive' },
      { new: true }
    );
    return user;
  }

  async getPendingChainManagers() {
    const managers = await User.find({ role: 'ChainManager', status: 'pending' }).populate('org_id');

    return managers.map(user => {
      const org = user.org_id || {};
      return {
        _id: user._id,
        fullName: user.displayName,
        email: user.email,
        phone: user.phoneNumber,
        status: user.status,
        // Organization Details
        chainName: org.name,
        hqAddress: org.hq_address,
        vatTrn: org.vat_trn,
        tradeLicense: org.trade_license,
        logoUrl: org.logo_url,
        primaryColor: org.primary_color,
        expectedBranchCount: org.expected_branch_count,
        posSystem: org.pos_system,
        // countryCode is not persisted in User model currently
        countryCode: null
      };
    });
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
