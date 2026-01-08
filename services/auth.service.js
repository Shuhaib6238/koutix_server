const admin = require('../config/firebase');
const axios = require('axios');
const User = require('../models/user.model');
require('dotenv').config();

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

class AuthService {
  async signup(email, password, displayName) {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }
    
    let userRecord;
    try {
      // 1. Create user in Firebase
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });

      // 2. Create user in MongoDB
      const newUser = new User({
        firebaseUid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
      });

      await newUser.save();

      return userRecord;
    } catch (error) {
      // Rollback: If MongoDB creation fails, delete the Firebase user
      if (userRecord && userRecord.uid) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
          console.log('Rolled back Firebase user creation due to MongoDB error');
        } catch (rollbackError) {
          console.error('Error rolling back Firebase user:', rollbackError);
        }
      }
      throw error;
    }
  }

  async login(email, password) {
    try {
      const response = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
        {
          email,
          password,
          returnSecureToken: true,
        }
      );
      return response.data;
    } catch (error) {
      // Extract meaningful error message from Firebase response
      const errorMessage = error.response?.data?.error?.message || 'Login failed';
      throw new Error(errorMessage);
    }
  }
}

module.exports = new AuthService();
