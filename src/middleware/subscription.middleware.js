const Organization = require('../modules/tenants/organization.model');

/**
 * checkSubscription — Step 3 of middleware stack
 * 
 * ONLY applies to PARTNER type users (ChainManager, BranchManager)
 * SuperAdmin and Customer skip this check entirely.
 * 
 * Checks both new nested subscription.status and legacy subscriptionStatus
 */
const checkSubscription = async (req, res, next) => {
  try {
    const user = req.user;

    // Skip subscription check for non-PARTNER users
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // SuperAdmin — no subscription check
    if (user.role === 'SUPER_ADMIN' || user.role === 'SuperAdmin') {
      return next();
    }

    // Customer — no subscription check
    if (user.type === 'CUSTOMER' || user.role === 'CUSTOMER') {
      return next();
    }

    // PARTNER users — check subscription
    const orgId = user.tenantId?._id || user.tenantId || user.org_id;
    if (!orgId) {
      return res.status(403).json({ message: 'No organization linked to this user' });
    }

    // If tenantId was populated, use it directly
    let org;
    if (user.tenantId && typeof user.tenantId === 'object' && user.tenantId.name) {
      org = user.tenantId;
    } else {
      org = await Organization.findById(orgId);
    }

    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    // Check subscription status (support both nested and flat)
    const subStatus = org.subscription?.status || org.subscriptionStatus;
    const allowedStatuses = ['ACTIVE', 'TRIALING', 'active', 'trialing'];

    if (!allowedStatuses.includes(subStatus)) {
      return res.status(402).json({
        message: 'Payment Required: Your subscription is not active',
        subscriptionStatus: subStatus,
        tenantId: org._id
      });
    }

    next();
  } catch (error) {
    console.error('Subscription Check Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

module.exports = checkSubscription;
