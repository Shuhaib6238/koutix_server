const BasePOSAdapter = require('./base.adapter');

/**
 * ManualAdapter — Used for manual integrations where no automated sync occurs.
 * Implements the BasePOSAdapter interface with empty/placeholder logic.
 */
class ManualAdapter extends BasePOSAdapter {
    constructor(integration) {
        super(integration);
    }

    async syncProducts(branchId) {
        return { products: [], synced: 0, errors: 0 };
    }

    async syncInventory(branchId) {
        return { items: [], synced: 0, errors: 0 };
    }

    async pushOrder(orderData) {
        return { posOrderId: 'MANUAL-' + Date.now(), success: true };
    }

    async updateStock(productId, quantity) {
        return { success: true };
    }

    async healthCheck() {
        return { 
            healthy: true, 
            latency: 0, 
            message: 'Manual integration is always healthy' 
        };
    }

    mapToKoutixProduct(posProduct) {
        return posProduct;
    }

    mapToKoutixOrder(koutixOrder) {
        return koutixOrder;
    }
}

module.exports = ManualAdapter;
