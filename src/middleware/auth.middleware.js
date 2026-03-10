/**
 * @file Firebase token verification middleware.
 * Verifies the Firebase ID token from the Authorization header.
 * Attaches decoded token (uid, role, accountType) to req.user.
 */
const { getAuth } = require("../config/firebase");
const { error } = require("../utils/response");
const logger = require("../utils/logger");

/**
 * Middleware: Verify Firebase ID token.
 * Expects header: Authorization: Bearer <idToken>
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return error(res, {
        statusCode: 401,
        message: "Missing or invalid Authorization header",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return error(res, { statusCode: 401, message: "Token not provided" });
    }

    const decoded = await getAuth().verifyIdToken(idToken);

    // Attach user info from token claims
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role: decoded.role || "customer",
      accountType: decoded.accountType || null,
      chainId: decoded.chainId || null,
      storeId: decoded.storeId || null,
    };

    next();
  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`);
    if (err.code === "auth/id-token-expired") {
      return error(res, {
        statusCode: 401,
        message: "Token expired — please re-authenticate",
      });
    }
    return error(res, { statusCode: 401, message: "Invalid or expired token" });
  }
}

/**
 * Optional auth — sets req.user if token present, but doesn't block.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await getAuth().verifyIdToken(idToken);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role: decoded.role || "customer",
      accountType: decoded.accountType || null,
    };
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { authenticate, optionalAuth };
