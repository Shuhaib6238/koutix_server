const Organization = require('../models/organization.model');

const checkSubscription = async (req, res, next) => {
  try {
    const orgId = req.user.org_id;
    if (!orgId) {
      return res.status(403).json({ message: 'No organization linked to this user' });
    }

    const org = await Organization.findById(orgId);
    
    // Allow trials and active status
    const allowedStatuses = ['active', 'trialing'];
    
    if (!allowedStatuses.includes(org.subscriptionStatus)) {
      return res.status(402).json({ 
        message: 'Payment Required: Your subscription is not active',
        status: org.subscriptionStatus 
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

module.exports = checkSubscription;
