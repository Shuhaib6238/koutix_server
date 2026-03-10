/**
 * @file Role-based access control middleware.
 * Role is taken from Firebase custom claims via req.user (set by auth middleware).
 * NEVER from request body.
 */
const { error } = require("../utils/response");

/**
 * Require one or more roles for access.
 * @param {...string} allowedRoles - e.g. 'superAdmin', 'chainManager'
 * @returns {import('express').RequestHandler}
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, {
        statusCode: 401,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return error(res, {
        statusCode: 403,
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
      });
    }

    next();
  };
}

module.exports = { requireRole };
