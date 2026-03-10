/**
 * @file Stripe subscription service.
 * @description Creates Stripe customers and subscriptions with 14-day free trial.
 * Stripe is ONLY for Koutix platform subscription fees — NOT customer payments.
 */
const Stripe = require("stripe");
const logger = require("../utils/logger");

let stripe = null;

/**
 * Initialize the Stripe client.
 * @param {string} secretKey - Stripe secret API key
 * @returns {Stripe}
 */
function initStripe(secretKey) {
  stripe = new Stripe(secretKey, {
    apiVersion: "2024-06-20",
  });
  logger.info("✅ Stripe client initialized");
  return stripe;
}

/**
 * Get the Stripe instance.
 * @returns {Stripe}
 */
function getStripe() {
  if (!stripe)
    throw new Error("Stripe not initialized — call initStripe first");
  return stripe;
}

/**
 * Map plan type to Stripe price ID.
 * @param {string} planType - e.g. 'chain_starter', 'single_growth'
 * @returns {string} Stripe price ID
 */
function getPriceId(planType) {
  const env = process.env;
  const map = {
    chain_starter: env.STRIPE_PRICE_CHAIN_STARTER,
    chain_growth: env.STRIPE_PRICE_CHAIN_GROWTH,
    chain_enterprise: env.STRIPE_PRICE_CHAIN_ENTERPRISE,
    single_starter: env.STRIPE_PRICE_SINGLE_STARTER,
    single_growth: env.STRIPE_PRICE_SINGLE_GROWTH,
    promote_addon: env.STRIPE_PRICE_PROMOTE,
  };
  const priceId = map[planType];
  if (!priceId) throw new Error(`Unknown plan type: ${planType}`);
  return priceId;
}

/**
 * Create a Stripe customer.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.name
 * @param {object} [params.metadata]
 * @returns {Promise<Stripe.Customer>}
 */
async function createCustomer({ email, name, metadata = {} }) {
  return stripe.customers.create({
    email,
    name,
    metadata,
  });
}

/**
 * Create a subscription with 14-day free trial.
 * @param {object} params
 * @param {string} params.customerId - Stripe customer ID
 * @param {string} params.planType - e.g. 'chain_starter'
 * @returns {Promise<Stripe.Subscription>}
 */
async function createTrialSubscription({ customerId, planType }) {
  const priceId = getPriceId(planType);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: 14,
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    expand: ["latest_invoice.payment_intent"],
  });

  return subscription;
}

/**
 * Cancel a subscription.
 * @param {string} subscriptionId
 * @returns {Promise<Stripe.Subscription>}
 */
async function cancelSubscription(subscriptionId) {
  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Retrieve a subscription.
 * @param {string} subscriptionId
 * @returns {Promise<Stripe.Subscription>}
 */
async function getSubscription(subscriptionId) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Construct and verify a Stripe webhook event.
 * @param {Buffer} rawBody - Raw request body
 * @param {string} signature - Stripe-Signature header
 * @param {string} webhookSecret - Stripe webhook signing secret
 * @returns {Stripe.Event}
 */
function constructWebhookEvent(rawBody, signature, webhookSecret) {
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

module.exports = {
  initStripe,
  getStripe,
  createCustomer,
  createTrialSubscription,
  cancelSubscription,
  getSubscription,
  constructWebhookEvent,
};
