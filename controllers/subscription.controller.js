const stripeService = require('../services/stripe.service');
const { PLANS } = require('../config/stripe.config');
const Organization = require('../models/organization.model');

class SubscriptionController {
  /**
   * Initialize subscription (Create Checkout Session)
   */
  async createSession(req, res) {
    try {
      const { planType } = req.body;
      const orgId = req.user.org_id;

      if (!['basic', 'premium'].includes(planType)) {
        return res.status(400).json({ message: 'Invalid plan type' });
      }

      const org = await Organization.findById(orgId);
      if (!org) return res.status(404).json({ message: 'Organization not found' });

      // 1. Create or get Stripe Customer
      if (!org.stripeCustomerId) {
        const customer = await stripeService.createCustomer(req.user.email, org.name, org._id);
        org.stripeCustomerId = customer.id;
        await org.save();
      }

      // 2. Create Checkout Session
      const priceId = PLANS[planType.toUpperCase()].id;
      const session = await stripeService.createCheckoutSession(
        org.stripeCustomerId,
        priceId,
        `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        `${process.env.FRONTEND_URL}/subscription/cancel`
      );

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
      const org = await Organization.findById(req.user.org_id);
      if (!org.stripeSubscriptionId) {
        return res.status(400).json({ message: 'No active subscription found' });
      }

      await stripeService.cancelSubscription(org.stripeSubscriptionId);
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
      const org = await Organization.findById(req.user.org_id);

      if (!org?.stripeSubscriptionId) {
        return res.status(400).json({ message: 'No active subscription found to change.' });
      }

      const planKey = newPlanType.toUpperCase();
      const selectedPlan = PLANS[planKey];

      if (!selectedPlan) {
        return res.status(400).json({ message: 'Invalid plan type selected.' });
      }

      const subscription = await stripeService.updateSubscriptionPlan(
        org.stripeSubscriptionId,
        selectedPlan.id
      );

      org.planType = newPlanType;
      await org.save();

      res.status(200).json({ message: `Successfully changed to ${newPlanType} plan.`, subscription });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new SubscriptionController();
