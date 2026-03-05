const express = require('express');
const router = express.Router();
const webhookController = require('./webhook.controller');

// Stripe requires the raw body for signature verification
// Must be placed BEFORE express.json() middleware in app.js
router.post('/', express.raw({ type: 'application/json' }), (req, res) => {
    webhookController.handle(req, res);
});

module.exports = router;
