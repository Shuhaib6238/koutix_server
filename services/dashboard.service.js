const User = require('../models/user.model');
const Branch = require('../models/branch.model');
const Product = require('../models/product.model');
const Transaction = require('../models/transaction.model');
const Store = require('../models/store.model');

class DashboardService {
  async getChainManagerStats(orgId) {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [
        totalBranches,
        totalProducts,
        totalTransactions,
        salesSummary,
        recentOrders,
        branchPerformance,
        topProducts,
        integrationStatus
      ] = await Promise.all([
        Branch.countDocuments({ org_id: orgId }),
        Product.countDocuments({ org_id: orgId }),
        Transaction.countDocuments({ org_id: orgId }),
        Transaction.aggregate([
          { $match: { org_id: orgId, createdAt: { $gte: startOfToday } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
        ]),
        Transaction.find({ org_id: orgId })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('branch_id', 'name'),
        Transaction.aggregate([
          { $match: { org_id: orgId } }, // For comparison, maybe use all time or last 30 days. Let's do last 30.
          {
            $group: {
              _id: '$branch_id',
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 }
            }
          },
          {
            $lookup: {
              from: 'branches',
              localField: '_id',
              foreignField: '_id',
              as: 'branchInfo'
            }
          },
          { $unwind: '$branchInfo' },
          {
            $project: {
              name: '$branchInfo.name',
              revenue: 1,
              orders: 1
            }
          },
          { $sort: { revenue: -1 } }
        ]),
        Transaction.aggregate([
          { $match: { org_id: orgId } },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.product_id',
              name: { $first: '$items.name' },
              sold: { $sum: '$items.quantity' },
              revenue: { $sum: '$items.total' }
            }
          },
          { $sort: { sold: -1 } },
          { $limit: 5 }
        ]),
        Branch.find({ org_id: orgId }, 'name sapSyncStatus lastSyncAt')
      ]);

      // Calculate sales trend for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const salesTrend = await Transaction.aggregate([
        { $match: { org_id: orgId, createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            total: { $sum: "$totalAmount" }
          }
        },
        { $sort: { "_id": 1 } }
      ]);

      return {
        totalBranches,
        totalProducts,
        totalTransactions,
        overview: {
          revenueToday: salesSummary[0]?.total || 0,
          ordersToday: salesSummary[0]?.count || 0,
          revenueTrend: '+12%', // Mock trend for now
          customerGrowth: '+5%'  // Mock trend for now
        },
        salesTrend: salesTrend.map(d => ({ date: d._id, amount: d.total })),
        branchPerformance,
        recentOrders: recentOrders.map(o => ({
          id: o.transactionId,
          branch: o.branch_id?.name || 'Unknown',
          amount: o.totalAmount,
          status: o.status,
          time: o.createdAt
        })),
        topProducts,
        integrationStatus
      };
    } catch (error) {
      console.error('Error in getChainManagerStats:', error);
      throw error;
    }
  }

  async getBranchManagerStats(orgId, branchId) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [transactionsCount, productsCount, salesSummary, recentOrders, lowStockCount] = await Promise.all([
      Transaction.countDocuments({ branch_id: branchId }),
      Product.countDocuments({ org_id: orgId }),
      Transaction.aggregate([
        { $match: { branch_id: branchId, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      Transaction.find({ branch_id: branchId }).sort({ createdAt: -1 }).limit(5),
      Product.countDocuments({ org_id: orgId, stock: { $lt: 10 } }) // Simplified low stock
    ]);

    return {
      transactions: transactionsCount,
      products: productsCount,
      totalSalesToday: salesSummary[0]?.totalSales || 0,
      ordersToday: salesSummary[0]?.count || 0,
      recentOrders,
      lowStockCount
    };
  }

  async getAdminStats(userId) {
    const [stores, products] = await Promise.all([
      Store.countDocuments({ owner: userId }),
      Product.countDocuments({ owner: userId })
    ]);
    return { stores, products };
  }
}

module.exports = new DashboardService();
