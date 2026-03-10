/**
 * @file Branch manager controller — inventory, orders, POS.
 * @description APIs for branch managers to manage their store.
 */
const Store = require("../models/Store");
const Product = require("../models/Product");
const Order = require("../models/Order");
const PosConfig = require("../models/PosConfig");
const User = require("../models/User");
const { success, error } = require("../utils/response");
const { paginate } = require("../utils/paginate");

/**
 * Get the store for the current branch manager.
 */
async function getManagerStore(req) {
  const user = await User.findOne({ uid: req.user.uid });
  if (!user || !user.storeId) return null;
  return Store.findById(user.storeId);
}

/**
 * GET /branch/orders — List orders for manager's store.
 */
async function getOrders(req, res, next) {
  try {
    const store = await getManagerStore(req);
    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    const filter = { storeId: store._id };
    if (req.query.status) filter.status = req.query.status;

    const query = Order.find(filter);
    const { docs, meta } = await paginate(query, req.query);

    return success(res, { data: docs, meta });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /orders/:id/status — Update order status.
 * TODO:RASHID — Extend with payment status validation.
 */
async function updateOrderStatus(req, res, next) {
  try {
    const { status } = req.body;
    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivered",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return error(res, {
        statusCode: 400,
        message: `Invalid status. Must be: ${validStatuses.join(", ")}`,
      });
    }

    const store = await getManagerStore(req);
    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, storeId: store._id },
      { status },
      { new: true },
    );

    if (!order)
      return error(res, { statusCode: 404, message: "Order not found" });

    return success(res, { data: order });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /branch/inventory — List all products for manager's store.
 */
async function getInventory(req, res, next) {
  try {
    const store = await getManagerStore(req);
    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    const filter = { storeId: store._id };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) filter.$text = { $search: req.query.search };

    const query = Product.find(filter);
    const { docs, meta } = await paginate(query, req.query);

    return success(res, { data: docs, meta });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /branch/products/:id — Update a product.
 */
async function updateProduct(req, res, next) {
  try {
    const store = await getManagerStore(req);
    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    const allowedFields = [
      "name",
      "price",
      "comparePrice",
      "stock",
      "description",
      "category",
      "images",
      "isActive",
    ];
    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, storeId: store._id },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!product)
      return error(res, { statusCode: 404, message: "Product not found" });

    return success(res, { data: product });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /branch/pos/status — Get POS sync status.
 */
async function getPosStatus(req, res, next) {
  try {
    const store = await getManagerStore(req);
    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    const posConfig = await PosConfig.findOne({ storeId: store._id }).lean();

    return success(res, {
      data: {
        type: store.pos?.type || "manual",
        lastSyncAt: store.pos?.lastSyncAt || null,
        syncStatus: store.pos?.syncStatus || "never",
        config: posConfig || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /branch/pos/sync — Trigger manual POS sync.
 */
async function triggerPosSync(req, res, next) {
  try {
    const store = await getManagerStore(req);
    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    // Update sync status to syncing
    store.pos = store.pos || {};
    store.pos.syncStatus = "syncing";
    await store.save();

    // TODO: Trigger BullMQ job for actual sync
    // For now, return a pending status
    return success(res, {
      message: "POS sync triggered",
      data: { syncStatus: "syncing" },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /branch/pos/test — Test POS connection.
 */
async function testPosConnection(req, res, next) {
  try {
    const store = await getManagerStore(req);
    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    // Basic connection test
    return success(res, {
      message: "POS connection test",
      data: {
        posType: store.pos?.type || "manual",
        connected: store.pos?.type !== "manual",
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOrders,
  updateOrderStatus,
  getInventory,
  updateProduct,
  getPosStatus,
  triggerPosSync,
  testPosConnection,
};
