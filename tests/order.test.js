const mongoose = require("mongoose");
const orderService = require("../src/services/order/orderService");
const Order = require("../src/models/Order");
const Product = require("../src/models/Product");
const Store = require("../src/models/Store");
const User = require("../src/models/User");

// Mocks
jest.mock("../src/models/Order");
jest.mock("../src/models/Product");
jest.mock("../src/models/Store");
jest.mock("../src/models/User");
jest.mock("../src/services/fcm.service", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
}));

describe("Order Service", () => {
  let sessionMock;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionMock = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    mongoose.startSession = jest.fn().mockResolvedValue(sessionMock);
  });

  describe("createOrder", () => {
    it("should successfully create an order and deduct stock atomically", async () => {
      Store.findById.mockReturnValue({
        session: jest
          .fn()
          .mockResolvedValue({ _id: "store1", status: "active", isLive: true }),
      });
      Product.findOneAndUpdate.mockResolvedValue({
        _id: "prod1",
        sku: "SKU1",
        name: "Apple",
        price: 10,
        vatRate: 5,
        images: ["img.jpg"],
      });
      User.findOne.mockResolvedValue({ fcmToken: "branch-manager-token" });
      Order.prototype.save = jest.fn().mockResolvedValue(true);

      const order = await orderService.createOrder(
        "user1",
        "store1",
        "pickup",
        [{ productId: "prod1", qty: 2 }],
      );

      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        { $inc: { stock: -2 } },
        expect.any(Object),
      );
      expect(sessionMock.commitTransaction).toHaveBeenCalled();
      expect(order).toBeDefined();
      expect(order.subtotal).toBe(20);
      expect(order.vatAmount).toBe(1); // 5% of 20
    });

    it("should rollback transaction if stock is insufficient", async () => {
      Store.findById.mockReturnValue({
        session: jest
          .fn()
          .mockResolvedValue({ _id: "store1", status: "active", isLive: true }),
      });
      Product.findOneAndUpdate.mockResolvedValue(null); // Insufficient stock

      await expect(
        orderService.createOrder("user1", "store1", "pickup", [
          { productId: "prod1", qty: 2 },
        ]),
      ).rejects.toThrow("Insufficient stock");
      expect(sessionMock.abortTransaction).toHaveBeenCalled();
    });
  });

  describe("getOrderById (IDOR check)", () => {
    it("should deny access if customer requests someone else's order", async () => {
      Order.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "order1",
          customerId: "user1",
          storeId: { _id: "store1" },
        }),
      });

      await expect(
        orderService.getOrderById("order1", "user2", "customer"),
      ).rejects.toThrow("Forbidden");
    });

    it("should deny access if branchManager requests order from another store", async () => {
      Order.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "order1",
          customerId: "user1",
          storeId: { _id: "store1" },
        }),
      });

      await expect(
        orderService.getOrderById(
          "order1",
          "manager1",
          "branchManager",
          "store2",
        ),
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("updateOrderStatus", () => {
    it("should allow branchManager to transition from pending to confirmed", async () => {
      Order.findById.mockResolvedValue({
        _id: "order1",
        status: "pending",
        storeId: "store1",
        customerId: "user1",
        save: jest.fn().mockResolvedValue(true),
      });
      User.findOne.mockResolvedValue({ fcmToken: "customer-token" });
      // actor role check
      User.findOne.mockResolvedValueOnce({
        uid: "manager1",
        storeId: "store1",
      }); // For manager ownership check

      const order = await orderService.updateOrderStatus(
        "order1",
        "confirmed",
        "manager1",
        "branchManager",
      );
      expect(order.status).toBe("confirmed");
    });

    it("should restore stock when order is cancelled", async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      Order.findById.mockResolvedValue({
        _id: "order1",
        status: "pending",
        storeId: "store1",
        customerId: "user1",
        createdAt: new Date(),
        cartSnapshot: [{ productId: "prod1", qty: 2 }],
        save: mockSave,
      });

      Product.findByIdAndUpdate.mockResolvedValue(true);

      await orderService.updateOrderStatus(
        "order1",
        "cancelled",
        "user1",
        "customer",
      );

      expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
        "prod1",
        { $inc: { stock: 2 } },
        expect.any(Object),
      );
      expect(sessionMock.commitTransaction).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
    });
  });
});
