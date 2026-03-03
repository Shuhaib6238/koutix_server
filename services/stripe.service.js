const { stripe, PLANS } = require('../config/stripe.config');
const Organization = require('../models/organization.model');

class StripeService {
  /**
   * Create a new Stripe customer
   */
  async createCustomer(email, name, orgId) {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { orgId: orgId.toString() }
    });
    return customer;
  }

  /**
   * Create a Checkout Session for a subscription
   */
  async createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: 7,
      },
    });
    return session;
  }

  /**
   * Cancel a subscription
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
    const org = await Organization.findOneAndUpdate(
      { stripeSubscriptionId },
      {
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      { new: true }
    );
    return org;
  }
}

module.exports = new StripeService();
