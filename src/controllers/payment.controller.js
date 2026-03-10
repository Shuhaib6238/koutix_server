const { success, error } = require("../utils/response");
const paymentService = require("../services/payment/paymentService");
const Order = require("../models/Order");

exports.createSession = async (req, res, next) => {
  try {
    const { orderId, storeId, amount, currency } = req.body;
    const session = await paymentService.createPaymentSession(
      orderId,
      storeId,
      amount,
      currency,
    );
    return success(res, { data: session });
  } catch (err) {
    next(err);
  }
};

exports.webhook = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const signature =
      req.headers["cko-signature"] || req.headers["stripe-signature"];
    const rawBody = req.body; // Buffer from express.raw()

    const parsedEvent = await paymentService.verifyWebhook(
      rawBody,
      signature,
      storeId,
    );
    if (!parsedEvent.valid) {
      return error(res, {
        statusCode: 401,
        message: "Invalid webhook signature",
      });
    }

    await paymentService.handleWebhookEvent(parsedEvent, storeId);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook processing error:", err.message);
    return res.status(200).send("OK");
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { paymentId, storeId } = req.body;
    const result = await paymentService.verifyPayment(paymentId, storeId);
    return success(res, { data: result });
  } catch (err) {
    next(err);
  }
};

exports.refundPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { amount } = req.body;

    const order = await Order.findById(orderId);
    if (!order)
      return error(res, { statusCode: 404, message: "Order not found" });

    const result = await paymentService.refundPayment(
      order.paymentIntentId,
      order.storeId,
      amount,
    );
    return success(res, { data: result });
  } catch (err) {
    next(err);
  }
};
