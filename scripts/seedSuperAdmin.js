require("dotenv").config();
const mongoose = require("mongoose");
const admin = require("../config/firebase");
const User = require("../models/user.model");

// Load env vars
const MONGO_URI = process.env.MONGO_URI;
const SUPERADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "koutix@gmail.com";
const SUPERADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "koutix@123";
const SUPERADMIN_USERNAME = "Super Admin";

const seedSuperAdmin = async () => {
  try {
    // 1️⃣ Connect DB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 2️⃣ Ensure Firebase user exists
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(SUPERADMIN_EMAIL);
      console.log("ℹ️ Super Admin already exists in Firebase:", userRecord.uid);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        userRecord = await admin.auth().createUser({
          email: SUPERADMIN_EMAIL,
          password: SUPERADMIN_PASSWORD,
          emailVerified: true,
          displayName: SUPERADMIN_USERNAME
        });
        console.log("✅ Super Admin created in Firebase:", userRecord.uid);
      } else {
        throw err;
      }
    }

    // 3️⃣ Ensure MongoDB user exists
    let dbUser = await User.findOne({ firebaseUid: userRecord.uid });
    if (!dbUser) {
      dbUser = await User.create({
        firebaseUid: userRecord.uid,
        email: SUPERADMIN_EMAIL,
        role: "SuperAdmin", 
        displayName: SUPERADMIN_USERNAME,
        status: "active"
      });
      console.log("✅ Super Admin inserted into MongoDB:", dbUser._id);
    } else {
      // Update existing user to ensure status is correct
      if (dbUser.status !== 'active') {
        dbUser.status = 'active';
        await dbUser.save();
        console.log("✅ Updated Super Admin status to 'active'");
      }
      console.log("ℹ️ Super Admin already exists in MongoDB:", dbUser._id);
    }

    console.log("🎉 Seeding complete. You can now login with:");
    console.log(`   Email: ${SUPERADMIN_EMAIL}`);
    console.log(`   Password: ${SUPERADMIN_PASSWORD}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding Super Admin:", err.message);
    process.exit(1);
  }
};

seedSuperAdmin();
