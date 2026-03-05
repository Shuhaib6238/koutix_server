const User = require('../users/user.model');
const Branch = require('../branches/branch.model');
const Invitation = require('../users/invitation.model');
const emailService = require('../../utils/email.service');
const crypto = require('crypto');
const admin = require('../../config/firebase');
const mongoose = require('mongoose');
const dashboardService = require('./dashboard.service');


class ChainController {

  async getDashboardStats(req, res) {
    try {
      const orgId = req.user.org_id || req.user.tenantId;
      const role = req.user.role?.toUpperCase();

      if (role === 'CHAIN_MANAGER' || role === 'CHAINMANAGER') {
        const stats = await dashboardService.getChainManagerStats(orgId);
        return res.status(200).json(stats);
      } else if (role === 'BRANCH_MANAGER' || role === 'BRANCHMANAGER') {
        const branchId = req.user.branch_id;
        const stats = await dashboardService.getBranchManagerStats(orgId, branchId);
        return res.status(200).json(stats);
      } else {
        return res.status(403).json({ message: 'Access denied' });
      }
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async inviteBranchManager(req, res) {
    try {
      const { name, location, managerEmail, address } = req.body;
      const org_id = req.user.org_id || req.user.tenantId;

      if (!name || !location || !managerEmail) {
        return res.status(400).json({ message: 'Name, location, and managerEmail are required' });
      }

      // 1. Generate branch_id and pos_api_key
      const generated_branch_id = `BR${Math.floor(1000 + Math.random() * 9000)}`;
      const pos_api_key = crypto.randomBytes(16).toString('hex');
      const tempPassword = crypto.randomBytes(16).toString('hex'); // Temporary secret password

      // 2. Create user in Firebase with temp password
      const userRecord = await admin.auth().createUser({
        email: managerEmail,
        password: tempPassword,
        displayName: name,
      });

      const userId = new mongoose.Types.ObjectId();

      // 3. Generate Password Reset Link
      const resetLink = await admin.auth().generatePasswordResetLink(managerEmail);

      // 4. Create branch
      const branch = new Branch({
        org_id,
        name,
        address: address || 'N/A',
        location,
        branch_id: generated_branch_id,
        pos_api_key,
        manager_email: managerEmail,
        manager_id: userId
      });
      await branch.save();

      // 5. Create User in MongoDB
      const newUser = new User({
        _id: userId,
        firebaseUid: userRecord.uid,
        email: managerEmail,
        displayName: name,
        role: 'BRANCH_MANAGER',
        type: 'PARTNER',
        org_id,
        branch_id: branch._id,
        status: 'active'
      });
      await newUser.save();

      // 6. Send email notification with reset link
      const emailResult = await emailService.sendBranchManagerInvitation(managerEmail, name, resetLink);

      return res.status(201).json({
        message: emailResult.success
          ? 'Branch and Manager account created. Activation email sent.'
          : 'Branch and Manager created, but activation email failed. Please check SMTP settings.',
        emailSuccess: emailResult.success,
        emailError: emailResult.error || null,
        branch,
        user: { email: managerEmail, role: 'BRANCH_MANAGER' }
      });
    } catch (error) {
      // Rollback Firebase user if it was created
      if (typeof userRecord !== 'undefined' && userRecord.uid) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
        } catch (rollbackError) {
          console.error("Rollback error:", rollbackError);
        }
      }
      res.status(400).json({ message: error.message });
    }
  }

  async getBranches(req, res) {
    try {
      const orgId = req.user.org_id || req.user.tenantId;
      const branches = await Branch.find({ org_id: orgId }).populate('manager_id');
      res.status(200).json(branches);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async getBranchDetails(req, res) {
    try {
      const branchId = req.params.id;
      const orgId = req.user.org_id;

      const branch = await Branch.findOne({ _id: branchId, org_id: orgId }).populate('manager_id');
      if (!branch) return res.status(404).json({ message: 'Branch not found' });

      // Fetch related data
      const Product = require('../products/product.model');
      const Transaction = require('../orders/transaction.model');

      const products = await Product.find({ org_id: orgId }).limit(10);
      const orders = await Transaction.find({ branch_id: branchId }).sort({ createdAt: -1 }).limit(10);
      const stats = await dashboardService.getBranchManagerStats(orgId, branchId);

      // Map low stock
      const inventory = products.filter(p => p.stock < (p.reorderLevel || 10));

      res.status(200).json({
        branch,
        stats: {
          salesToday: `$${stats.totalSales.toFixed(2)}`,
          ordersToday: stats.transactions,
          customers: Math.floor(stats.transactions * 0.8), // Mock logic until customer module fully linked
          lowStock: inventory.length,
          revenue: `$${(stats.totalSales * 30).toFixed(0)}` // Mock monthly
        },
        products,
        orders,
        inventory
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new ChainController();
