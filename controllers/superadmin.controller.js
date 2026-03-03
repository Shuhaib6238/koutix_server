const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const admin = require('../config/firebase');
const mongoose = require('mongoose');
const superAdminService = require('../services/superadmin.service');

class SuperAdminController {
  async createChainManager(req, res) {
    try {
      const { email, password, displayName, organizationName } = req.body;

      if (!email || !password || !organizationName) {
        return res.status(400).json({ message: 'Email, password, and organization name are required' });
      }

      // 1. Create user in Firebase
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });

      const userId = new mongoose.Types.ObjectId();

      // 2. Create organization
      const organization = new Organization({
        name: organizationName,
      });
      await organization.save();

      // 3. Create user in MongoDB
      const user = new User({
        _id: userId,
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: 'ChainManager',
        org_id: organization._id,
        status: 'active'
      });
      await user.save();

      res.status(201).json({ message: 'ChainManager and Organization created successfully', user, organization });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async getAllChainManagers(req, res) {
    try {
      const managers = await superAdminService.getAllChainManagers();
      res.status(200).json(managers);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async getDashboardStats(req, res) {
    try {
      const stats = await superAdminService.getDashboardStats();
      res.status(200).json(stats);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async getSupermarkets(req, res) {
    try {
      const data = await superAdminService.getSupermarkets();
      res.status(200).json(data);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async getAllBranchManagers(req, res) {
    try {
      const managers = await User.find({ role: 'BranchManager' }).populate('org_id').populate('branch_id');
      res.status(200).json(managers);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new SuperAdminController();
