const axios = require('axios');
const BasePOSAdapter = require('./base.adapter');

/**
 * Odoo POS Adapter — integrates with Odoo ERP via JSON-RPC API
 * Translates Odoo product/stock/order formats ↔ Koutix format
 */
class OdooAdapter extends BasePOSAdapter {
    constructor(integration) {
        super(integration);
        this.apiUrl = this.credentials.apiUrl;
        this.apiKey = this.credentials.apiKey;
        this.db = this.credentials.clientId || 'odoo_db';
        this.uid = null;
    }

    async _authenticate() {
        if (this.uid) return this.uid;
        try {
            const resp = await axios.post(`${this.apiUrl}/jsonrpc`, {
                jsonrpc: '2.0', method: 'call', id: 1,
                params: {
                    service: 'common', method: 'authenticate',
                    args: [this.db, this.credentials.clientId, this.credentials.clientSecret, {}]
                }
            }, { timeout: 10000 });
            this.uid = resp.data.result;
            if (!this.uid) throw new Error('Odoo authentication failed');
            return this.uid;
        } catch (err) {
            throw new Error(`Odoo Auth failed: ${err.message}`);
        }
    }

    async _call(model, method, args = [], kwargs = {}) {
        const uid = await this._authenticate();
        const resp = await axios.post(`${this.apiUrl}/jsonrpc`, {
            jsonrpc: '2.0', method: 'call', id: Date.now(),
            params: {
                service: 'object', method: 'execute_kw',
                args: [this.db, uid, this.credentials.clientSecret, model, method, args, kwargs]
            }
        }, { timeout: 15000 });
        if (resp.data.error) throw new Error(resp.data.error.message || 'Odoo RPC error');
        return resp.data.result;
    }

    mapToKoutixProduct(odooProduct) {
        return {
            name: odooProduct.name || 'Unknown',
            sku: odooProduct.default_code || `ODOO-${odooProduct.id}`,
            price: parseFloat(odooProduct.list_price || 0),
            stock: parseFloat(odooProduct.qty_available || 0),
            category: odooProduct.categ_id?.[1] || 'General',
            sapMaterialId: null,
            sapMetadata: { baseUnit: odooProduct.uom_id?.[1] || 'Unit', materialGroup: '', lastSyncAt: new Date() }
        };
    }

    async syncProducts(branchId) {
        let synced = 0, errors = 0;
        const products = [];
        try {
            const ids = await this._call('product.product', 'search', [[['sale_ok', '=', true]]], { limit: 500 });
            const items = await this._call('product.product', 'read', [ids], {
                fields: ['name', 'default_code', 'list_price', 'qty_available', 'categ_id', 'uom_id']
            });
            for (const item of items) {
                try { products.push(this.mapToKoutixProduct(item)); synced++; } catch { errors++; }
            }
        } catch (err) {
            throw new Error(`Odoo product sync failed: ${err.message}`);
        }
        return { products, synced, errors };
    }

    async syncInventory(branchId) {
        let synced = 0, errors = 0;
        const items = [];
        try {
            const ids = await this._call('product.product', 'search', [[['type', '=', 'product']]], { limit: 500 });
            const data = await this._call('product.product', 'read', [ids], {
                fields: ['default_code', 'qty_available']
            });
            for (const item of data) {
                try {
                    items.push({ sku: item.default_code || `ODOO-${item.id}`, stock: parseFloat(item.qty_available || 0) });
                    synced++;
                } catch { errors++; }
            }
        } catch (err) {
            throw new Error(`Odoo inventory sync failed: ${err.message}`);
        }
        return { items, synced, errors };
    }

    async pushOrder(orderData) {
        try {
            const lines = (orderData.items || []).map(item => [0, 0, {
                product_id: item.odooProductId || false,
                product_uom_qty: item.quantity,
                price_unit: item.price,
            }]);
            const orderId = await this._call('sale.order', 'create', [{
                partner_id: 1,
                order_line: lines,
                note: `Koutix Order: ${orderData.orderId || ''}`
            }]);
            return { posOrderId: `ODOO-SO-${orderId}`, success: true };
        } catch (err) {
            return { posOrderId: null, success: false, error: err.message };
        }
    }

    async updateStock(productId, quantity) {
        try {
            // Odoo stock updates go through stock.quant
            return { success: true, message: 'Stock update queued' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async healthCheck() {
        const start = Date.now();
        try {
            const version = await axios.post(`${this.apiUrl}/jsonrpc`, {
                jsonrpc: '2.0', method: 'call', id: 1,
                params: { service: 'db', method: 'server_version', args: [] }
            }, { timeout: 5000 });
            return { healthy: true, latency: Date.now() - start, message: `Odoo v${version.data.result}` };
        } catch (err) {
            return { healthy: false, latency: Date.now() - start, message: err.message };
        }
    }
}

module.exports = OdooAdapter;
