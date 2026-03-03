const admin = require("../config/firebase");
const User = require("../models/user.model");
const Organization = require("../models/organization.model");
const Branch = require("../models/branch.model");
const stripeService = require("./stripe.service");
const { PLANS } = require("../config/stripe.config");
const mongoose = require("mongoose");

class PartnerService {
  constructor() {
    this.domainWhitelist = ["nesto.ae", "lulucompany.com"];
    this.publicDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "yopmail.com", "icloud.com"];
  }

  async signupChainManager(data) {
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
      posSystem,
      planType = 'basic'
    } = data;

    // 1. Domain Validation
    const domain = email.split("@")[1];
    const allowedDomains = ["nesto.ae", "lulucompany.com", "gmail.com", "outlook.com", "yopmail.com"];
    
    // Domain validation relaxed as per user requirements for testing
    // if (!allowedDomains.includes(domain)) {
    //   throw new Error(`Email domain ${domain} is not authorized for Chain Manager signup.`);
    // }

    if (!admin.apps.length) {
      throw new Error("Firebase Admin not initialized");
    }

    let userRecord;
    try {
      // 2. Create user in Firebase
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
      });

      const userId = new mongoose.Types.ObjectId();

      // 3. Create Organization
      const organization = new Organization({
        name: chainName,
        vat_trn: vatTrn,
        hq_address: hqAddress,
        trade_license: tradeLicense,
        logo_url: logoUrl,
        primary_color: primaryColor,
        expected_branch_count: expectedBranchCount,
        pos_system: posSystem,
      });
      await organization.save();

      // 4. Create User in MongoDB
      const newUser = new User({
        _id: userId,
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: fullName,
        phoneNumber: phone,
        role: "ChainManager",
        status: "active",
        org_id: organization._id
      });
      await newUser.save();
      organization.owner_id = userId;
      await organization.save();

      // 5. Create Stripe Customer and Checkout Session
      let checkoutUrl = null;
      try {
        const stripeCustomer = await stripeService.createCustomer(
          userRecord.email,
          fullName,
          organization._id
        );

        organization.stripeCustomerId = stripeCustomer.id;
        organization.planType = planType;
        await organization.save();

        const planKey = planType.toUpperCase();
        const selectedPlan = PLANS[planKey] || PLANS.BASIC;
        
        const successUrl = `${process.env.FRONTEND_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${process.env.FRONTEND_URL}/subscription-cancel`;

        const session = await stripeService.createCheckoutSession(
          stripeCustomer.id,
          selectedPlan.id,
          successUrl,
          cancelUrl
        );
        checkoutUrl = session.url;
      } catch (stripeError) {
        console.error('⚠️ Stripe Initialization Failed during signup service:', stripeError.message);
      }

      return { user: newUser, organization, checkoutUrl };
    } catch (error) {
      // Rollback
      if (userRecord && userRecord.uid) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
        } catch (rollbackError) {
          console.error("Rollback error:", rollbackError);
        }
      }
      throw error;
    }
  }
  async signupBranchManager(data) {
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
      posSystem,
      planType = 'basic'
    } = data;

    if (!admin.apps.length) {
      throw new Error("Firebase Admin not initialized");
    }

    let userRecord;
    try {
      // 1. Domain-based Auto-linking (Skip for public domains)
      const domain = email.split("@")[1];
      let existingChainManager = null;
      
      if (!this.publicDomains.includes(domain.toLowerCase())) {
        existingChainManager = await User.findOne({
          role: 'ChainManager',
          status: 'active',
          email: { $regex: new RegExp(`@${domain}$`, 'i') }
        });
      }

      let orgId;
      let isNewOrg = false;
      const userId = new mongoose.Types.ObjectId();

      if (existingChainManager && existingChainManager.org_id) {
        console.log(`🔗 Auto-linking Branch Manager to existing chain: ${domain}`);
        orgId = existingChainManager.org_id;
      } else {
        console.log(`🆕 Creating new independent Organization for domain: ${domain}`);
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
        isNewOrg = true;
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
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
      });

      // 4. Create user in MongoDB
      const newUser = new User({
        _id: userId,
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: fullName,
        phoneNumber: phoneNumber,
        role: 'BranchManager',
        org_id: orgId,
        branch_id: branch._id,
        status: 'active'
      });
      await newUser.save();

      // 5. Stripe Integration (Only if it's a new independent organization)
      let checkoutUrl = null;
      let organization = null;
      
      if (isNewOrg) {
        console.log(`💳 Initializing Stripe for new Organization: ${orgId}`);
        organization = await Organization.findById(orgId);
        try {
          const stripeCustomer = await stripeService.createCustomer(
            userRecord.email,
            fullName,
            orgId
          );

          organization.stripeCustomerId = stripeCustomer.id;
          organization.planType = planType;
          await organization.save();

          const planKey = planType.toUpperCase();
          const selectedPlan = PLANS[planKey] || PLANS.BASIC;

          const successUrl = `${process.env.FRONTEND_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`;
          const cancelUrl = `${process.env.FRONTEND_URL}/subscription-cancel`;

          const session = await stripeService.createCheckoutSession(
            stripeCustomer.id,
            selectedPlan.id,
            successUrl,
            cancelUrl
          );
          checkoutUrl = session.url;
        } catch (stripeError) {
          console.error('⚠️ Stripe Initialization Failed for Independent Manager:', stripeError.message);
        }
      }

      return { 
        user: newUser, 
        branch, 
        organization, 
        checkoutUrl,
        isIndependent: isNewOrg 
      };
    } catch (error) {
      if (userRecord && userRecord.uid) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
        } catch (rollbackError) {
          console.error("Rollback error:", rollbackError);
        }
      }
      throw error;
    }
  }
}

module.exports = new PartnerService();
