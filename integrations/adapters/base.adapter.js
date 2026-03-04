/**
 * BasePOSAdapter — Abstract interface that all POS adapters must implement.
 * Every adapter translates between POS-specific formats and the Koutix internal schema.
 */
class BasePOSAdapter {
    constructor(integration) {
        if (new.target === BasePOSAdapter) {
            throw new Error('BasePOSAdapter is abstract — use a concrete adapter');
        }
        this.integration = integration;
        this.credentials = integration.credentials || {};
        this.settings = integration.settings || {};
    }

    /**
     * Sync products from POS to Koutix
     * @param {string} branchId
     * @returns {{ products: Array, synced: number, errors: number }}
     */
    async syncProducts(branchId) {
        throw new Error('syncProducts() must be implemented by adapter');
    }

    /**
     * Sync inventory/stock levels from POS
     * @param {string} branchId
     * @returns {{ items: Array, synced: number, errors: number }}
     */
    async syncInventory(branchId) {
        throw new Error('syncInventory() must be implemented by adapter');
    }

    /**
     * Push a Koutix order to the POS system
     * @param {object} orderData - Koutix order document
     * @returns {{ posOrderId: string, success: boolean }}
     */
    async pushOrder(orderData) {
        throw new Error('pushOrder() must be implemented by adapter');
    }

    /**
     * Update stock level for a single product in POS
     * @param {string} productId
     * @param {number} quantity
     * @returns {{ success: boolean }}
     */
    async updateStock(productId, quantity) {
        throw new Error('updateStock() must be implemented by adapter');
    }

    /**
     * Check if the POS connection is healthy
     * @returns {{ healthy: boolean, latency: number, message: string }}
     */
    async healthCheck() {
        throw new Error('healthCheck() must be implemented by adapter');
    }

    // ─── Helpers ───

    /**
     * Map a POS product to Koutix internal format
     */
    mapToKoutixProduct(posProduct) {
        throw new Error('mapToKoutixProduct() must be implemented');
    }

    /**
     * Map a Koutix order to POS format
     */
    mapToKoutixOrder(koutixOrder) {
        throw new Error('mapToKoutixOrder() must be implemented');
    }

    getAdapterName() {
        return this.constructor.name;
    }
}

module.exports = BasePOSAdapter;
