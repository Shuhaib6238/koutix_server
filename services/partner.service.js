const admin = require("../config/firebase");
const User = require("../models/user.model");
const Organization = require("../models/organization.model");

class PartnerService {
  constructor() {
    this.domainWhitelist = ["nesto.ae", "lulucompany.com"];
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
      posSystem 
    } = data;

    // 1. Domain Validation
    const domain = email.split("@")[1];
    if (!this.domainWhitelist.includes(domain)) {
      throw new Error(`Email domain ${domain} is not authorized for Chain Manager signup.`);
    }

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
        phoneNumber: phone,
      });

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
        owner_id: null, // Will set after User is created
      });
      await organization.save();

      // 4. Create User in MongoDB
      const newUser = new User({
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: fullName,
        phoneNumber: phone,
        role: "ChainManager",
        status: "pending", // Requires SuperAdmin approval
      });
      await newUser.save();

      // 5. Link Organization to User
      organization.owner_id = newUser._id;
      await organization.save();

      return { user: newUser, organization };
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
}

module.exports = new PartnerService();
