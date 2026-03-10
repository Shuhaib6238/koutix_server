/**
 * @file Product Mongoose model.
 * @description Store products — synced from POS or managed manually.
 */
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    barcode: {
      type: String,
      trim: true,
      index: true,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Original price for crossed-out display */
    comparePrice: {
      type: Number,
      default: null,
    },
    category: {
      type: String,
      default: null,
      index: true,
    },
    brand: {
      type: String,
      default: null,
    },
    /** CDN URLs for product images */
    images: {
      type: [String],
      default: [],
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      default: "pcs",
    },
    /** UAE/Saudi VAT rate (default 5%) */
    vatRate: {
      type: Number,
      default: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /** POS system product ID for sync reference */
    posProductId: {
      type: String,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
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

// Compound unique index: one SKU per store
productSchema.index({ storeId: 1, sku: 1 }, { unique: true });

// Text index for search
productSchema.index({ name: "text", description: "text", brand: "text" });

module.exports = mongoose.model("Product", productSchema);
