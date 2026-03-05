const stripeService = require('./stripe.service');
const { PLANS } = require('../../config/stripe.config');
const Organization = require('../tenants/organization.model');

class SubscriptionController {
  /**
   * GET /subscription/plans
   * Public — returns available subscription plans
   */
  async getPlans(req, res) {
    try {
      const plans = stripeService.getPlans();
      res.status(200).json({ plans });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Initialize subscription (Create Checkout Session)
   */
  async createSession(req, res) {
    try {
      const { planType } = req.body;
      const orgId = req.user.tenantId?._id || req.user.tenantId || req.user.org_id;

      const planKey = (planType || 'basic').toUpperCase();
      const selectedPlan = PLANS[planKey];

      if (!selectedPlan) {
        return res.status(400).json({ message: 'Invalid plan type' });
      }

      const org = await Organization.findById(orgId);
      if (!org) return res.status(404).json({ message: 'Organization not found' });

      // Create or get Stripe Customer
      if (!org.stripeCustomerId) {
        const customer = await stripeService.createCustomer(req.user.email, org.name, org._id);
        org.stripeCustomerId = customer.id;
        await org.save();
      }

      // Create Checkout Session with tenant metadata
      const session = await stripeService.createCheckoutSession(
        org.stripeCustomerId,
        selectedPlan.id,
        `${process.env.FRONTEND_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        `${process.env.FRONTEND_URL}/subscription-cancel`,
        { tenantId: org._id.toString() }
      );

      // Update plan in subscription
      org.subscription.planId = planType;
      org.subscription.status = org.subscription.status === 'NONE' ? 'PENDING' : org.subscription.status;
      org.planType = planType;
      await org.save();

      res.status(200).json({ url: session.url });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Cancel subscription
   */
  async cancel(req, res) {
    try {
      const orgId = req.user.tenantId?._id || req.user.tenantId || req.user.org_id;
      const org = await Organization.findById(orgId);

      const subId = org?.subscription?.stripeSubscriptionId || org?.stripeSubscriptionId;
      if (!subId) {
        return res.status(400).json({ message: 'No active subscription found' });
      }

      await stripeService.cancelSubscription(subId);
      res.status(200).json({ message: 'Subscription will be canceled at the end of the period' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Upgrade/Downgrade plan
   */
  async changePlan(req, res) {
    try {
      const { newPlanType } = req.body;
      const orgId = req.user.tenantId?._id || req.user.tenantId || req.user.org_id;
      const org = await Organization.findById(orgId);

      const subId = org?.subscription?.stripeSubscriptionId || org?.stripeSubscriptionId;
      if (!subId) {
        return res.status(400).json({ message: 'No active subscription found to change.' });
      }

      const planKey = newPlanType.toUpperCase();
      const selectedPlan = PLANS[planKey];

      if (!selectedPlan) {
        return res.status(400).json({ message: 'Invalid plan type selected.' });
      }

      const subscription = await stripeService.updateSubscriptionPlan(subId, selectedPlan.id);

      org.subscription.planId = newPlanType;
      org.planType = newPlanType;
      await org.save();

      res.status(200).json({ message: `Successfully changed to ${newPlanType} plan.`, subscription });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new SubscriptionController();
