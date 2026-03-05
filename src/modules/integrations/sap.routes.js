const express = require('express');
const sapController = require('./sap.controller');
// Production requirement: Webhook validation middleware
// const sapAuth = require('../../middleware/sapAuth.middleware');

const router = express.Router();

/**
 * @route   POST /api/sap/sync-inventory
 * @desc    Webhook for SAP to sync inventory levels
 * @access  Protected (via secret/signature in production)
 */
router.post('/sync-inventory', sapController.handleInventorySync);

/**
 * @route   POST /api/sap/bill-update
 * @desc    Webhook for SAP to notify when a bill/invoice is generated
 */
router.post('/bill-update', sapController.handleBillGenerated);

module.exports = router;
