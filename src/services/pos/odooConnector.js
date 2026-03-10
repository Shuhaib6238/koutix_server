/**
 * @file Odoo REST API Connector.
 */
const axios = require("axios");
const { decrypt } = require("../../utils/encrypt");
const logger = require("../../utils/logger");

async function authenticate(store) {
  const apiUrl = store.pos?.apiUrl;
  const apiKey = store.pos?.encryptedApiKey
    ? decrypt(store.pos.encryptedApiKey)
    : null;
  if (!apiUrl || !apiKey) throw new Error("Odoo API URL and key required");

  const client = axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
  return client;
}

async function fetchProducts(store) {
  try {
    const client = await authenticate(store);
    const response = await client.get("/api/product.product", {
      params: {
        filters: '[["sale_ok","=",true]]',
        fields: "name,list_price,default_code,barcode,categ_id,qty_available",
      },
    });
    return (response.data?.results || response.data || []).map((p) => ({
      sku: p.default_code || String(p.id),
      barcode: p.barcode || null,
      name: p.name,
      price: p.list_price || 0,
      stock: p.qty_available || 0,
      category: p.categ_id?.[1] || null,
      brand: null,
      posProductId: String(p.id),
    }));
  } catch (err) {
    logger.error(`Odoo fetchProducts error: ${err.message}`);
    throw err;
  }
}

async function deductStock(store, sku, qty) {
  try {
    const client = await authenticate(store);
    const response = await client.post("/api/pos.order", {
      lines: [{ product_id: sku, qty }],
    });
    return { success: true, data: response.data };
  } catch (err) {
    logger.error(`Odoo deductStock error: ${err.message}`);
    throw err;
  }
}

async function syncInventory(store) {
  const products = await fetchProducts(store);
  return { synced: products.length, products };
}

module.exports = { fetchProducts, deductStock, syncInventory };
