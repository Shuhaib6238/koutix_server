/**
 * @file Lightspeed API Connector.
 * @description OAuth token refresh, product sync, stock deduction.
 */
const axios = require("axios");
const { decrypt } = require("../../utils/encrypt");
const logger = require("../../utils/logger");

async function authenticate(store) {
  const apiUrl = store.pos?.apiUrl || "https://api.lightspeedapp.com/API";
  const apiKey = store.pos?.encryptedApiKey
    ? decrypt(store.pos.encryptedApiKey)
    : null;
  if (!apiKey) throw new Error("Lightspeed API key required");

  return axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

async function fetchProducts(store) {
  try {
    const client = await authenticate(store);
    const response = await client.get("/Account/{accountID}/Item.json");
    const items = response.data?.Item || [];
    return (Array.isArray(items) ? items : [items]).map((p) => ({
      sku: p.customSku || p.systemSku || String(p.itemID),
      barcode: p.upc || null,
      name: p.description,
      price: parseFloat(p.Prices?.ItemPrice?.[0]?.amount || 0),
      stock: parseInt(p.ItemShops?.ItemShop?.[0]?.qoh || 0, 10),
      category: p.Category?.name || null,
      brand: p.Manufacturer?.name || null,
      posProductId: String(p.itemID),
    }));
  } catch (err) {
    logger.error(`Lightspeed fetchProducts error: ${err.message}`);
    throw err;
  }
}

async function deductStock(store, sku, qty) {
  try {
    const client = await authenticate(store);
    const response = await client.post("/Account/{accountID}/Sale.json", {
      SaleLines: { SaleLine: { itemID: sku, unitQuantity: qty } },
    });
    return { success: true, data: response.data };
  } catch (err) {
    logger.error(`Lightspeed deductStock error: ${err.message}`);
    throw err;
  }
}

async function syncInventory(store) {
  const products = await fetchProducts(store);
  return { synced: products.length, products };
}

module.exports = { fetchProducts, deductStock, syncInventory };
