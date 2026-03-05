const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'CHAIN_MANAGER', 'BRANCH_MANAGER', 'CUSTOMER'],
    required: true
  },
  type: {
    type: String,
    enum: ['PARTNER', 'CUSTOMER'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: null
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  },
  // Keep legacy field references for backward compatibility during migration
  org_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  branch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  }
}, {
  timestamps: true
});

// Virtual to keep backward compat — tenantId mirrors org_id
UserSchema.pre('save', function (next) {
  if (this.tenantId && !this.org_id) {
    this.org_id = this.tenantId;
  }
  if (this.org_id && !this.tenantId) {
    this.tenantId = this.org_id;
  }
  if (this.branchId && !this.branch_id) {
    this.branch_id = this.branchId;
  }
  if (this.branch_id && !this.branchId) {
    this.branchId = this.branch_id;
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);
