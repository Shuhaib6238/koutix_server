const axios = require('axios');
const BasePOSAdapter = require('./base.adapter');

/**
 * Generic REST POS Adapter — connects to any POS with a REST API
 * Expects standard endpoints: /products, /inventory, /orders
 */
class GenericAdapter extends BasePOSAdapter {
    constructor(integration) {
        super(integration);
        this.apiUrl = this.credentials.apiUrl;
        this.apiKey = this.credentials.apiKey;
    }

    _headers() {
        const h = { 'Content-Type': 'application/json' };
        if (this.apiKey) h['X-API-Key'] = this.apiKey;
        return h;
    }

    mapToKoutixProduct(item) {
        return {
            name: item.name || item.product_name || item.title || 'Unknown',
            sku: item.sku || item.code || item.barcode || `GEN-${Date.now()}`,
            price: parseFloat(item.price || item.unit_price || 0),
            stock: parseInt(item.stock || item.quantity || item.qty || 0),
            category: item.category || item.group || 'General',
        };
    }

    async syncProducts(branchId) {
        let synced = 0, errors = 0;
        const products = [];
        try {
            const resp = await axios.get(`${this.apiUrl}/products`, {
                headers: this._headers(),
                params: branchId ? { branchId } : {},
                timeout: 15000,
            });
            const items = resp.data?.products || resp.data?.data || resp.data || [];
            for (const item of (Array.isArray(items) ? items : [])) {
                try { products.push(this.mapToKoutixProduct(item)); synced++; } catch { errors++; }
            }
        } catch (err) {
            throw new Error(`Generic POS product sync failed: ${err.message}`);
        }
        return { products, synced, errors };
    }

    async syncInventory(branchId) {
        let synced = 0, errors = 0;
        const items = [];
        try {
            const resp = await axios.get(`${this.apiUrl}/inventory`, {
                headers: this._headers(),
                params: branchId ? { branchId } : {},
                timeout: 15000,
            });
            const data = resp.data?.inventory || resp.data?.data || resp.data || [];
            for (const item of (Array.isArray(data) ? data : [])) {
                try {
                    items.push({
                        sku: item.sku || item.code || item.barcode,
                        stock: parseInt(item.stock || item.quantity || item.qty || 0),
                    });
                    synced++;
                } catch { errors++; }
            }
        } catch (err) {
            throw new Error(`Generic POS inventory sync failed: ${err.message}`);
        }
        return { items, synced, errors };
    }

    async pushOrder(orderData) {
        try {
            const resp = await axios.post(`${this.apiUrl}/orders`, {
                orderId: orderData.orderId,
                items: (orderData.items || []).map(i => ({
                    sku: i.sku,
                    quantity: i.quantity,
                    price: i.price,
                })),
                total: orderData.total,
                customer: orderData.customerId || 'WALK-IN',
            }, { headers: this._headers(), timeout: 15000 });
            return { posOrderId: resp.data?.orderId || resp.data?.id || `GEN-${Date.now()}`, success: true };
        } catch (err) {
            return { posOrderId: null, success: false, error: err.message };
        }
    }

    async updateStock(productId, quantity) {
        try {
            await axios.put(`${this.apiUrl}/inventory/${productId}`, { stock: quantity }, {
                headers: this._headers(), timeout: 10000
            });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async healthCheck() {
        const start = Date.now();
        try {
            await axios.get(`${this.apiUrl}/health`, { headers: this._headers(), timeout: 5000 })
                .catch(() => axios.get(this.apiUrl, { headers: this._headers(), timeout: 5000 }));
            return { healthy: true, latency: Date.now() - start, message: 'POS connection OK' };
        } catch (err) {
            return { healthy: false, latency: Date.now() - start, message: err.message };
        }
    }
}

module.exports = GenericAdapter;
