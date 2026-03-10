/**
 * @file SAP Business One / SAP BTP Connector.
 */
const axios = require("axios");
const { decrypt } = require("../../utils/encrypt");
const logger = require("../../utils/logger");

async function authenticate(store) {
  const apiUrl = store.pos?.apiUrl;
  const apiKey = store.pos?.encryptedApiKey
    ? decrypt(store.pos.encryptedApiKey)
    : null;
  if (!apiUrl || !apiKey) throw new Error("SAP API URL and key required");

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
    const response = await client.get("/b1s/v1/Items", {
      params: {
        $select:
          "ItemCode,ItemName,ItemBarCodeCollection,ItemPrices,QuantityOnStock,ItemsGroupCode",
      },
    });
    return (response.data?.value || []).map((p) => ({
      sku: p.ItemCode,
      barcode: p.ItemBarCodeCollection?.[0]?.Barcode || null,
      name: p.ItemName,
      price: p.ItemPrices?.[0]?.Price || 0,
      stock: p.QuantityOnStock || 0,
      category: p.ItemsGroupCode || null,
      brand: null,
      posProductId: p.ItemCode,
    }));
  } catch (err) {
    logger.error(`SAP fetchProducts error: ${err.message}`);
    throw err;
  }
}

async function deductStock(store, sku, qty) {
  try {
    const client = await authenticate(store);
    const response = await client.post("/b1s/v1/InventoryGenExits", {
      DocumentLines: [{ ItemCode: sku, Quantity: qty }],
    });
    return { success: true, data: response.data };
  } catch (err) {
    logger.error(`SAP deductStock error: ${err.message}`);
    throw err;
  }
}

async function syncInventory(store) {
  const products = await fetchProducts(store);
  return { synced: products.length, products };
}

module.exports = { fetchProducts, deductStock, syncInventory };
