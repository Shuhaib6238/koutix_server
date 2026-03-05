const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    trim: true
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
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // ─── Stripe / Subscription (Nested Object) ───
  stripeCustomerId: {
    type: String,
    unique: true,
    sparse: true
  },
  subscription: {
    stripeSubscriptionId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING', 'UNPAID', 'INCOMPLETE', 'NONE'],
      default: 'NONE'
    },
    planId: {
      type: String,
      default: null
    },
    currentPeriodEnd: {
      type: Date,
      default: null
    }
  },
  // Legacy flat fields (kept for backward compat, synced via pre-save)
  stripeSubscriptionId: {
    type: String,
    unique: true,
    sparse: true
  },
  subscriptionStatus: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'none', 'PENDING', 'ACTIVE', 'CANCELED'],
    default: 'none'
  },
  planType: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'enterprise', 'none'],
    default: 'none'
  },
  currentPeriodEnd: {
    type: Date
  }
}, {
  timestamps: true
});

// Sync nested subscription to legacy flat fields
OrganizationSchema.pre('save', function (next) {
  // Sync nested → flat
  if (this.subscription) {
    if (this.subscription.stripeSubscriptionId) {
      this.stripeSubscriptionId = this.subscription.stripeSubscriptionId;
    }
    if (this.subscription.status) {
      const statusMap = {
        'PENDING': 'none',
        'ACTIVE': 'active',
        'CANCELED': 'canceled',
        'PAST_DUE': 'past_due',
        'TRIALING': 'trialing',
        'UNPAID': 'unpaid',
        'INCOMPLETE': 'incomplete',
        'NONE': 'none'
      };
      this.subscriptionStatus = statusMap[this.subscription.status] || this.subscription.status;
    }
    if (this.subscription.currentPeriodEnd) {
      this.currentPeriodEnd = this.subscription.currentPeriodEnd;
    }
  }
  next();
});

module.exports = mongoose.model('Organization', OrganizationSchema);
