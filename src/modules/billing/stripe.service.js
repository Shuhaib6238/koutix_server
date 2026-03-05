const { stripe, PLANS } = require('../../config/stripe.config');
const Organization = require('../tenants/organization.model');

class StripeService {
  /**
   * Create a new Stripe customer
   */
  async createCustomer(email, name, orgId = null) {
    const metadata = {};
    if (orgId) metadata.orgId = orgId.toString();

    const customer = await stripe.customers.create({
      email,
      name,
      metadata
    });
    return customer;
  }

  /**
   * Create a Checkout Session for a subscription
   * @param {string} customerId - Stripe Customer ID
   * @param {string} priceId - Stripe Price ID
   * @param {string} successUrl - Redirect URL on success
   * @param {string} cancelUrl - Redirect URL on cancel
   * @param {object} metadata - Additional metadata (e.g. { tenantId })
   */
  async createCheckoutSession(customerId, priceId, successUrl, cancelUrl, metadata = {}) {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata,
      subscription_data: {
        trial_period_days: 7,
        metadata: metadata
      },
    });
    return session;
  }

  /**
   * Cancel a subscription (at period end)
   */
  async cancelSubscription(subscriptionId) {
    const deletedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
    return deletedSubscription;
  }

  /**
   * Upgrade or Downgrade a subscription
   */
  async updateSubscriptionPlan(subscriptionId, newPriceId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'always_invoice',
    });
    return updatedSubscription;
  }

  /**
   * Sync subscription status to MongoDB
   */
  async syncSubscriptionStatus(stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    const statusMap = {
      'active': 'ACTIVE',
      'trialing': 'TRIALING',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELED',
      'unpaid': 'UNPAID',
      'incomplete': 'INCOMPLETE'
    };

    const org = await Organization.findOneAndUpdate(
      {
        $or: [
          { 'subscription.stripeSubscriptionId': stripeSubscriptionId },
          { stripeSubscriptionId }
        ]
      },
      {
        'subscription.status': statusMap[subscription.status] || 'PENDING',
        'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000),
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      { new: true }
    );
    return org;
  }

  /**
   * Get all available plans
   */
  getPlans() {
    return Object.entries(PLANS).map(([key, plan]) => ({
      id: key.toLowerCase(),
      stripePriceId: plan.id,
      name: plan.name,
      price: plan.price || null,
      features: plan.features
    }));
  }
}

module.exports = new StripeService();
