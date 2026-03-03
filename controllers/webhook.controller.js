const { stripe, webhookSecret } = require('../config/stripe.config');
const Organization = require('../models/organization.model');

class WebhookController {
  async handle(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error(`❌ Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = event.data.object;

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(session);
        break;
      case 'invoice.payment_succeeded':
        await this.handlePaymentSuccess(session);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailure(session);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(session);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  }

  async handleCheckoutComplete(session) {
    const orgId = session.metadata.orgId;
    await Organization.findByIdAndUpdate(orgId, {
      stripeSubscriptionId: session.subscription,
      subscriptionStatus: 'active'
    });
    console.log(`✅ Subscription started for Org: ${orgId}`);
  }

  async handlePaymentSuccess(invoice) {
    const subscriptionId = invoice.subscription;
    await Organization.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      { 
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(invoice.lines.data[0].period.end * 1000)
      }
    );
  }

  async handlePaymentFailure(invoice) {
    const subscriptionId = invoice.subscription;
    await Organization.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      { subscriptionStatus: 'past_due' }
    );
    console.log(`⚠️ Payment failed for subscription: ${subscriptionId}`);
  }

  async handleSubscriptionDeleted(subscription) {
    await Organization.findOneAndUpdate(
      { stripeSubscriptionId: subscription.id },
      { 
        subscriptionStatus: 'canceled',
        planType: 'none'
      }
    );
    console.log(`❌ Subscription canceled: ${subscription.id}`);
  }
}

module.exports = new WebhookController();
