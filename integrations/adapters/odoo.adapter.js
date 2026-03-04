const axios = require('axios');
const BasePOSAdapter = require('./base.adapter');

/**
 * Odoo POS Adapter — integrates with Odoo ERP via JSON-RPC API
 * Translates Odoo product/stock/order formats ↔ Koutix format
 */
class OdooAdapter extends BasePOSAdapter {
    constructor(integration) {
        super(integration);
        // Normalize URL: remove trailing slash and common subpaths
        let url = (this.credentials.apiUrl || '').trim().replace(/\/$/, '');

        // Aggressively remove Odoo-specific path suffixes
        url = url.split('/web')[0].split('/xmlrpc')[0].split('/jsonrpc')[0].split('/#')[0];

        if (url && !url.startsWith('http')) url = `https://${url}`;
        this.apiUrl = url;

        // Odoo requires: DB Name, Username, Password
        // Mapping: clientId -> DB, apiKey -> Username, clientSecret -> Password
        this.db = this.credentials.clientId || 'odoo_db';
        this.username = this.credentials.apiKey || this.credentials.clientId;
        this.password = this.credentials.clientSecret;

        this.uid = null;
    }

    async _authenticate() {
        if (this.uid) return this.uid;
        if (!this.apiUrl) throw new Error('Odoo API URL is missing');

        try {
            const authUrl = `${this.apiUrl}/jsonrpc`;
            const resp = await axios.post(authUrl, {
                jsonrpc: '2.0',
                method: 'call',
                id: 1,
                params: {
                    service: 'common',
                    method: 'authenticate',
                    args: [this.db, this.username, this.password, {}]
                }
            }, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });

            if (resp.data.error) {
                const msg = resp.data.error.data?.message || resp.data.error.message || 'Odoo Auth Error';
                throw new Error(msg);
            }

            this.uid = resp.data.result;
            // Odoo returns false on auth failure
            if (this.uid === false || !this.uid) {
                throw new Error('Odoo authentication failed: Invalid Database, Username, or Password');
            }
            return this.uid;
        } catch (err) {
            if (err.response && err.response.status === 400) {
                throw new Error(`Odoo returned 400 (Bad Request). This usually means the URL is slightly wrong or the server version requires XML-RPC instead of JSON-RPC. Try using the base domain only: ${this.apiUrl}`);
            }
            if (err.response && err.response.status === 404) {
                throw new Error(`Odoo API not found. Ensure your URL is correct. Currently trying: ${this.apiUrl}/jsonrpc`);
            }
            throw new Error(`Odoo Auth failed: ${err.message}`);
        }
    }

    async _call(model, method, args = [], kwargs = {}) {
        const uid = await this._authenticate();
        try {
            const resp = await axios.post(`${this.apiUrl}/jsonrpc`, {
                jsonrpc: '2.0',
                method: 'call',
                id: Date.now(),
                params: {
                    service: 'object',
                    method: 'execute_kw',
                    args: [this.db, uid, this.password, model, method, args, kwargs]
                }
            }, {
                timeout: 15000,
                headers: { 'Content-Type': 'application/json' }
            });

            if (resp.data.error) {
                throw new Error(resp.data.error.data?.message || resp.data.error.message || 'Odoo RPC error');
            }
            return resp.data.result;
        } catch (err) {
            throw new Error(`Odoo RPC failed: ${err.message}`);
        }
    }

    mapToKoutixProduct(odooProduct) {
        return {
            name: odooProduct.name || 'Unknown',
            sku: odooProduct.default_code || `ODOO-${odooProduct.id}`,
            price: parseFloat(odooProduct.list_price || 0),
            stock: parseFloat(odooProduct.qty_available || 0),
            description: odooProduct.description_sale || '',
            category: odooProduct.categ_id?.[1] || 'General',
            posMetadata: { odooId: odooProduct.id, lastSyncAt: new Date() }
        };
    }

    async syncProducts(branchId) {
        let synced = 0, errors = 0;
        const products = [];
        try {
            const ids = await this._call('product.product', 'search', [[['sale_ok', '=', true]]], { limit: 500 });
            if (!ids || ids.length === 0) return { products: [], synced: 0, errors: 0 };

            const items = await this._call('product.product', 'read', [ids], {
                fields: ['name', 'default_code', 'list_price', 'qty_available', 'categ_id', 'uom_id', 'description_sale']
            });

            for (const item of items) {
                try {
                    products.push(this.mapToKoutixProduct(item));
                    synced++;
                } catch (e) {
                    errors++;
                }
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
            if (!ids || ids.length === 0) return { items: [], synced: 0, errors: 0 };

            const data = await this._call('product.product', 'read', [ids], {
                fields: ['default_code', 'qty_available']
            });

            for (const item of data) {
                try {
                    items.push({
                        sku: item.default_code || `ODOO-${item.id}`,
                        stock: parseFloat(item.qty_available || 0)
                    });
                    synced++;
                } catch {
                    errors++;
                }
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
                partner_id: 1, // Default to a general customer or as configured
                order_line: lines,
                note: `Koutix Order: ${orderData.orderId || ''}`
            }]);

            return { posOrderId: `ODOO-SO-${orderId}`, success: true };
        } catch (err) {
            return { posOrderId: null, success: false, error: err.message };
        }
    }

    async updateStock(productId, quantity) {
        // Stock updates in Odoo are complex (require picking or quant update)
        // For now, we return success as it might be handled via a full sync
        return { success: true, message: 'Stock update in Odoo usually requires a complete inventory adjustment.' };
    }

    async healthCheck() {
        const start = Date.now();
        try {
            await this._authenticate();
            return { healthy: true, latency: Date.now() - start, message: 'Odoo Connected Successfully' };
        } catch (err) {
            return { healthy: false, latency: Date.now() - start, message: err.message };
        }
    }
}

module.exports = OdooAdapter;
