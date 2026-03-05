const admin = require('firebase-admin');
const serviceAccountPath = process.env.FIREBASE_CREDENTIALS_PATH;
let serviceAccount;

try {
  serviceAccount = require(serviceAccountPath);
} catch (err) {
  // If absolute path fails, try relative to root config
  try {
     const path = require('path');
     serviceAccount = require(path.join(__dirname, '../../../config/firebase-adminsdk (1).json'));
  } catch (innerErr) {
     console.error('❌ Firebase credentials not found at:', serviceAccountPath);
     throw new Error('Firebase initialization failed: missing credentials JSON');
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
