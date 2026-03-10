/**
 * @file Order Controller
 * @description Express controller for order management.
 */
const { success, error } = require("../utils/response");
const orderService = require("../services/order/orderService");

exports.createOrder = async (req, res, next) => {
  try {
    const { storeId, orderType, cartItems } = req.body;
    const customerId = req.user.uid;
    const order = await orderService.createOrder(
      customerId,
      storeId,
      orderType,
      cartItems,
    );
    return success(res, {
      statusCode: 201,
      message: "Order created successfully",
      data: order,
    });
  } catch (err) {
    if (err.statusCode === 422)
      return error(res, { statusCode: 422, message: err.message });
    next(err);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const { id } = req.params;
    const actorId = req.user.uid;
    const actorRole = req.user.role;

    const order = await orderService.updateOrderStatus(
      id,
      status,
      actorId,
      actorRole,
    );
    return success(res, { message: "Order status updated", data: order });
  } catch (err) {
    if (
      err.message.includes("Forbidden") ||
      err.message.includes("Unauthorized")
    ) {
      return error(res, { statusCode: 403, message: err.message });
    }
    if (
      err.message.includes("Invalid status") ||
      err.message.includes("cancel")
    ) {
      return error(res, { statusCode: 400, message: err.message });
    }
    next(err);
  }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const customerId = req.user.uid;
    const { page, limit } = req.query;
    const result = await orderService.getOrdersByCustomer(customerId, {
      page,
      limit,
    });
    return success(res, { data: result.docs, meta: result.meta });
  } catch (err) {
    next(err);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requestorId = req.user.uid;
    const requestorRole = req.user.role;
    const requestorStoreId = req.user.storeId;

    const order = await orderService.getOrderById(
      id,
      requestorId,
      requestorRole,
      requestorStoreId,
    );
    return success(res, { data: order });
  } catch (err) {
    if (err.message.includes("Forbidden"))
      return error(res, { statusCode: 403, message: err.message });
    if (err.message.includes("not found"))
      return error(res, { statusCode: 404, message: err.message });
    next(err);
  }
};

exports.getBranchOrders = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    if (!storeId)
      return error(res, {
        statusCode: 400,
        message: "Branch manager has no associated store",
      });

    const { page, limit, status, dateStart, dateEnd } = req.query;

    // Default to today if not provided via query
    let start = dateStart;
    let end = dateEnd;
    if (!start && !end) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      start = today.toISOString();
    }

    const result = await orderService.getOrdersByStore(storeId, {
      page,
      limit,
      status,
      dateStart: start,
      dateEnd: end,
    });
    return success(res, { data: result.docs, meta: result.meta });
  } catch (err) {
    next(err);
  }
};

exports.getDigitalReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    // basic IDOR check via getOrderById first
    const requestorId = req.user.uid;
    const requestorRole = req.user.role;
    const requestorStoreId = req.user.storeId;

    await orderService.getOrderById(
      id,
      requestorId,
      requestorRole,
      requestorStoreId,
    );

    const receipt = await orderService.getDigitalReceipt(id);
    return success(res, { data: receipt });
  } catch (err) {
    if (err.message.includes("Forbidden"))
      return error(res, { statusCode: 403, message: err.message });
    if (err.message.includes("not found"))
      return error(res, { statusCode: 404, message: err.message });
    next(err);
  }
};
