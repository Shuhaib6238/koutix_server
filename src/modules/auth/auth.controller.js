const User = require('../users/user.model');
const Organization = require('../tenants/organization.model');
const Branch = require('../branches/branch.model');
const Invitation = require('../users/invitation.model');
const admin = require('../../config/firebase');
const jwtService = require('./jwt.service');
const stripeService = require('../billing/stripe.service');
const { PLANS } = require('../../config/stripe.config');
const mongoose = require('mongoose');

class AuthController {
  // ══════════════════════════════════════════════════════════════
  // 1️⃣  REGISTER TENANT (Supermarket Registration Flow)
  //     Frontend creates Firebase account first, then calls this
  //     POST /auth/register-tenant
  //     Authorization: Bearer <Firebase ID Token>
  //     Body: { supermarketName, country, selectedPlanId }
  // ══════════════════════════════════════════════════════════════
  async registerTenant(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { supermarketName, country, selectedPlanId } = req.body;

      if (!supermarketName || !selectedPlanId) {
        return res.status(400).json({
          message: 'supermarketName and selectedPlanId are required'
        });
      }

      // 1. Verify Firebase Token (already decoded by middleware)
      const decoded = req.firebaseUser;
      if (!decoded) {
        return res.status(401).json({ message: 'Invalid Firebase token' });
      }

      // 2. Check user doesn't already exist
      const existingUser = await User.findOne({ firebaseUid: decoded.uid });
      if (existingUser) {
        return res.status(409).json({ message: 'User already registered' });
      }

      // 3. Resolve plan
      const planKey = selectedPlanId.toUpperCase();
      const selectedPlan = PLANS[planKey];
      if (!selectedPlan) {
        return res.status(400).json({ message: `Invalid plan: ${selectedPlanId}` });
      }

      // 4. Create Stripe Customer
      const stripeCustomer = await stripeService.createCustomer(
        decoded.email,
        supermarketName
      );

      // 5. Create Tenant in MongoDB (PENDING state)
      const tenant = new Organization({
        name: supermarketName,
        country: country || '',
        stripeCustomerId: stripeCustomer.id,
        planType: selectedPlanId, // <-- Added this to set legacy flat field explicitely
        subscription: {
          status: 'PENDING',
          planId: selectedPlanId
        }
      });
      await tenant.save({ session });

      // 6. Create User as CHAIN_MANAGER
      const user = new User({
        firebaseUid: decoded.uid,
        email: decoded.email,
        displayName: decoded.name || supermarketName,
        role: 'CHAIN_MANAGER',
        type: 'PARTNER',
        tenantId: tenant._id,
        org_id: tenant._id,
        isActive: true,
        status: 'active'
      });
      await user.save({ session });

      // Update tenant owner
      tenant.owner_id = user._id;
      await tenant.save({ session });

      // 7. Create Stripe Checkout Session
      const successUrl = `${process.env.FRONTEND_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${process.env.FRONTEND_URL}/subscription-cancel`;

      const checkoutSession = await stripeService.createCheckoutSession(
        stripeCustomer.id,
        selectedPlan.id,
        successUrl,
        cancelUrl,
        { tenantId: tenant._id.toString() }
      );

      await session.commitTransaction();

      // 8. Return Checkout URL
      res.status(201).json({
        message: 'Tenant created. Complete payment to activate.',
        checkoutUrl: checkoutSession.url,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          type: user.type
        },
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subscription: tenant.subscription
        }
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Register Tenant Error:', error);
      res.status(400).json({ message: error.message });
    } finally {
      session.endSession();
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 2️⃣  LOGIN — GET /auth/me
  //     For Chain Manager, Branch Manager, Super Admin
  //     Authorization: Bearer <Firebase ID Token>
  // ══════════════════════════════════════════════════════════════
  async me(req, res) {
    try {
      // Decode Firebase Token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      let decodedToken;

      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (firebaseErr) {
        // Fallback: try server JWT
        const jwtDecoded = jwtService.verify(token);
        if (jwtDecoded && jwtDecoded.id) {
          const user = await User.findById(jwtDecoded.id).populate('tenantId').populate('branchId');
          if (!user) {
            return res.status(404).json({ message: 'User not found' });
          }
          const tenant = user.tenantId;
          const serverJwt = jwtService.sign({ id: user._id, role: user.role });
          return res.status(200).json({
            user,
            tenant: tenant || null,
            role: user.role,
            branchId: user.branchId || user.branch_id || null,
            token: serverJwt
          });
        }
        return res.status(401).json({ message: 'Invalid token' });
      }

      const { uid } = decodedToken;

      // Find user in MongoDB
      const user = await User.findOne({ firebaseUid: uid })
        .populate('tenantId')
        .populate('branchId');

      if (!user) {
        return res.status(404).json({ message: 'User not found. Please register first.' });
      }

      if (!user.isActive || user.status === 'inactive') {
        return res.status(403).json({ message: 'Account is deactivated. Contact support.' });
      }

      // Load tenant
      const tenant = user.tenantId; // populated

      // Check subscription for PARTNER users (not for SUPER_ADMIN or CUSTOMER)
      if (user.type === 'PARTNER' && user.role !== 'SUPER_ADMIN') {
        if (!tenant) {
          return res.status(403).json({ message: 'No organization linked to this user' });
        }

        const subStatus = tenant.subscription?.status || tenant.subscriptionStatus;
        const allowedStatuses = ['ACTIVE', 'TRIALING', 'active', 'trialing'];

        if (!allowedStatuses.includes(subStatus)) {
          return res.status(402).json({
            message: 'Subscription inactive. Please complete payment.',
            subscriptionStatus: subStatus,
            tenantId: tenant._id
          });
        }
      }

      // Generate server JWT for subsequent API calls
      const serverJwt = jwtService.sign({ id: user._id, role: user.role });

      res.status(200).json({
        user,
        tenant: tenant || null,
        role: user.role,
        branchId: user.branchId || user.branch_id || null,
        token: serverJwt
      });
    } catch (error) {
      console.error('Auth /me Error:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 3️⃣  LOGIN (Legacy — kept for backward compat)
  //     POST /auth/login
  //     Body: { idToken }
  // ══════════════════════════════════════════════════════════════
  async login(req, res) {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return res.status(400).json({ message: 'Firebase ID Token is required' });
      }

      // 1. Verify Firebase Token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid } = decodedToken;

      // 2. Find user in MongoDB
      const user = await User.findOne({ firebaseUid: uid })
        .populate('tenantId')
        .populate('branchId');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.isActive || user.status === 'inactive') {
        return res.status(403).json({ message: 'Account is not active. Please contact support.' });
      }

      // 3. Check subscription for PARTNER type
      const tenant = user.tenantId;
      if (user.type === 'PARTNER' && user.role !== 'SUPER_ADMIN') {
        if (tenant) {
          const subStatus = tenant.subscription?.status || tenant.subscriptionStatus;
          const allowedStatuses = ['ACTIVE', 'TRIALING', 'active', 'trialing'];
          if (!allowedStatuses.includes(subStatus)) {
            return res.status(402).json({
              message: 'Subscription inactive. Please complete payment.',
              subscriptionStatus: subStatus
            });
          }
        }
      }

      // 4. Generate server JWT
      const jwtToken = jwtService.sign({ id: user._id, role: user.role });

      res.status(200).json({ user, tenant, token: jwtToken, role: user.role });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(401).json({ message: 'Invalid token', error: error.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 4️⃣  CUSTOMER SYNC
  //     POST /auth/customer-sync
  //     Authorization: Bearer <Firebase ID Token>
  //     Auto-creates CUSTOMER user if not exists
  // ══════════════════════════════════════════════════════════════
  async customerSync(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const { uid, email, name, phone_number } = decodedToken;

      // Check if user already exists
      let user = await User.findOne({ firebaseUid: uid });

      if (!user) {
        // Create new CUSTOMER user
        user = new User({
          firebaseUid: uid,
          email: email || `customer_${uid}@koutix.app`,
          displayName: name || 'Customer',
          phoneNumber: phone_number || null,
          role: 'CUSTOMER',
          type: 'CUSTOMER',
          tenantId: null,
          isActive: true,
          status: 'active'
        });
        await user.save();
      }

      // Generate server JWT
      const jwtToken = jwtService.sign({ id: user._id, role: user.role });

      res.status(200).json({ user, token: jwtToken });
    } catch (error) {
      console.error('Customer Sync Error:', error);
      res.status(400).json({ message: error.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 5️⃣  CREATE BRANCH MANAGER (by Chain Manager)
  //     POST /auth/create-branch-manager
  //     Only CHAIN_MANAGER can do this (uses Admin SDK)
  // ══════════════════════════════════════════════════════════════
  async createBranchManager(req, res) {
    try {
      const { email, password, displayName, branchId } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Ensure caller is a CHAIN_MANAGER
      const callerUser = req.user;
      if (!callerUser || callerUser.role !== 'CHAIN_MANAGER') {
        return res.status(403).json({ message: 'Only Chain Managers can create Branch Managers' });
      }

      // Create Firebase user via Admin SDK
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: displayName || email
      });

      // Create user in MongoDB
      const newUser = new User({
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: displayName || email,
        role: 'BRANCH_MANAGER',
        type: 'PARTNER',
        tenantId: callerUser.tenantId || callerUser.org_id,
        branchId: branchId || null,
        isActive: true,
        status: 'active'
      });
      await newUser.save();

      // Link to branch if provided
      if (branchId) {
        await Branch.findByIdAndUpdate(branchId, { manager_id: newUser._id });
      }

      res.status(201).json({
        message: 'Branch Manager created successfully',
        user: {
          id: newUser._id,
          email: newUser.email,
          role: newUser.role,
          tenantId: newUser.tenantId,
          branchId: newUser.branchId
        }
      });
    } catch (error) {
      console.error('Create Branch Manager Error:', error);
      res.status(400).json({ message: error.message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // LEGACY FLOWS (kept for backward compat)
  // ══════════════════════════════════════════════════════════════

  async signupChainManager(req, res) {
    try {
      const partnerService = require('../admin/partner.service');
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
      const partnerService = require('../admin/partner.service');
      const result = await partnerService.signupBranchManager(req.body);

      res.status(201).json({
        message: 'Branch Manager signup successful',
        user: {
          id: result.user._id,
          email: result.user.email,
          role: result.user.role,
          tenantId: result.user.tenantId || result.user.org_id,
          branchId: result.user.branchId || result.user.branch_id
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

      // Create Firebase user
      const userRecord = await admin.auth().createUser({
        email: invitation.email,
        password,
        displayName,
      });

      // Map legacy role to new role
      const roleMap = {
        'ChainManager': 'CHAIN_MANAGER',
        'BranchManager': 'BRANCH_MANAGER',
        'CHAIN_MANAGER': 'CHAIN_MANAGER',
        'BRANCH_MANAGER': 'BRANCH_MANAGER'
      };

      const user = new User({
        firebaseUid: userRecord.uid,
        email: invitation.email,
        displayName: displayName || invitation.email,
        role: roleMap[invitation.role] || invitation.role,
        type: 'PARTNER',
        tenantId: invitation.org_id,
        org_id: invitation.org_id,
        branchId: invitation.branch_id,
        branch_id: invitation.branch_id,
        isActive: true,
        status: 'active'
      });
      await user.save();

      // Update branch manager if role is BranchManager
      if (invitation.role === 'BranchManager' || invitation.role === 'BRANCH_MANAGER') {
        await Branch.findByIdAndUpdate(invitation.branch_id, { manager_id: user._id });
      }

      // Mark invitation as accepted
      invitation.status = 'accepted';
      await invitation.save();

      // Generate JWT
      const jwtToken = jwtService.sign({ id: user._id, role: user.role });

      res.status(201).json({ message: 'Onboarding complete', user, token: jwtToken });
    } catch (error) {
      res.status(400).json({ message: error.message });
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
