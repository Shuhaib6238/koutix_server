/**
 * @file Openbravo Commerce Cloud API Connector.
 */
const axios = require("axios");
const { decrypt } = require("../../utils/encrypt");
const logger = require("../../utils/logger");

async function authenticate(store) {
  const apiUrl = store.pos?.apiUrl;
  const apiKey = store.pos?.encryptedApiKey
    ? decrypt(store.pos.encryptedApiKey)
    : null;
  if (!apiUrl || !apiKey) throw new Error("Openbravo API URL and key required");

  return axios.create({
    baseURL: apiUrl,
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

async function fetchProducts(store) {
  try {
    const client = await authenticate(store);
    const response = await client.get("/openbravo/ws/dal/Product", {
      params: { _where: "productCategory != null", _sortBy: "name" },
    });
    return (response.data?.response?.data || []).map((p) => ({
      sku: p.searchKey || p.id,
      barcode: p.uPCEAN || null,
      name: p.name,
      price: p.standardPrice || 0,
      stock: p.quantityOnHand || 0,
      category: p.productCategory$_identifier || null,
      brand: p.brand$_identifier || null,
      posProductId: p.id,
    }));
  } catch (err) {
    logger.error(`Openbravo fetchProducts error: ${err.message}`);
    throw err;
  }
}

async function deductStock(store, sku, qty) {
  try {
    const client = await authenticate(store);
    const response = await client.post(
      "/openbravo/ws/dal/MaterialTransaction",
      {
        product: sku,
        movementQuantity: -qty,
        movementType: "C-",
      },
    );
    return { success: true, data: response.data };
  } catch (err) {
    logger.error(`Openbravo deductStock error: ${err.message}`);
    throw err;
  }
}

async function syncInventory(store) {
  const products = await fetchProducts(store);
  return { synced: products.length, products };
}

module.exports = { fetchProducts, deductStock, syncInventory };
