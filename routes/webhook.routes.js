const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// Stripe requires the raw body for signature verification
router.post('/', express.raw({ type: 'application/json' }), webhookController.handle);

module.exports = router;
