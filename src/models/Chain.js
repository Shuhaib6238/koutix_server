/**
 * @file Chain Mongoose model.
 * @description Multi-branch chain entity. Owns multiple Stores.
 */
const mongoose = require("mongoose");

const chainSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    /** Firebase UID of the chain manager who owns this chain */
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    primaryColor: {
      type: String,
      default: "#A9ED42",
    },
    /** Logo URL on S3/CloudFront CDN */
    logoUrl: {
      type: String,
      default: null,
    },
    /** POS system type used by the chain */
    posSystem: {
      type: String,
      default: null,
    },
    /** Payment gateway credentials — encrypted secret key */
    payment: {
      gatewayType: {
        type: String,
        enum: ["checkout", "stripe", null],
        default: null,
      },
      /** AES-256-GCM encrypted — NEVER returned in API responses */
      encryptedSecretKey: {
        type: String,
        select: false,
        default: null,
      },
      /** Public key — returned to client for payment UI */
      publicKey: {
        type: String,
        default: null,
      },
    },
    /** Stripe customer ID for subscription billing */
    stripeCustomerId: {
      type: String,
      default: null,
    },
    /** Stripe subscription ID */
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    /** Subscription details */
    subscription: {
      planType: {
        type: String,
        enum: ["chain_starter", "chain_growth", "chain_enterprise", null],
        default: null,
      },
      status: {
        type: String,
        enum: ["active", "trial", "expired", "suspended", null],
        default: null,
      },
      trialEndsAt: {
        type: Date,
        default: null,
      },
      currentPeriodEnd: {
        type: Date,
        default: null,
      },
    },
    /** Whether chain is live and visible to customers */
    isLive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        delete ret.payment?.encryptedSecretKey;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model("Chain", chainSchema);
