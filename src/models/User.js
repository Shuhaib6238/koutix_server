/**
 * @file User Mongoose model.
 * @description Stores authenticated users: superAdmin, chainManager, branchManager, customer.
 */
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    /** Firebase UID — primary identifier */
    uid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    fullName: {
      type: String,
      trim: true,
      default: null,
    },
    /** Role — set from Firebase custom claims only, NEVER from request body */
    role: {
      type: String,
      enum: ["superAdmin", "chainManager", "branchManager", "customer"],
      required: true,
      default: "customer",
    },
    /** Account type for distinguishing chain vs standalone */
    accountType: {
      type: String,
      enum: ["chain", "standalone", null],
      default: null,
    },
    /** Reference to Store (for branchManager) */
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    /** Reference to Chain (for chainManager / branchManager) */
    chainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chain",
      default: null,
    },
    /** Account status */
    status: {
      type: String,
      enum: ["active", "suspended", "invited"],
      default: "active",
    },
    /** Branch manager invite token (crypto.randomUUID()) */
    inviteToken: {
      type: String,
      default: null,
      index: true,
    },
    /** Invite token expiry (72 hours from creation) */
    inviteTokenExpiry: {
      type: Date,
      default: null,
    },
    /** Firebase Cloud Messaging token (for push notifications) */
    fcmToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

module.exports = mongoose.model("User", userSchema);
