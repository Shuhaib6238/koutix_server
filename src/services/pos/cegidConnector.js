/**
 * @file Cegid Y2 REST API Connector.
 * @description Handles authentication, product fetch, and stock deduction for Cegid POS.
 */
const axios = require("axios");
const { decrypt } = require("../../utils/encrypt");
const logger = require("../../utils/logger");

/**
 * Authenticate with Cegid Y2 API.
 * @param {object} store - Store document
 * @returns {Promise<{client: import('axios').AxiosInstance}>}
 */
async function authenticate(store) {
  const apiUrl = store.pos?.apiUrl;
  const apiKey = store.pos?.encryptedApiKey
    ? decrypt(store.pos.encryptedApiKey)
    : null;

  if (!apiUrl || !apiKey) {
    throw new Error("Cegid API URL and key are required");
  }

  const client = axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  return { client };
}

/**
 * Fetch products from Cegid POS.
 * @param {object} store
 * @returns {Promise<Array>}
 */
async function fetchProducts(store) {
  try {
    const { client } = await authenticate(store);
    const response = await client.get("/api/v1/products");

    return (response.data?.products || []).map((p) => ({
      sku: p.reference || p.id,
      barcode: p.ean || null,
      name: p.label || p.name,
      price: p.sellingPriceVATIncluded || p.price || 0,
      stock: p.stockQuantity || 0,
      category: p.family || null,
      brand: p.brand || null,
      posProductId: p.id,
    }));
  } catch (err) {
    logger.error(`Cegid fetchProducts error: ${err.message}`);
    throw err;
  }
}

/**
 * Deduct stock in Cegid POS.
 * @param {object} store
 * @param {string} sku
 * @param {number} qty
 */
async function deductStock(store, sku, qty) {
  try {
    const { client } = await authenticate(store);
    const response = await client.post("/api/v1/stock/deduct", {
      reference: sku,
      quantity: qty,
    });
    return { success: true, data: response.data };
  } catch (err) {
    logger.error(`Cegid deductStock error: ${err.message}`);
    throw err;
  }
}

/**
 * Full inventory sync from Cegid.
 * @param {object} store
 */
async function syncInventory(store) {
  const products = await fetchProducts(store);
  return { synced: products.length, products };
}

module.exports = { fetchProducts, deductStock, syncInventory };
