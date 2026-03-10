/**
 * @file Webhook controller — Stripe webhook event handler.
 * @description Handles subscription lifecycle, invoice events, and promote addon.
 */
const { constructWebhookEvent } = require("../services/stripe.service");
const Store = require("../models/Store");
const Chain = require("../models/Chain");
const { success, error } = require("../utils/response");
const logger = require("../utils/logger");

/**
 * POST /webhooks/stripe
 * Uses express.raw() body — must be mounted BEFORE express.json()
 */
async function handleStripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = constructWebhookEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error(
      `Stripe webhook signature verification failed: ${err.message}`,
    );
    return res
      .status(400)
      .json({ error: "Webhook signature verification failed" });
  }

  logger.info(`📩 Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      // ─── Subscription Deleted ──────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      // ─── Subscription Updated ──────────────────────────
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      // ─── Invoice Payment Succeeded ─────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        await handlePaymentSucceeded(invoice);
        break;
      }

      // ─── Invoice Payment Failed ────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }

      // ─── Checkout Session Completed (Promote Addon) ────
      case "checkout.session.completed": {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }

      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (err) {
    logger.error(`Error processing webhook ${event.type}: ${err.message}`);
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
}

// ─── Event Handlers ─────────────────────────────────────

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  // Check chains first
  const chain = await Chain.findOne({ stripeCustomerId: customerId });
  if (chain) {
    chain.subscription.status = "expired";
    await chain.save();
    logger.info(`Chain ${chain.name} subscription expired`);
    return;
  }

  // Check stores
  const store = await Store.findOne({ stripeCustomerId: customerId });
  if (store) {
    store.subscription.status = "expired";
    await store.save();
    logger.info(`Store ${store.name} subscription expired`);
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const update = {
    "subscription.status":
      subscription.status === "trialing"
        ? "trial"
        : subscription.status === "active"
          ? "active"
          : "suspended",
    "subscription.currentPeriodEnd": new Date(
      subscription.current_period_end * 1000,
    ),
  };

  if (subscription.trial_end) {
    update["subscription.trialEndsAt"] = new Date(
      subscription.trial_end * 1000,
    );
  }

  const chain = await Chain.findOneAndUpdate(
    { stripeCustomerId: customerId },
    { $set: update },
  );
  if (!chain) {
    await Store.findOneAndUpdate(
      { stripeCustomerId: customerId },
      { $set: update },
    );
  }
}

async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const update = { "subscription.status": "active" };

  const chain = await Chain.findOneAndUpdate(
    { stripeCustomerId: customerId },
    { $set: update },
  );
  if (!chain) {
    await Store.findOneAndUpdate(
      { stripeCustomerId: customerId },
      { $set: update },
    );
  }
  logger.info(`Payment succeeded for customer ${customerId}`);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  logger.warn(`Payment failed for customer ${customerId}`);

  const update = { "subscription.status": "suspended" };
  const chain = await Chain.findOneAndUpdate(
    { stripeCustomerId: customerId },
    { $set: update },
  );
  if (!chain) {
    await Store.findOneAndUpdate(
      { stripeCustomerId: customerId },
      { $set: update },
    );
  }
}

/**
 * checkout.session.completed — Handle promote addon purchase.
 * Sets Store.isPromoted = true and Store.promotionExpiresAt.
 */
async function handleCheckoutCompleted(session) {
  const storeId = session.metadata?.storeId;
  const isPromote = session.metadata?.type === "promote_addon";

  if (isPromote && storeId) {
    await Store.findByIdAndUpdate(storeId, {
      isPromoted: true,
      promotionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });
    logger.info(`Store ${storeId} promoted for 30 days`);
  }
}

module.exports = { handleStripeWebhook };
