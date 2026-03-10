/**
 * @file Oracle Retail / Oracle MICROS Connector.
 */
const axios = require("axios");
const { decrypt } = require("../../utils/encrypt");
const logger = require("../../utils/logger");

async function authenticate(store) {
  const apiUrl = store.pos?.apiUrl;
  const apiKey = store.pos?.encryptedApiKey
    ? decrypt(store.pos.encryptedApiKey)
    : null;
  if (!apiUrl || !apiKey) throw new Error("Oracle API URL and key required");

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
    const response = await client.get("/retail/items");
    return (response.data?.items || []).map((p) => ({
      sku: p.itemNumber || p.id,
      barcode: p.upc || null,
      name: p.itemDescription || p.name,
      price: p.currentRetailPrice || 0,
      stock: p.stockOnHand || 0,
      category: p.department || null,
      brand: p.brand || null,
      posProductId: String(p.id),
    }));
  } catch (err) {
    logger.error(`Oracle fetchProducts error: ${err.message}`);
    throw err;
  }
}

async function deductStock(store, sku, qty) {
  try {
    const client = await authenticate(store);
    const response = await client.post("/retail/transactions", {
      items: [{ itemNumber: sku, quantity: qty, transactionType: "SALE" }],
    });
    return { success: true, data: response.data };
  } catch (err) {
    logger.error(`Oracle deductStock error: ${err.message}`);
    throw err;
  }
}

async function syncInventory(store) {
  const products = await fetchProducts(store);
  return { synced: products.length, products };
}

module.exports = { fetchProducts, deductStock, syncInventory };
