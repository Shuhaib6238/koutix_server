const admin = require("../config/firebase");
const User = require("../models/user.model");
const Store = require("../models/store.model");
const authService = require("./auth.service");
const jwtService = require("./jwt.service");

class AdminService {
  async signup(storeName, email, password) {
    if (!admin.apps.length) {
      throw new Error("Firebase Admin not initialized");
    }

    let userRecord;
    try {
      // 1. Create user in Firebase
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: storeName, // Using store name as display name initially
      });

      // 2. Create user in MongoDB with 'admin' role
      const newUser = new User({
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: storeName,
        role: "admin",
      });
      await newUser.save();

      // 3. Create Store
      const newStore = new Store({
        storeName: storeName,
        owner: newUser._id,
      });
      await newStore.save();

      return { user: newUser, store: newStore };
    } catch (error) {
      // Rollback: delete Firebase user if Mongo fails
      if (userRecord && userRecord.uid) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
          // Note: If User was saved but Store failed, we should theoretically delete User too.
          // For simplicity/safety, we assume basic rollback here, but ideally we'd use Mongo transactions or cascading delete.
          const user = await User.findOne({ firebaseUid: userRecord.uid });
          if (user) await User.deleteOne({ _id: user._id });
        } catch (rollbackError) {
          console.error("Error rolling back:", rollbackError);
        }
      }
      throw error;
    }
  }

  async login(email, password) {
    // 1. Authenticate with Firebase (reuse auth service)
    const firebaseAuthResponse = await authService.login(email, password);

    // 2. Check mongo user role
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.role !== "admin" && user.role !== "SuperAdmin") {
      throw new Error("Access denied. Admin privileges required.");
    }

    // 3. Get store info
    const store = await Store.findOne({ owner: user._id });

    // 4. Generate custom JWT for internal API authorization
    const token = jwtService.sign({ id: user._id, role: user.role });

    return {
      ...firebaseAuthResponse,
      user,
      store,
      token,
    };
  }
}

module.exports = new AdminService();
