/**
 * @file Order Mongoose model — STUB for Rashid (Backend Dev 2).
 * @description Rashid will implement full order + payment logic.
 * TODO:RASHID — Complete order model with payment integration.
 */
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: String, // Firebase UID
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ["scan_and_go", "pickup"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    /** Snapshot of cart items at time of order */
    cartSnapshot: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        sku: String,
        name: String,
        price: Number,
        qty: Number,
        vatRate: Number,
        imageUrl: String,
      },
    ],
    subtotal: {
      type: Number,
      default: 0,
    },
    vatAmount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    /** Gateway payment intent ID — never store card data */
    paymentIntentId: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "failed"],
      default: "pending",
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

module.exports = mongoose.model("Order", orderSchema);
