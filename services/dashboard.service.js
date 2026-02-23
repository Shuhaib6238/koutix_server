const User = require('../models/user.model');
const Branch = require('../models/branch.model');
const Product = require('../models/product.model');
const Transaction = require('../models/transaction.model');
const Store = require('../models/store.model');

class DashboardService {
  async getChainManagerStats(orgId) {
    const [branches, managers, products, transactions] = await Promise.all([
      Branch.countDocuments({ org_id: orgId }),
      User.countDocuments({ role: 'BranchManager', org_id: orgId }),
      Product.countDocuments({ org_id: orgId }),
      Transaction.countDocuments({ org_id: orgId })
    ]);
    return { branches, managers, products, transactions };
  }

  async getBranchManagerStats(orgId, branchId) {
    const [transactions, products, salesData] = await Promise.all([
      Transaction.countDocuments({ branch_id: branchId }),
      Product.countDocuments({ org_id: orgId }),
      Transaction.aggregate([
        { $match: { branch_id: branchId } },
        { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
      ])
    ]);
    return { 
      transactions, 
      products, 
      totalSales: salesData[0]?.totalSales || 0 
    };
  }

  async getAdminStats(userId) {
    const [stores, products] = await Promise.all([
      Store.countDocuments({ owner: userId }),
      Product.countDocuments({ owner: userId }) // Independent admin products might be linked to user or store
    ]);
    return { stores, products };
  }
}

module.exports = new DashboardService();
