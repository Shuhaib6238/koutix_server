/**
 * @file Environment variable validation using envalid.
 * Crashes on startup if any required variable is missing.
 * Import this FIRST in server.js before anything else.
 */
const { cleanEnv, str, port, url, num } = require("envalid");

const env = cleanEnv(process.env, {
  // ─── Core ──────────────────────────────────────────────
  NODE_ENV: str({
    choices: ["development", "production", "test"],
    default: "development",
  }),
  PORT: port({ default: 8080 }),

  // ─── MongoDB ───────────────────────────────────────────
  MONGODB_URI: url({ desc: "MongoDB Atlas connection string" }),

  // ─── Redis ─────────────────────────────────────────────
  REDIS_URL: str({
    desc: "Redis (ElastiCache) connection string with TLS",
    default: "",
  }),

  // ─── Firebase Admin SDK ────────────────────────────────
  FIREBASE_PROJECT_ID: str({ desc: "Firebase project ID" }),
  FIREBASE_CLIENT_EMAIL: str({ desc: "Firebase service account email" }),
  FIREBASE_PRIVATE_KEY: str({
    desc: "Firebase private key (with \\n escaped)",
  }),

  // ─── AWS S3 + CloudFront ───────────────────────────────
  AWS_REGION: str({ default: "me-south-1" }),
  AWS_S3_BUCKET: str({ default: "koutix-media-prod" }),
  AWS_ACCESS_KEY_ID: str({ desc: "AWS IAM access key", default: "" }),
  AWS_SECRET_ACCESS_KEY: str({ desc: "AWS IAM secret key", default: "" }),
  CLOUDFRONT_DOMAIN: str({ default: "cdn.koutix.com" }),

  // ─── Stripe ────────────────────────────────────────────
  STRIPE_SECRET_KEY: str({ desc: "Stripe secret API key" }),
  STRIPE_WEBHOOK_SECRET: str({
    desc: "Stripe webhook signing secret",
    default: "",
  }),
  STRIPE_PRICE_CHAIN_STARTER: str({
    desc: "Stripe price ID for chain_starter plan",
    default: "",
  }),
  STRIPE_PRICE_CHAIN_GROWTH: str({
    desc: "Stripe price ID for chain_growth plan",
    default: "",
  }),
  STRIPE_PRICE_CHAIN_ENTERPRISE: str({
    desc: "Stripe price ID for chain_enterprise plan",
    default: "",
  }),
  STRIPE_PRICE_SINGLE_STARTER: str({
    desc: "Stripe price ID for single_starter plan",
    default: "",
  }),
  STRIPE_PRICE_SINGLE_GROWTH: str({
    desc: "Stripe price ID for single_growth plan",
    default: "",
  }),
  STRIPE_PRICE_PROMOTE: str({
    desc: "Stripe price ID for promote addon",
    default: "",
  }),

  // ─── Resend (email) ────────────────────────────────────
  RESEND_API_KEY: str({ desc: "Resend.com API key", default: "" }),
  RESEND_FROM: str({ default: "noreply@koutix.com" }),

  // ─── Security ──────────────────────────────────────────
  ENCRYPTION_KEY: str({
    desc: "32-byte hex key for AES-256-GCM encryption",
    default: "",
  }),
  ALLOWED_ORIGINS: str({ default: "https://admin.koutix.com" }),

  // ─── Frontend URL (for invite links) ──────────────────
  // ─── RASHID ────────────────────────────────────────────
  CHECKOUT_API_URL: str({
    desc: "Checkout.com API URL (sandbox or live)",
    default: "https://api.sandbox.checkout.com",
  }),
});

module.exports = env;
