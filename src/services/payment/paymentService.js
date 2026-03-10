/**
 * @file Payment Service for processing Checkout.com and Stripe payments.
 * @description per-store credentials logic.
 */
const axios = require("axios");
const Stripe = require("stripe");
const crypto = require("crypto");
const mongoose = require("mongoose");

const Store = require("../../models/Store");
const Order = require("../../models/Order");
const Product = require("../../models/Product");
const User = require("../../models/User");

const { decrypt } = require("../../utils/encrypt");
const logger = require("../../utils/logger");
const { sendPushNotification } = require("../fcm.service");
const env = require("../../config/env");

async function getStoreCredentials(storeId) {
  const store = await Store.findById(storeId).select(
    "+payment.encryptedSecretKey",
  );
  if (!store || !store.payment || !store.payment.encryptedSecretKey) {
    throw new Error("Store payment credentials not configured");
  }
  const secretKey = decrypt(store.payment.encryptedSecretKey);
  return { gatewayType: store.payment.gatewayType, secretKey, store };
}

async function createPaymentSession(
  orderId,
  storeId,
  amount,
  currency = "AED",
) {
  const { gatewayType, secretKey } = await getStoreCredentials(storeId);
  const amountInFils = Math.round(amount * 100);

  if (gatewayType === "checkout") {
    const url = `${env.CHECKOUT_API_URL || "https://api.sandbox.checkout.com"}/payments`;
    try {
      const response = await axios.post(
        url,
        {
          amount: amountInFils,
          currency,
          reference: orderId.toString(),
          capture: true,
          metadata: { orderId: orderId.toString() },
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      await Order.findByIdAndUpdate(orderId, {
        paymentIntentId: response.data.id,
      });
      return {
        paymentId: response.data.id,
        redirectUrl: response.data._links?.redirect?.href || null,
      };
    } catch (err) {
      logger.error(
        `Checkout.com session failed: ${err.response?.data?.message || err.message}`,
      );
      throw new Error("Payment session creation failed");
    }
  } else if (gatewayType === "stripe") {
    try {
      const stripe = new Stripe(secretKey);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInFils,
        currency: currency.toLowerCase(),
        metadata: { orderId: orderId.toString() },
      });
      await Order.findByIdAndUpdate(orderId, {
        paymentIntentId: paymentIntent.id,
      });
      return {
        paymentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (err) {
      logger.error(`Stripe session failed: ${err.message}`);
      throw new Error("Payment session creation failed");
    }
  } else {
    throw new Error(`Unsupported gateway type: ${gatewayType}`);
  }
}

async function verifyWebhook(rawBody, signatureHeader, storeId) {
  const { gatewayType, secretKey } = await getStoreCredentials(storeId);

  if (gatewayType === "checkout") {
    // Determine expected signature using HMAC-SHA256
    const hmac = crypto.createHmac("sha256", secretKey);
    hmac.update(rawBody);
    const expectedSignature = hmac.digest("hex");

    const valid = crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature),
    );

    if (!valid) return { valid: false };

    const event = JSON.parse(rawBody.toString("utf8"));
    return {
      valid: true,
      eventType: event.type,
      paymentId: event.data?.id,
      event,
    };
  } else if (gatewayType === "stripe") {
    try {
      const stripe = new Stripe(secretKey);
      const event = stripe.webhooks.constructEvent(
        rawBody,
        signatureHeader,
        secretKey,
      );
      return {
        valid: true,
        eventType: event.type,
        paymentId: event.data?.object?.id,
        event,
      };
    } catch (err) {
      logger.error(
        `Stripe webhook signature verification failed: ${err.message}`,
      );
      return { valid: false };
    }
  }
  return { valid: false };
}

async function handleWebhookEvent(parsedEvent, storeId) {
  const { valid, eventType, paymentId, event } = parsedEvent;
  if (!valid) throw new Error("Invalid webhook signature");

  let order;
  if (
    event.type?.startsWith("payment_intent") ||
    event.type?.startsWith("charge")
  ) {
    // Stripe
    const orderId = event.data?.object?.metadata?.orderId;
    if (orderId) order = await Order.findById(orderId);
    if (!order) order = await Order.findOne({ paymentIntentId: paymentId });
  } else {
    // Checkout
    const orderId = event.data?.reference || event.data?.metadata?.orderId;
    if (orderId) order = await Order.findById(orderId);
    if (!order) order = await Order.findOne({ paymentIntentId: paymentId });
  }

  if (!order) {
    logger.warn(`Webhook ignored: Order not found for payment ${paymentId}`);
    return;
  }

  const user = await User.findOne({ uid: order.customerId });

  if (
    eventType === "payment_approved" ||
    eventType === "payment_intent.succeeded"
  ) {
    order.paymentStatus = "paid";
    order.status = "confirmed";
    await order.save();

    if (user && user.fcmToken) {
      await sendPushNotification(
        user.fcmToken,
        "Order Confirmed",
        "Your order is confirmed! We are preparing it now.",
        { orderId: order._id.toString() },
      );
    }
  } else if (
    eventType === "payment_declined" ||
    eventType === "payment_intent.payment_failed"
  ) {
    order.paymentStatus = "failed";

    // Restore stock via MongoDB session
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const item of order.cartSnapshot) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: item.qty } },
          { session },
        );
      }
      order.status = "cancelled";
      await order.save({ session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      logger.error(
        `Stock restore failed for order ${order._id} on payment decline`,
      );
      throw err;
    } finally {
      session.endSession();
    }
  } else if (
    eventType === "payment_refunded" ||
    eventType === "charge.refunded"
  ) {
    order.paymentStatus = "refunded";
    await order.save();
  } else {
    logger.info(`Unhandled webhook event type: ${eventType}`);
  }
}

async function verifyPayment(paymentId, storeId) {
  const { gatewayType, secretKey } = await getStoreCredentials(storeId);
  if (gatewayType === "checkout") {
    const url = `${env.CHECKOUT_API_URL || "https://api.sandbox.checkout.com"}/payments/${paymentId}`;
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      return {
        status: response.data.status,
        approved:
          response.data.status === "Authorized" ||
          response.data.status === "Captured",
      };
    } catch (err) {
      throw new Error("Failed to verify payment with Checkout.com");
    }
  } else if (gatewayType === "stripe") {
    const stripe = new Stripe(secretKey);
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
      return {
        status: paymentIntent.status,
        approved: paymentIntent.status === "succeeded",
      };
    } catch (err) {
      throw new Error("Failed to verify payment with Stripe");
    }
  }
}

async function refundPayment(paymentId, storeId, amount) {
  const { gatewayType, secretKey } = await getStoreCredentials(storeId);
  const amountInFils = amount ? Math.round(amount * 100) : undefined;

  if (gatewayType === "checkout") {
    const url = `${env.CHECKOUT_API_URL || "https://api.sandbox.checkout.com"}/payments/${paymentId}/refunds`;
    try {
      const response = await axios.post(
        url,
        amountInFils ? { amount: amountInFils } : {},
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      return { refundId: response.data.action_id, status: "success" };
    } catch (err) {
      logger.error(`Checkout refund failed: ${err.message}`);
      throw new Error("Refund failed");
    }
  } else if (gatewayType === "stripe") {
    const stripe = new Stripe(secretKey);
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentId,
        ...(amountInFils && { amount: amountInFils }),
      });
      return { refundId: refund.id, status: refund.status };
    } catch (err) {
      logger.error(`Stripe refund failed: ${err.message}`);
      throw new Error("Refund failed");
    }
  }
}

module.exports = {
  createPaymentSession,
  verifyWebhook,
  handleWebhookEvent,
  verifyPayment,
  refundPayment,
};
