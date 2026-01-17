const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  logo: {
    type: String, // URL or path to the logo image
    default: null
  },
  primaryColor: {
    type: String,
    default: '#000000' // Default black
  },
  secondaryColor: {
    type: String,
    default: '#ffffff' // Default white
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Store', StoreSchema);
