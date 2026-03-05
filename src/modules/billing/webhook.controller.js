const { stripe, webhookSecret } = require('../../config/stripe.config');
const Organization = require('../tenants/organization.model');

class WebhookController {
  async handle(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error(`❌ Webhook Signature Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const data = event.data.object;
    console.log(`📩 Webhook received: ${event.type}`);

    try {
      switch (event.type) {
        // ═══════════════════════════════════════════════════
        // CHECKOUT COMPLETED — user finished Stripe checkout
        // ═══════════════════════════════════════════════════
        case 'checkout.session.completed':
          await this.handleCheckoutComplete(data);
          break;

        // ═══════════════════════════════════════════════════
        // SUBSCRIPTION CREATED — Stripe creates the subscription
        // ═══════════════════════════════════════════════════
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(data);
          break;

        // ═══════════════════════════════════════════════════
        // INVOICE PAID — recurring payment succeeded
        // This is the MOST IMPORTANT event for activation
        // ═══════════════════════════════════════════════════
        case 'invoice.paid':
          await this.handleInvoicePaid(data);
          break;

        // ═══════════════════════════════════════════════════
        // INVOICE PAYMENT SUCCEEDED (legacy support)
        // ═══════════════════════════════════════════════════
        case 'invoice.payment_succeeded':
          await this.handlePaymentSuccess(data);
          break;

        // ═══════════════════════════════════════════════════
        // INVOICE PAYMENT FAILED
        // ═══════════════════════════════════════════════════
        case 'invoice.payment_failed':
          await this.handlePaymentFailure(data);
          break;

        // ═══════════════════════════════════════════════════
        // SUBSCRIPTION UPDATED (plan change, etc)
        // ═══════════════════════════════════════════════════
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(data);
          break;

        // ═══════════════════════════════════════════════════
        // SUBSCRIPTION DELETED (canceled)
        // ═══════════════════════════════════════════════════
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(data);
          break;

        default:
          console.log(`⏭️ Unhandled event type: ${event.type}`);
      }
    } catch (handlerError) {
      console.error(`❌ Webhook Handler Error for ${event.type}:`, handlerError);
    }

    res.json({ received: true });
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER: checkout.session.completed
  // ═══════════════════════════════════════════════════════════
  async handleCheckoutComplete(session) {
    console.log('🔄 Processing checkout.session.completed...');

    // Find tenant by Stripe customer ID or metadata
    const customerId = session.customer;
    const tenantIdFromMeta = session.metadata?.tenantId;

    let tenant;
    if (tenantIdFromMeta) {
      tenant = await Organization.findById(tenantIdFromMeta);
    }
    if (!tenant && customerId) {
      tenant = await Organization.findOne({ stripeCustomerId: customerId });
    }

    if (!tenant) {
      console.error('❌ No tenant found for checkout session:', session.id);
      return;
    }

    // Update subscription ID if available
    if (session.subscription) {
      tenant.subscription.stripeSubscriptionId = session.subscription;
      tenant.stripeSubscriptionId = session.subscription;
    }

    // Mark as ACTIVE (payment confirmed via checkout)
    tenant.subscription.status = 'ACTIVE';
    tenant.subscriptionStatus = 'active';

    await tenant.save();
    console.log(`✅ Checkout complete → Tenant ACTIVATED: ${tenant.name} (${tenant._id})`);
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER: customer.subscription.created
  // ═══════════════════════════════════════════════════════════
  async handleSubscriptionCreated(subscription) {
    console.log('🔄 Processing customer.subscription.created...');

    const tenant = await Organization.findOne({
      stripeCustomerId: subscription.customer
    });

    if (!tenant) {
      console.error('❌ No tenant found for customer:', subscription.customer);
      return;
    }

    // Update subscription details
    tenant.subscription.stripeSubscriptionId = subscription.id;
    tenant.subscription.status = this.mapStripeStatus(subscription.status);
    tenant.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Sync legacy fields
    tenant.stripeSubscriptionId = subscription.id;
    tenant.subscriptionStatus = subscription.status;
    tenant.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await tenant.save();
    console.log(`✅ Subscription created for: ${tenant.name} → Status: ${subscription.status}`);
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER: invoice.paid (🚨 CRITICAL — activates tenant)
  // ═══════════════════════════════════════════════════════════
  async handleInvoicePaid(invoice) {
    console.log('🔄 Processing invoice.paid (CRITICAL)...');

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      console.log('⏭️ Invoice not linked to a subscription, skipping');
      return;
    }

    const tenant = await Organization.findOne({
      $or: [
        { 'subscription.stripeSubscriptionId': subscriptionId },
        { stripeSubscriptionId: subscriptionId },
        { stripeCustomerId: invoice.customer }
      ]
    });

    if (!tenant) {
      console.error('❌ No tenant found for invoice:', invoice.id);
      return;
    }

    // 🚨 THIS IS WHERE THE MAGIC HAPPENS — activate the tenant
    tenant.subscription.status = 'ACTIVE';
    tenant.subscription.stripeSubscriptionId = subscriptionId;

    if (invoice.lines?.data?.[0]?.period?.end) {
      tenant.subscription.currentPeriodEnd = new Date(invoice.lines.data[0].period.end * 1000);
    }

    // Sync legacy
    tenant.subscriptionStatus = 'active';
    tenant.stripeSubscriptionId = subscriptionId;
    if (invoice.lines?.data?.[0]?.period?.end) {
      tenant.currentPeriodEnd = new Date(invoice.lines.data[0].period.end * 1000);
    }

    await tenant.save();
    console.log(`✅ Invoice PAID → Tenant ACTIVATED: ${tenant.name} (${tenant._id})`);
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER: invoice.payment_succeeded (legacy)
  // ═══════════════════════════════════════════════════════════
  async handlePaymentSuccess(invoice) {
    console.log('🔄 Processing invoice.payment_succeeded...');

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const tenant = await Organization.findOne({
      $or: [
        { 'subscription.stripeSubscriptionId': subscriptionId },
        { stripeSubscriptionId: subscriptionId }
      ]
    });

    if (!tenant) return;

    tenant.subscription.status = 'ACTIVE';
    tenant.subscriptionStatus = 'active';

    if (invoice.lines?.data?.[0]?.period?.end) {
      const periodEnd = new Date(invoice.lines.data[0].period.end * 1000);
      tenant.subscription.currentPeriodEnd = periodEnd;
      tenant.currentPeriodEnd = periodEnd;
    }

    await tenant.save();
    console.log(`✅ Payment succeeded for: ${tenant.name}`);
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER: invoice.payment_failed
  // ═══════════════════════════════════════════════════════════
  async handlePaymentFailure(invoice) {
    console.log('⚠️ Processing invoice.payment_failed...');

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const tenant = await Organization.findOne({
      $or: [
        { 'subscription.stripeSubscriptionId': subscriptionId },
        { stripeSubscriptionId: subscriptionId }
      ]
    });

    if (!tenant) return;

    tenant.subscription.status = 'PAST_DUE';
    tenant.subscriptionStatus = 'past_due';
    await tenant.save();

    console.log(`⚠️ Payment FAILED for: ${tenant.name} (${subscriptionId})`);
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER: customer.subscription.updated
  // ═══════════════════════════════════════════════════════════
  async handleSubscriptionUpdated(subscription) {
    console.log('🔄 Processing customer.subscription.updated...');

    const tenant = await Organization.findOne({
      $or: [
        { 'subscription.stripeSubscriptionId': subscription.id },
        { stripeSubscriptionId: subscription.id }
      ]
    });

    if (!tenant) return;

    tenant.subscription.status = this.mapStripeStatus(subscription.status);
    tenant.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    tenant.subscriptionStatus = subscription.status;
    tenant.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await tenant.save();
    console.log(`🔄 Subscription updated for: ${tenant.name} → ${subscription.status}`);
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER: customer.subscription.deleted
  // ═══════════════════════════════════════════════════════════
  async handleSubscriptionDeleted(subscription) {
    console.log('❌ Processing customer.subscription.deleted...');

    const tenant = await Organization.findOne({
      $or: [
        { 'subscription.stripeSubscriptionId': subscription.id },
        { stripeSubscriptionId: subscription.id }
      ]
    });

    if (!tenant) return;

    tenant.subscription.status = 'CANCELED';
    tenant.subscriptionStatus = 'canceled';
    tenant.planType = 'none';

    await tenant.save();
    console.log(`❌ Subscription CANCELED for: ${tenant.name}`);
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER: Map Stripe status to our enum
  // ═══════════════════════════════════════════════════════════
  mapStripeStatus(stripeStatus) {
    const statusMap = {
      'active': 'ACTIVE',
      'trialing': 'TRIALING',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELED',
      'unpaid': 'UNPAID',
      'incomplete': 'INCOMPLETE'
    };
    return statusMap[stripeStatus] || 'PENDING';
  }
}

module.exports = new WebhookController();
