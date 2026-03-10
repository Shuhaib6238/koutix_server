/**
 * @file PosConfig Mongoose model.
 * @description POS system configuration per store.
 */
const mongoose = require("mongoose");

const posConfigSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      unique: true,
      index: true,
    },
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
      ],
      required: true,
    },
    apiUrl: {
      type: String,
      default: null,
    },
    /** AES-256-GCM encrypted — NEVER returned in responses */
    encryptedApiKey: {
      type: String,
      select: false,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "error"],
      default: "inactive",
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    /** Recent sync errors for debugging */
    syncErrors: [
      {
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        delete ret.encryptedApiKey;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model("PosConfig", posConfigSchema);
