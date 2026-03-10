/**
 * @file Store Mongoose model.
 * @description Individual supermarket store — standalone or part of a Chain.
 */
const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    /** Null for standalone stores, ObjectId for chain branches */
    chainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chain",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      default: null,
    },
    /** GeoJSON Point for geospatial queries (2dsphere) */
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    managerName: {
      type: String,
      default: null,
    },
    managerEmail: {
      type: String,
      default: null,
    },
    managerPhone: {
      type: String,
      default: null,
    },
    /** Cover image on S3/CloudFront CDN */
    coverImage: {
      type: String,
      default: null,
    },
    primaryColor: {
      type: String,
      default: "#A9ED42",
    },
    /** Logo on S3/CloudFront CDN */
    logoUrl: {
      type: String,
      default: null,
    },
    /** chain or standalone */
    accountType: {
      type: String,
      enum: ["chain", "standalone"],
      default: "standalone",
    },
    /** Payment gateway — each store can have its own credentials */
    payment: {
      gatewayType: {
        type: String,
        enum: ["checkout", "stripe", null],
        default: null,
      },
      /** AES-256-GCM encrypted — NEVER returned in responses */
      encryptedSecretKey: {
        type: String,
        select: false,
        default: null,
      },
      /** Public key — returned to Flutter for payment UI */
      publicKey: {
        type: String,
        default: null,
      },
    },
    /** Stripe subscription billing (for standalone stores) */
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    subscription: {
      planType: {
        type: String,
        enum: ["single_starter", "single_growth", "promote_addon", null],
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
    /** Promoted store — appears in carousel */
    isPromoted: {
      type: Boolean,
      default: false,
    },
    promotionExpiresAt: {
      type: Date,
      default: null,
    },
    /** Operating hours */
    operatingHours: [
      {
        day: { type: String }, // Monday, Tuesday, etc.
        open: { type: String }, // "09:00"
        close: { type: String }, // "22:00"
      },
    ],
    /** POS configuration */
    pos: {
      type: {
        type: String,
        enum: [
          "cegid",
          "openbravo",
          "odoo",
          "lightspeed",
          "sap",
          "oracle",
          "manual",
          null,
        ],
        default: null,
      },
      apiUrl: { type: String, default: null },
      encryptedApiKey: { type: String, select: false, default: null },
      lastSyncAt: { type: Date, default: null },
      syncStatus: {
        type: String,
        enum: ["synced", "syncing", "error", "never", null],
        default: "never",
      },
    },
    /** Store status */
    status: {
      type: String,
      enum: ["active", "pending_setup", "deactivated"],
      default: "pending_setup",
    },
    /** Whether store is live and visible to customers */
    isLive: {
      type: Boolean,
      default: false,
    },
    /** Whether store is approved by admin */
    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        if (ret.payment) {
          delete ret.payment.encryptedSecretKey;
        }
        if (ret.pos) {
          delete ret.pos.encryptedApiKey;
        }
        return ret;
      },
    },
  },
);

// 2dsphere index for geospatial queries
storeSchema.index({ location: "2dsphere" });

// Index for promoted store queries
storeSchema.index({ isPromoted: 1, status: 1 });

module.exports = mongoose.model("Store", storeSchema);
