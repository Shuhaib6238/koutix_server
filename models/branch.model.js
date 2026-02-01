const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  org_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  manager_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  branch_id: {
    type: String,
    unique: true,
    sparse: true
  },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  pos_api_key: {
    type: String,
    unique: true,
    sparse: true
  },
  manager_email: {
    type: String,
    trim: true,
    lowercase: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Branch', BranchSchema);
