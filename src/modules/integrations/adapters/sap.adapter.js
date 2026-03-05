const axios = require('axios');
const BasePOSAdapter = require('./base.adapter');

/**
 * SAP POS Adapter — integrates with SAP Business One / SAP BTP
 * Translates SAP material/stock/order formats ↔ Koutix format
 */
class SAPAdapter extends BasePOSAdapter {
    constructor(integration) {
        super(integration);
        this.apiUrl = this.credentials.apiUrl || process.env.SAP_IT_RT_URL;
        this.tokenUrl = process.env.SAP_TOKEN_URL;
        this.clientId = this.credentials.clientId || process.env.SAP_CLIENT_ID;
        this.clientSecret = this.credentials.clientSecret || process.env.SAP_CLIENT_SECRET;
        this._token = null;
        this._tokenExpiry = 0;
    }

    async _getToken() {
        if (this._token && Date.now() < this._tokenExpiry) return this._token;
        try {
            const resp = await axios.post(this.tokenUrl, 'grant_type=client_credentials', {
                auth: { username: this.clientId, password: this.clientSecret },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000,
            });
            this._token = resp.data.access_token;
            this._tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
            return this._token;
        } catch (err) {
            throw new Error(`SAP Auth failed: ${err.message}`);
        }
    }

    async _request(method, path, data = null) {
        const token = await this._getToken();
        const config = {
            method,
            url: `${this.apiUrl}${path}`,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            timeout: 15000,
        };
        if (data) config.data = data;
        return axios(config);
    }

    mapToKoutixProduct(sapItem) {
        return {
            name: sapItem.MaterialDescription || sapItem.ItemName || 'Unknown',
            sku: sapItem.Material || sapItem.ItemCode || '',
            price: parseFloat(sapItem.Price || sapItem.StandardPrice || 0),
            stock: parseInt(sapItem.UnrestrictedStock || sapItem.QuantityOnHand || 0),
            category: sapItem.MaterialGroup || sapItem.ItemGroup || 'General',
            sapMaterialId: sapItem.Material || sapItem.ItemCode,
            sapMetadata: {
                baseUnit: sapItem.BaseUnit || 'EA',
                materialGroup: sapItem.MaterialGroup || '',
                lastSyncAt: new Date()
            }
        };
    }

    async syncProducts(branchId) {
        let synced = 0, errors = 0;
        const products = [];
        const endpoint = this.integration.settings?.productSyncEndpoint || '/http/koutix/products';
        const fullUrl = `${this.apiUrl}${endpoint}`;

        try {
            console.log(`🚀 Starting SAP Product Sync from: ${fullUrl}`);
            const resp = await this._request('GET', endpoint);
            const items = resp.data?.d?.results || resp.data?.items || resp.data || [];
            
            for (const item of (Array.isArray(items) ? items : [])) {
                try {
                    products.push(this.mapToKoutixProduct(item));
                    synced++;
                } catch (err) { 
                    errors++; 
                    console.error(`  ⚠️ Failed to map item: ${item.Material || item.ItemCode}`, err.message);
                }
            }
        } catch (err) {
            const status = err.response?.status || 'Error';
            const message = `SAP product sync failed at [${fullUrl}] (Status: ${status}): ${err.message}`;
            console.error(`❌ ${message}`);
            throw new Error(message);
        }
        return { products, synced, errors };
    }

    async syncInventory(branchId) {
        let synced = 0, errors = 0;
        const items = [];
        const endpoint = this.integration.settings?.inventorySyncEndpoint || '/http/koutix/inventory';
        const fullUrl = `${this.apiUrl}${endpoint}`;

        try {
            console.log(`🚀 Starting SAP Inventory Sync from: ${fullUrl}`);
            const resp = await this._request('GET', endpoint);
            const data = resp.data?.d?.results || resp.data?.items || resp.data || [];
            
            for (const item of (Array.isArray(data) ? data : [])) {
                try {
                    items.push({
                        sku: item.Material || item.ItemCode,
                        stock: parseInt(item.UnrestrictedStock || item.QuantityOnHand || 0),
                        sapMaterialId: item.Material || item.ItemCode,
                    });
                    synced++;
                } catch (err) { 
                    errors++; 
                }
            }
        } catch (err) {
            const status = err.response?.status || 'Error';
            const message = `SAP inventory sync failed at [${fullUrl}] (Status: ${status}): ${err.message}`;
            console.error(`❌ ${message}`);
            throw new Error(message);
        }
        return { items, synced, errors };
    }

    async pushOrder(orderData) {
        try {
            const sapOrder = {
                OrderType: 'SO',
                CustomerCode: orderData.customerId || 'WALK-IN',
                DocDate: new Date().toISOString().split('T')[0],
                Lines: (orderData.items || []).map(item => ({
                    ItemCode: item.sku || item.sapMaterialId,
                    Quantity: item.quantity,
                    UnitPrice: item.price,
                })),
            };
            const resp = await this._request('POST', '/http/koutix/orders', sapOrder);
            return { posOrderId: resp.data?.DocEntry || resp.data?.id || 'SAP-' + Date.now(), success: true };
        } catch (err) {
            return { posOrderId: null, success: false, error: err.message };
        }
    }

    async updateStock(productId, quantity) {
        try {
            await this._request('POST', '/http/koutix/inventory/update', {
                MaterialId: productId,
                Quantity: quantity
            });
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async healthCheck() {
        const start = Date.now();
        try {
            await this._getToken();
            const latency = Date.now() - start;
            return { healthy: true, latency, message: 'SAP connection OK' };
        } catch (err) {
            return { healthy: false, latency: Date.now() - start, message: err.message };
        }
    }
}

module.exports = SAPAdapter;
