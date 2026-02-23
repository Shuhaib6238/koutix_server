const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0
  },
  category: {
    type: String,
    trim: true
  },
  // SAP Specific Fields
  sapMaterialId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  sapMetadata: {
    baseUnit: String,
    materialGroup: String,
    lastSyncAt: Date
  },
  org_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', ProductSchema);
