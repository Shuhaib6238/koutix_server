const BasePOSAdapter = require('./base.adapter');

/**
 * Manual Mode Adapter — no POS integration
 * Products/inventory managed manually within Koutix.
 * All sync methods are no-ops that return success.
 */
class ManualAdapter extends BasePOSAdapter {
    constructor(integration) {
        super(integration);
    }

    async syncProducts(branchId) {
        return { products: [], synced: 0, errors: 0, message: 'Manual mode — no POS sync needed' };
    }

    async syncInventory(branchId) {
        return { items: [], synced: 0, errors: 0, message: 'Manual mode — manage inventory in Koutix' };
    }

    async pushOrder(orderData) {
        return { posOrderId: `MANUAL-${Date.now()}`, success: true, message: 'Order saved in Koutix only' };
    }

    async updateStock(productId, quantity) {
        return { success: true, message: 'Stock updated in Koutix only' };
    }

    async healthCheck() {
        return { healthy: true, latency: 0, message: 'Manual mode — always healthy' };
    }
}

module.exports = ManualAdapter;
