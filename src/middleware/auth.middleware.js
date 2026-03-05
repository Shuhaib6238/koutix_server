const jwtService = require('../modules/auth/jwt.service');
const User = require('../modules/users/user.model');
const admin = require('../config/firebase');

/**
 * authMiddleware — Combined verifyToken + attachUser
 * 
 * Middleware Stack Order:
 * 1. verifyFirebaseToken (or server JWT)
 * 2. attachUser (find MongoDB user)
 * 3. checkSubscription (if PARTNER)
 * 4. authorize(roles)
 * 5. tenantGuard
 * 
 * This middleware handles steps 1 + 2:
 * - Tries server JWT first (faster, no network call)
 * - Falls back to Firebase ID Token verification
 * - Loads full user from MongoDB and attaches to req.user
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    let user;

    // 1. Try verifying as custom server JWT (fast path)
    const decoded = jwtService.verify(token);

    if (decoded && decoded.id) {
      user = await User.findById(decoded.id)
        .populate('tenantId')
        .populate('branchId');
    } else {
      // 2. Fallback: Try verifying as Firebase ID Token
      try {
        const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
        user = await User.findOne({ firebaseUid: decodedFirebaseToken.uid })
          .populate('tenantId')
          .populate('branchId');

        // Attach Firebase data for downstream use
        req.firebaseUser = decodedFirebaseToken;
      } catch (firebaseError) {
        return res.status(401).json({
          message: 'Unauthorized: Invalid token',
          error: 'Token is neither a valid server JWT nor a valid Firebase ID token'
        });
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    if (!user.isActive || user.status === 'inactive') {
      return res.status(403).json({ message: 'Forbidden: Account is not active' });
    }

    // Attach full user object to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

module.exports = authMiddleware;
