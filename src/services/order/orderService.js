/**
 * @file Order Service
 * @description Handles order creation, status updates with role checks, FCM pushes, and digital receipts.
 */
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const Order = require("../../models/Order");
const Product = require("../../models/Product");
const Store = require("../../models/Store");
const User = require("../../models/User");

const env = require("../../config/env");
const { sendPushNotification } = require("../fcm.service");
const { paginate } = require("../../utils/paginate");

async function createOrder(customerId, storeId, orderType, cartItems) {
  if (!cartItems || cartItems.length === 0) {
    throw new Error("Cart is empty");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const store = await Store.findById(storeId).session(session);
    if (!store) throw new Error("Store not found");

    let subtotal = 0;
    let vatAmount = 0;
    const cartSnapshot = [];

    // Atomic deduction and snapshot
    for (const item of cartItems) {
      // Find active product with sufficient stock
      const product = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          storeId,
          isActive: true,
          stock: { $gte: item.qty },
        },
        { $inc: { stock: -item.qty } },
        { session, new: true },
      );

      if (!product) {
        throw new Error(
          `Insufficient stock or inactive product for ID: ${item.productId}`,
        );
      }

      const itemTotal = product.price * item.qty;
      const itemVat = (itemTotal * (product.vatRate || 5)) / 100;

      subtotal += itemTotal;
      vatAmount += itemVat;

      cartSnapshot.push({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        qty: item.qty,
        vatRate: product.vatRate || 5,
        imageUrl:
          product.images && product.images.length > 0
            ? product.images[0]
            : null,
      });
    }

    const total = subtotal + vatAmount;

    // Create Order
    const order = new Order({
      customerId,
      storeId,
      orderType,
      status: "pending",
      paymentStatus: "pending",
      cartSnapshot,
      subtotal,
      vatAmount,
      total,
    });

    await order.save({ session });
    await session.commitTransaction();

    // FCM to Branch Manager asynchronously
    const branchManager = await User.findOne({
      storeId,
      role: "branchManager",
      status: "active",
    });
    if (branchManager && branchManager.fcmToken) {
      sendPushNotification(
        branchManager.fcmToken,
        "New Order Received",
        `A new ${orderType.replace("_", " ")} order has been placed.`,
        { orderId: order._id.toString() },
      ).catch((err) => {});
    }

    return order;
  } catch (err) {
    await session.abortTransaction();
    if (err.message.includes("Insufficient stock")) {
      const error = new Error(err.message);
      error.statusCode = 422;
      throw error;
    }
    throw err;
  } finally {
    session.endSession();
  }
}

async function updateOrderStatus(orderId, newStatus, actorId, actorRole) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  const oldStatus = order.status;

  if (actorRole === "branchManager") {
    const manager = await User.findOne({ uid: actorId });
    if (!manager || manager.storeId.toString() !== order.storeId.toString()) {
      throw new Error("Forbidden: Not your store");
    }
    const validTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["preparing", "cancelled"],
      preparing: ["ready"],
      ready: ["delivered"],
    };
    if (
      !validTransitions[oldStatus] ||
      !validTransitions[oldStatus].includes(newStatus)
    ) {
      throw new Error(
        `Invalid status transition from ${oldStatus} to ${newStatus} for branchManager`,
      );
    }
  } else if (actorRole === "customer") {
    if (order.customerId !== actorId)
      throw new Error("Forbidden: Not your order");
    if (newStatus !== "cancelled")
      throw new Error("Customer can only cancel orders");
    if (oldStatus !== "pending")
      throw new Error("Can only cancel pending orders");

    const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
    if (orderAgeMs > 5 * 60 * 1000) {
      throw new Error("Cancellation window of 5 minutes expired");
    }
  } else if (actorRole === "superAdmin") {
    if (newStatus !== "cancelled")
      throw new Error("SuperAdmin status update limited to cancelled");
  } else {
    throw new Error("Unauthorized actor role");
  }

  if (newStatus === "cancelled") {
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
      throw new Error(`Stock restore failed: ${err.message}`);
    } finally {
      session.endSession();
    }
  } else {
    order.status = newStatus;
    await order.save();
  }

  const customer = await User.findOne({ uid: order.customerId });
  if (customer && customer.fcmToken) {
    let title, body;
    if (newStatus === "confirmed") {
      title = "Order Confirmed";
      body = "Your order is confirmed! We are preparing it now.";
    } else if (newStatus === "ready") {
      title = "Order Ready";
      body = "Your order is ready. Walk straight out — no queue!";
    } else if (newStatus === "delivered" && order.orderType === "scan_and_go") {
      title = "Payment Confirmed";
      body = "Payment confirmed! You are all set. No waiting, no queue!";
    }

    if (title && body) {
      sendPushNotification(customer.fcmToken, title, body, {
        orderId: order._id.toString(),
      }).catch(() => {});
    }
  }

  return order;
}

async function getOrdersByStore(storeId, filters = {}) {
  const { page = 1, limit = 20, status, dateStart, dateEnd } = filters;
  const query = { storeId };
  if (status) query.status = status;
  if (dateStart || dateEnd) {
    query.createdAt = {};
    if (dateStart) query.createdAt.$gte = new Date(dateStart);
    if (dateEnd) query.createdAt.$lte = new Date(dateEnd);
  }

  const orderQuery = Order.find(query);
  return await paginate(orderQuery, { page, limit, sort: "-createdAt" });
}

async function getOrdersByCustomer(customerId, filters = {}) {
  const { page = 1, limit = 20 } = filters;
  const orderQuery = Order.find({ customerId });
  return await paginate(orderQuery, { page, limit, sort: "-createdAt" });
}

async function getOrderById(
  orderId,
  requestorId,
  requestorRole,
  requestorStoreId = null,
) {
  const order = await Order.findById(orderId).populate(
    "storeId",
    "name coverImage primaryColor logoUrl",
  );
  if (!order) throw new Error("Order not found");

  if (requestorRole === "customer" && order.customerId !== requestorId) {
    throw new Error("Forbidden: Not your order");
  }

  if (
    requestorRole === "branchManager" &&
    order.storeId._id.toString() !== requestorStoreId?.toString()
  ) {
    throw new Error("Forbidden: Not your store");
  }

  return order;
}

async function getDigitalReceipt(orderId) {
  const order = await Order.findById(orderId).populate(
    "storeId",
    "name logoUrl primaryColor location address",
  );
  if (!order) throw new Error("Order not found");

  const store = order.storeId;
  const receiptQrData = jwt.sign(
    { orderId: order._id.toString(), storeId: store._id.toString() },
    env.ENCRYPTION_KEY || "receipt_secret_fallback",
    { expiresIn: "1h" },
  );

  return {
    orderId: order._id,
    storeName: store.name,
    storeLogoUrl: store.logoUrl,
    storePrimaryColor: store.primaryColor,
    items: order.cartSnapshot.map((item) => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      vatRate: item.vatRate,
    })),
    subtotal: order.subtotal,
    vatAmount: order.vatAmount,
    total: order.total,
    paymentMethod: order.paymentIntentId
      ? order.paymentIntentId.startsWith("pi_")
        ? "Stripe"
        : "Checkout.com"
      : "Unknown",
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    receiptQrData,
  };
}

module.exports = {
  createOrder,
  updateOrderStatus,
  getOrdersByStore,
  getOrdersByCustomer,
  getOrderById,
  getDigitalReceipt,
};
