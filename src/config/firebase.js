/**
 * @file Firebase Admin SDK initialization from environment variables.
 * No JSON file path — credentials come from FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY env vars.
 */
const admin = require("firebase-admin");
const logger = require("../utils/logger");

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK.
 * @param {object} params
 * @param {string} params.projectId
 * @param {string} params.clientEmail
 * @param {string} params.privateKey - PEM key with escaped \\n
 * @returns {admin.app.App}
 */
function initFirebase({ projectId, clientEmail, privateKey }) {
  if (firebaseApp) return firebaseApp;

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // Replace escaped newlines with actual newlines
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
    logger.info("✅ Firebase Admin SDK initialized");
    return firebaseApp;
  } catch (err) {
    logger.error(`❌ Firebase init failed: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Get the Firebase Admin Auth instance.
 * @returns {admin.auth.Auth}
 */
function getAuth() {
  return admin.auth();
}

/**
 * Get the Firebase Admin Messaging instance (for FCM push).
 * @returns {admin.messaging.Messaging}
 */
function getMessaging() {
  return admin.messaging();
}

module.exports = { initFirebase, getAuth, getMessaging };
