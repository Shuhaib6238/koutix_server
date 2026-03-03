const admin = require('../config/firebase');

/**
 * verifyFirebaseToken — Step 1 of the middleware stack
 * 
 * Verifies Firebase ID Token and attaches decoded user to req.firebaseUser.
 * This is the PRIMARY auth verification layer.
 */
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!admin.apps.length) {
      return res.status(500).json({ message: 'Internal Server Error: Auth service not available' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);

    // Attach Firebase decoded user data
    req.firebaseUser = decodedToken;

    // Also attach to req.user for downstream compatibility
    req.user = decodedToken;

    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error.message);
    return res.status(403).json({ message: 'Unauthorized: Invalid or expired token' });
  }
};

module.exports = verifyFirebaseToken;
