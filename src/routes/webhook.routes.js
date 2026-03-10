/**
 * @file Webhook routes — Stripe webhook with raw body.
 * NOTE: Must be mounted BEFORE express.json() middleware in app.js.
 */
const { Router } = require("express");
const express = require("express");
const webhookController = require("../controllers/webhook.controller");

const router = Router();

// Stripe requires raw body for signature verification
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  webhookController.handleStripeWebhook,
);

module.exports = router;
