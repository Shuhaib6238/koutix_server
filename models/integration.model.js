const mongoose = require('mongoose');

const IntegrationSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        default: null
    },
    integrationType: {
        type: String,
        enum: ['SAP', 'ODOO', 'GENERIC_API', 'MANUAL'],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    scope: {
        type: String,
        enum: ['CHAIN', 'BRANCH'],
        default: 'CHAIN'
    },
    credentials: {
        apiUrl: { type: String, default: null },
        apiKey: { type: String, default: null },
        clientId: { type: String, default: null },
        clientSecret: { type: String, default: null }
    },
    settings: {
        autoProductSync: { type: Boolean, default: true },
        autoInventorySync: { type: Boolean, default: true },
        autoOrderPush: { type: Boolean, default: true },
        syncIntervalMinutes: { type: Number, default: 10 },
        productSyncEndpoint: { type: String, default: '/http/koutix/products' },
        inventorySyncEndpoint: { type: String, default: '/http/koutix/inventory' }
    },
    lastSyncTime: {
        type: Date,
        default: null
    },
    lastSyncStatus: {
        type: String,
        enum: ['SUCCESS', 'FAILED', 'PARTIAL', 'NEVER'],
        default: 'NEVER'
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'DISCONNECTED', 'CONFIGURING', 'ERROR'],
        default: 'CONFIGURING'
    },
    syncStats: {
        totalProductsSynced: { type: Number, default: 0 },
        totalOrdersPushed: { type: Number, default: 0 },
        totalErrors: { type: Number, default: 0 },
        lastError: { type: String, default: null },
        latencyMs: { type: Number, default: 0 },
        queueBacklog: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Index for quick lookups
IntegrationSchema.index({ tenantId: 1, branchId: 1 });
IntegrationSchema.index({ tenantId: 1, scope: 1 });

module.exports = mongoose.model('Integration', IntegrationSchema);
