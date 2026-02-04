const User = require('../models/user.model');
const Invitation = require('../models/invitation.model');
const Branch = require('../models/branch.model');
const Organization = require('../models/organization.model');
const admin = require('../config/firebase');
const jwtService = require('../services/jwt.service');
const mongoose = require('mongoose');

class AuthController {
  async verifyInvitation(req, res) {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const invitation = await Invitation.findOne({ token, status: 'pending' });
      if (!invitation) {
        return res.status(404).json({ message: 'Invalid or expired invitation' });
      }

      if (invitation.expiresAt < new Date()) {
        invitation.status = 'expired';
        await invitation.save();
        return res.status(400).json({ message: 'Invitation has expired' });
      }

      res.status(200).json({ message: 'Invitation is valid', invitation });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async completeOnboarding(req, res) {
    try {
      const { token, password, displayName } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required' });
      }

      const invitation = await Invitation.findOne({ token, status: 'pending' });
      if (!invitation || invitation.expiresAt < new Date()) {
        return res.status(400).json({ message: 'Invalid or expired invitation' });
      }

      // 1. Create user in Firebase
      const userRecord = await admin.auth().createUser({
        email: invitation.email,
        password,
        displayName,
      });

      // 2. Create user in MongoDB
      const user = new User({
        firebaseUid: userRecord.uid,
        email: invitation.email,
        displayName: displayName || invitation.email,
        role: invitation.role,
        org_id: invitation.org_id,
        branch_id: invitation.branch_id,
        status: 'active'
      });
      await user.save();

      // 3. Update branch manager if role is BranchManager
      if (invitation.role === 'BranchManager') {
        await Branch.findByIdAndUpdate(invitation.branch_id, { manager_id: user._id });
      }

      // 4. Mark invitation as accepted
      invitation.status = 'accepted';
      await invitation.save();

      // 5. Generate JWT
      const jwtToken = jwtService.sign({ id: user._id, role: user.role });

      res.status(201).json({ message: 'Onboarding complete', user, token: jwtToken });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async signupChainManager(req, res) {
    try {
      const {
        email,
        password,
        fullName,
        phone,
        chainName,
        vatTrn,
        hqAddress,
        tradeLicense,
        logoUrl,
        primaryColor,
        expectedBranchCount,
        posSystem
      } = req.body;

      if (!email || !password || !chainName) {
        return res.status(400).json({ message: 'Email, password, and chain name are required' });
      }

      // 1. Domain Validation removed as per user request
      // const domain = email.split("@")[1];
      // const domainWhitelist = ["nesto.ae", "lulucompany.com", "gmail.com", "outlook.com", "yopmail.com"];
      // if (!domainWhitelist.includes(domain)) {
      //   return res.status(403).json({ message: `Email domain ${domain} is not authorized for Chain Manager signup.` });
      // }

      // 2. Create user in Firebase (Phone number validation is skipped in Firebase to allow custom formats)
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
      });

      const userId = new mongoose.Types.ObjectId();

      // 3. Create organization with retail fields
      const organization = new Organization({
        name: chainName,
        vat_trn: vatTrn,
        hq_address: hqAddress,
        trade_license: tradeLicense,
        logo_url: logoUrl,
        primary_color: primaryColor || '#FF6B35',
        expected_branch_count: expectedBranchCount || 1,
        pos_system: posSystem || 'Custom',
        owner_id: userId,
      });
      await organization.save();

      // 4. Create user in MongoDB with status 'pending'
      const user = new User({
        _id: userId,
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: fullName,
        phoneNumber: phone,
        role: 'ChainManager',
        org_id: organization._id,
        status: 'pending'
      });
      await user.save();

      res.status(201).json({
        message: 'Signup successful. Please wait for SuperAdmin approval.',
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status
        },
        organization
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async signupBranchManager(req, res) {
    try {
      const {
        email,
        password,
        fullName,
        branchName,
        address,
        phoneNumber,
        vatTrn,
        tradeLicense,
        logoUrl,
        primaryColor,
        expectedBranchCount,
        posSystem
      } = req.body;

      console.log("Signup Request - Phone:", phoneNumber, "Branch:", branchName);

      if (!email || !password || !branchName) {
        return res.status(400).json({ message: 'Email, password, and branch name are required' });
      }

      if (logoUrl && logoUrl.length > 500) {
        return res.status(400).json({ message: 'Logo URL is too long. Please use a valid URL.' });
      }

      // 1. Domain-based Auto-linking
      const domain = email.split("@")[1];

      // Look for an existing ChainManager with the same domain
      const existingChainManager = await User.findOne({
        role: 'ChainManager',
        status: 'active',
        email: { $regex: new RegExp(`@${domain}$`, 'i') }
      });

      let orgId;
      const userId = new mongoose.Types.ObjectId();

      if (existingChainManager && existingChainManager.org_id) {
        orgId = existingChainManager.org_id;
      } else {
        // "No Chain" - Create a new Organization for this independent branch
        const organization = new Organization({
          name: `${branchName} Group`,
          owner_id: userId,
          hq_address: address,
          vat_trn: vatTrn,
          trade_license: tradeLicense,
          logo_url: logoUrl,
          primary_color: primaryColor || '#FF6B35',
          expected_branch_count: expectedBranchCount || 1,
          pos_system: posSystem || 'Custom',
          status: 'active'
        });
        await organization.save();
        orgId = organization._id;
      }

      // 2. Create the Branch
      const branch = new Branch({
        name: branchName,
        address: address,
        org_id: orgId,
        manager_id: userId,
        manager_email: email,
        vat_trn: vatTrn,
        trade_license: tradeLicense,
        logo_url: logoUrl,
        primary_color: primaryColor,
        expected_branch_count: expectedBranchCount,
        pos_system: posSystem
      });
      await branch.save();

      // 3. Create user in Firebase
      // Note: We skip sending phoneNumber to Firebase to avoid strict E.164 validation errors.
      // The phone number is saved in MongoDB instead.
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
      });

      // 4. Create user in MongoDB
      const user = new User({
        _id: userId,
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: fullName,
        phoneNumber: phoneNumber,
        role: 'BranchManager',
        org_id: orgId,
        branch_id: branch._id,
        status: 'active' // Branch managers are auto-approved if they sign up directly (or we can make them pending)
      });
      await user.save();

      res.status(201).json({
        message: 'Branch Manager signup successful',
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          org_id: user.org_id,
          branch_id: user.branch_id
        },
        branch
      });
    } catch (error) {
      console.error("Signup Branch Manager Error:", error);
      res.status(400).json({ message: `${error.message} (Code: ${error.code || 'Unknown'})` });
    }
  }

  async login(req, res) {
    try {
      const { idToken } = req.body; // Firebase ID Token from frontend
      if (!idToken) {
        return res.status(400).json({ message: 'Firebase ID Token is required' });
      }

      // 1. Verify Firebase Token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid, email } = decodedToken;

      // 2. Find user in MongoDB
      const user = await User.findOne({ firebaseUid: uid });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.status !== 'active') {
        return res.status(403).json({ message: 'Account is not active' });
      }

      // 3. Generate JWT
      const jwtToken = jwtService.sign({ id: user._id, role: user.role });

      res.status(200).json({ user, token: jwtToken });
    } catch (error) {
      res.status(401).json({ message: 'Invalid token', error: error.message });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const link = await admin.auth().generatePasswordResetLink(email);

      console.log(`Password reset link for ${email}: ${link}`);

      res.status(200).json({ message: 'Password reset link generated successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new AuthController();
