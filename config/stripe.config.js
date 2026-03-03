require('dotenv').config();
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️ STRIPE_SECRET_KEY is missing in .env');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  BASIC: {
    id: process.env.STRIPE_PLAN_BASIC_ID || 'price_basic_placeholder',
    name: 'Basic',
    price: '$29/mo',
    features: ['1 Branch', 'Inventory Sync', 'Basic Reports']
  },
  STANDARD: {
    id: process.env.STRIPE_PLAN_STANDARD_ID || 'price_standard_placeholder',
    name: 'Standard',
    price: '$79/mo',
    features: ['Up to 5 Branches', 'Inventory Sync', 'Detailed Reports', 'Email Support']
  },
  PREMIUM: {
    id: process.env.STRIPE_PLAN_PREMIUM_ID || 'price_premium_placeholder',
    name: 'Premium',
    price: '$149/mo',
    features: ['Unlimited Branches', 'Full SAP Integration', 'Advanced Analytics', 'Priority Support']
  },
  ENTERPRISE: {
    id: process.env.STRIPE_PLAN_ENTERPRISE_ID || 'price_enterprise_placeholder',
    name: 'Enterprise',
    price: 'Custom',
    features: ['Custom Solutions', 'Dedicated Manager', 'On-premise Options', '24/7 Support', 'SLA Guarantee']
  }
};

module.exports = {
  stripe,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  PLANS
};
