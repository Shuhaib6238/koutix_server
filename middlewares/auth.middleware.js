const jwtService = require('../services/jwt.service');
const User = require('../models/user.model');
const admin = require('../config/firebase');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    let user;
    // 1. Try verifying as custom server JWT
    const decoded = jwtService.verify(token);
    
    if (decoded && decoded.id) {
      user = await User.findById(decoded.id);
    } else {
      // 2. Fallback: Try verifying as Firebase ID Token
      try {
        const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
        user = await User.findOne({ firebaseUid: decodedFirebaseToken.uid });
      } catch (firebaseError) {
        // If both fail, it's truly an invalid token
        return res.status(401).json({ 
          message: 'Unauthorized: Invalid token', 
          error: 'Token is neither a valid server JWT nor a valid Firebase ID token' 
        });
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    if (user.status != 'active') {
      return res.status(403).json({ message: 'Forbidden: Account is not active' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

module.exports = authMiddleware;
