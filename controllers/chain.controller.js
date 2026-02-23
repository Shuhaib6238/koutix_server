const User = require('../models/user.model');
const Branch = require('../models/branch.model');
const Invitation = require('../models/invitation.model');
const emailService = require('../services/email.service');
const crypto = require('crypto');
const admin = require('../config/firebase');
const mongoose = require('mongoose');
const dashboardService = require('../services/dashboard.service');


class ChainController {

  async getDashboardStats(req, res) {
    try {
      const orgId = req.user.org_id;
      const role = req.user.role;

      if (role === 'ChainManager') {
        const stats = await dashboardService.getChainManagerStats(orgId);
        return res.status(200).json(stats);
      } else if (role === 'BranchManager') {
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
      const org_id = req.user?.org_id;

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
        role: 'BranchManager',
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
        user: { email: managerEmail, role: 'BranchManager' }
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
      const branches = await Branch.find({ org_id: req.user.org_id }).populate('manager_id');
      res.status(200).json(branches);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new ChainController();
