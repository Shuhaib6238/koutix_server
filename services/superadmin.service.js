const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const Branch = require('../models/branch.model');
const Store = require('../models/store.model');

class SuperAdminService {
  async getAllChainManagers() {
    const managers = await User.find({ role: 'ChainManager' }).populate('org_id');
    return managers.map(this._formatChainManager);
  }

  _formatChainManager(user) {
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
      countryCode: null
    };
  }

  async getDashboardStats() {
    const [
      totalUsers,
      totalChainManagers,
      pendingChainManagers,
      activeChainManagers,
      totalBranchManagers,
      activeBranchManagers,
      noChainedManagers,
      totalOrganizations,
      totalBranches,
      totalIndependentStores
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'ChainManager' }),
      User.countDocuments({ role: 'ChainManager', status: 'pending' }),
      User.countDocuments({ role: 'ChainManager', status: 'active' }),
      User.countDocuments({ role: 'BranchManager' }),
      User.countDocuments({ role: 'BranchManager', status: 'active' }),
      User.countDocuments({ role: 'admin' }),
      Organization.countDocuments(),
      Branch.countDocuments(),
      Store.countDocuments()
    ]);

    return {
      users: {
        total: totalUsers,
        chainManagers: {
          total: totalChainManagers,
          active: activeChainManagers
        },
        branchManagers: {
          total: totalBranchManagers,
          active: activeBranchManagers
        },
        noChainedManagers: {
          total: noChainedManagers
        }
      },
      organizations: {
        total: totalOrganizations
      },
      branches: {
        total: totalBranches
      },
      stores: {
        total: totalBranches + totalIndependentStores,
        independent: totalIndependentStores,
        chained: totalBranches
      }
    };
  }

  /**
   * Get all supermarkets grouped into:
   * 1. chains — ChainManagers with their org details + branches under each org
   * 2. singleMarkets — BranchManagers who registered independently (no ChainManager owns their org)
   */
  async getSupermarkets() {
    // 1. Get all ChainManagers with populated org
    const chainManagers = await User.find({ role: 'ChainManager' }).populate('org_id').lean();

    // 2. For each chain, get branches under that org
    const chains = await Promise.all(
      chainManagers.map(async (cm) => {
        const org = cm.org_id || {};
        const orgId = org._id || cm.org_id;

        // Get all branches under this organization
        const branches = orgId
          ? await Branch.find({ org_id: orgId }).lean()
          : [];

        return {
          id: cm._id,
          ownerName: cm.displayName || '',
          email: cm.email || '',
          phone: cm.phoneNumber || '',
          status: cm.status,
          organization: {
            id: org._id || null,
            name: org.name || '',
            hqAddress: org.hq_address || '',
            vatTrn: org.vat_trn || '',
            tradeLicense: org.trade_license || '',
            logoUrl: org.logo_url || '',
            primaryColor: org.primary_color || '',
            expectedBranchCount: org.expected_branch_count || 0,
            posSystem: org.pos_system || 'Custom',
          },
          branches: branches.map(b => ({
            id: b._id,
            name: b.name || '',
            address: b.address || '',
            managerEmail: b.manager_email || '',
            status: b.status || 'active',
            posSystem: b.pos_system || 'Custom',
          })),
        };
      })
    );

    // 3. Get all org IDs that belong to ChainManagers
    const chainOrgIds = chainManagers
      .filter(cm => cm.org_id)
      .map(cm => (cm.org_id._id || cm.org_id).toString());

    // 4. Get all BranchManagers
    const branchManagers = await User.find({ role: 'BranchManager' }).populate('org_id').populate('branch_id').lean();

    // 5. Filter to only those whose org is NOT owned by a ChainManager (independent)
    const singleMarkets = branchManagers
      .filter(bm => {
        const orgId = bm.org_id?._id || bm.org_id;
        return !orgId || !chainOrgIds.includes(orgId.toString());
      })
      .map(bm => {
        const org = (typeof bm.org_id === 'object' && bm.org_id) || {};
        const branch = (typeof bm.branch_id === 'object' && bm.branch_id) || {};

        return {
          id: bm._id,
          ownerName: bm.displayName || '',
          email: bm.email || '',
          phone: bm.phoneNumber || '',
          status: bm.status,
          storeName: branch.name || org.name || '',
          address: branch.address || org.hq_address || '',
          logoUrl: branch.logo_url || org.logo_url || '',
          primaryColor: branch.primary_color || org.primary_color || '',
          posSystem: branch.pos_system || org.pos_system || 'Custom',
          vatTrn: branch.vat_trn || org.vat_trn || '',
          tradeLicense: branch.trade_license || org.trade_license || '',
        };
      });

    return { chains, singleMarkets };
  }
}

module.exports = new SuperAdminService();
