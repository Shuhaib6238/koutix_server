const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const serviceAccountPath = process.env.FIREBASE_CREDENTIALS_PATH;

try {
  // Check if service account file exists or if we are in a dev environment without it
  // For now, we'll try to require it, but handle the error gracefully
  const serviceAccount = require(path.resolve(serviceAccountPath));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.warn('Firebase Admin initialization failed. Make sure FIREBASE_CREDENTIALS_PATH is correct and the file exists.');
  console.warn('Error:', error.message);
  // Initialize with default credentials (e.g. for Google Cloud environment) or mock for dev if needed
  // admin.initializeApp(); 
}

module.exports = admin;
