const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  vat_trn: {
    type: String,
    trim: true
  },
  hq_address: {
    type: String,
    trim: true
  },
  trade_license: {
    type: String,
    trim: true
  },
  logo_url: {
    type: String,
    default: null
  },
  primary_color: {
    type: String,
    default: '#FF6B35'
  },
  expected_branch_count: {
    type: Number,
    default: 1
  },
  pos_system: {
    type: String,
    enum: ['SAP', 'Zoho', 'Custom'],
    default: 'Custom'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Organization', OrganizationSchema);
