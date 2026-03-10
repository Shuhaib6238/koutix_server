/**
 * @file POS Service — Unified interface for all POS connectors.
 * @description Routes POS operations to the correct connector based on store config.
 */
const logger = require("../../utils/logger");

// Import connectors
const cegidConnector = require("./cegidConnector");
const openbravoConnector = require("./openbravoConnector");
const odooConnector = require("./odooConnector");
const lightspeedConnector = require("./lightspeedConnector");
const sapConnector = require("./sapConnector");
const oracleConnector = require("./oracleConnector");

/**
 * Get the connector for a given POS type.
 * @param {string} posType
 * @returns {object} Connector module
 */
function getConnector(posType) {
  const connectors = {
    cegid: cegidConnector,
    openbravo: openbravoConnector,
    odoo: odooConnector,
    lightspeed: lightspeedConnector,
    sap: sapConnector,
    oracle: oracleConnector,
  };

  const connector = connectors[posType];
  if (!connector) {
    throw new Error(`Unsupported POS type: ${posType}`);
  }
  return connector;
}

/**
 * Fetch products from a store's POS system.
 * @param {object} store - Store document (with pos config)
 * @returns {Promise<Array>} Products
 */
async function fetchProducts(store) {
  if (!store.pos?.type || store.pos.type === "manual") {
    logger.info(`Store ${store._id} uses manual POS — skipping fetch`);
    return [];
  }

  const connector = getConnector(store.pos.type);
  return connector.fetchProducts(store);
}

/**
 * Deduct stock for a specific SKU.
 * @param {object} store
 * @param {string} sku
 * @param {number} qty
 * @returns {Promise<object>} Deduction result
 */
async function deductStock(store, sku, qty) {
  if (!store.pos?.type || store.pos.type === "manual") {
    logger.info(`Store ${store._id} uses manual POS — stock deduction skipped`);
    return { success: true, manual: true };
  }

  const connector = getConnector(store.pos.type);
  return connector.deductStock(store, sku, qty);
}

/**
 * Full inventory sync for a store.
 * @param {object} store
 * @returns {Promise<object>} Sync result
 */
async function syncInventory(store) {
  if (!store.pos?.type || store.pos.type === "manual") {
    logger.info(`Store ${store._id} uses manual POS — inventory sync skipped`);
    return { synced: 0 };
  }

  const connector = getConnector(store.pos.type);
  return connector.syncInventory(store);
}

module.exports = { fetchProducts, deductStock, syncInventory, getConnector };
