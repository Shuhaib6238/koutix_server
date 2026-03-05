/**
 * authorize(roles) — Step 4 of middleware stack
 * 
 * Checks if the authenticated user has one of the allowed roles.
 * Supports both new (UPPER_CASE) and legacy (PascalCase) role formats.
 */
const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Normalize roles for comparison — support both old and new format
    const roleMap = {
      'SuperAdmin': 'SUPER_ADMIN',
      'ChainManager': 'CHAIN_MANAGER',
      'BranchManager': 'BRANCH_MANAGER',
      'user': 'CUSTOMER',
      'SUPER_ADMIN': 'SUPER_ADMIN',
      'CHAIN_MANAGER': 'CHAIN_MANAGER',
      'BRANCH_MANAGER': 'BRANCH_MANAGER',
      'CUSTOMER': 'CUSTOMER'
    };

    const userNormalizedRole = roleMap[req.user.role] || req.user.role;
    const normalizedAllowed = roles.map(r => roleMap[r] || r);

    if (!normalizedAllowed.includes(userNormalizedRole) && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

module.exports = roleMiddleware;
