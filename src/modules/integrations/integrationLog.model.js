const mongoose = require('mongoose');

const IntegrationLogSchema = new mongoose.Schema({
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
    integrationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Integration',
        required: true,
        index: true
    },
    integrationType: {
        type: String,
        enum: ['SAP', 'ODOO', 'GENERIC_API', 'MANUAL'],
        required: true
    },
    eventType: {
        type: String,
        enum: [
            'PRODUCT_SYNC', 'INVENTORY_SYNC', 'ORDER_PUSH',
            'STOCK_UPDATE', 'HEALTH_CHECK', 'CONNECTION',
            'DISCONNECTION', 'MANUAL_SYNC', 'WEBHOOK_RECEIVED',
            'ERROR', 'CONFIG_CHANGE'
        ],
        required: true
    },
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILED', 'PARTIAL', 'PENDING', 'RETRYING'],
        required: true
    },
    message: {
        type: String,
        default: ''
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    duration: {
        type: Number,
        default: 0
    },
    itemsProcessed: {
        type: Number,
        default: 0
    },
    itemsFailed: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Auto-expire logs after 90 days
IntegrationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
// Fast query by integration + time
IntegrationLogSchema.index({ integrationId: 1, createdAt: -1 });

module.exports = mongoose.model('IntegrationLog', IntegrationLogSchema);
