const User = require('../models/user.model');
const Invitation = require('../models/invitation.model');
const Branch = require('../models/branch.model');
const Organization = require('../models/organization.model');
const admin = require('../config/firebase');
const jwtService = require('../services/jwt.service');
const stripeService = require('../services/stripe.service');
const { PLANS } = require('../config/stripe.config');
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
      const partnerService = require('../services/partner.service');
      const result = await partnerService.signupChainManager(req.body);

      res.status(201).json({
        message: 'Signup successful. Please complete your subscription to activate all features.',
        user: {
          id: result.user._id,
          email: result.user.email,
          role: result.user.role,
          status: result.user.status
        },
        organization: result.organization,
        checkoutUrl: result.checkoutUrl
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async signupBranchManager(req, res) {
    try {
      const partnerService = require('../services/partner.service');
      const result = await partnerService.signupBranchManager(req.body);

      res.status(201).json({
        message: 'Branch Manager signup successful',
        user: {
          id: result.user._id,
          email: result.user.email,
          role: result.user.role,
          org_id: result.user.org_id,
          branch_id: result.user.branch_id
        },
        branch: result.branch,
        organization: result.organization,
        checkoutUrl: result.checkoutUrl
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
        return res.status(403).json({ message: 'Account is not active. Please contact support.' });
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
