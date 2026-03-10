const mongoose = require("mongoose");
const crypto = require("crypto");
const paymentService = require("../src/services/payment/paymentService");
const Order = require("../src/models/Order");
const Store = require("../src/models/Store");
const User = require("../src/models/User");
const Product = require("../src/models/Product");

jest.mock("../src/models/Order");
jest.mock("../src/models/Store");
jest.mock("../src/models/User");
jest.mock("../src/models/Product");
jest.mock("../src/services/fcm.service", () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true),
}));
jest.mock("axios");
jest.mock("../src/utils/encrypt", () => ({
  decrypt: jest.fn().mockReturnValue("secret"),
}));

describe("Payment Webhooks", () => {
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

  describe("verifyWebhook", () => {
    it("should return valid for correct Checkout.com HMAC", async () => {
      Store.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          payment: { gatewayType: "checkout", encryptedSecretKey: "enc_key" },
        }),
      });

      const rawBody = Buffer.from(
        JSON.stringify({ type: "payment_approved", data: { id: "pay1" } }),
      );
      const hmac = crypto.createHmac("sha256", "secret");
      hmac.update(rawBody);
      const signature = hmac.digest("hex");

      const result = await paymentService.verifyWebhook(
        rawBody,
        signature,
        "store1",
      );
      expect(result.valid).toBe(true);
      expect(result.eventType).toBe("payment_approved");
    });

    it("should return invalid for incorrect HMAC", async () => {
      Store.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          payment: { gatewayType: "checkout", encryptedSecretKey: "enc_key" },
        }),
      });

      const rawBody = Buffer.from(JSON.stringify({ type: "payment_approved" }));
      const result = await paymentService.verifyWebhook(
        rawBody,
        "invalid_sig",
        "store1",
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("handleWebhookEvent", () => {
    it("should confirm order and send FCM on payment_approved", async () => {
      const mockSave = jest.fn();
      Order.findOne.mockResolvedValue({
        _id: "order1",
        customerId: "user1",
        paymentStatus: "pending",
        status: "pending",
        save: mockSave,
      });
      User.findOne.mockResolvedValue({ fcmToken: "token" });

      await paymentService.handleWebhookEvent(
        {
          valid: true,
          eventType: "payment_approved",
          paymentId: "pay1",
          event: { type: "payment_approved", data: { id: "pay1" } },
        },
        "store1",
      );

      expect(mockSave).toHaveBeenCalled();
      const order = await Order.findOne();
      expect(order.paymentStatus).toBe("paid");
      expect(order.status).toBe("confirmed");
    });

    it("should restore stock on payment_declined", async () => {
      const mockSave = jest.fn();
      Order.findOne.mockResolvedValue({
        _id: "order1",
        customerId: "user1",
        cartSnapshot: [{ productId: "prod1", qty: 2 }],
        save: mockSave,
      });

      await paymentService.handleWebhookEvent(
        {
          valid: true,
          eventType: "payment_declined",
          paymentId: "pay1",
          event: { type: "payment_declined", data: { id: "pay1" } },
        },
        "store1",
      );

      expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
        "prod1",
        { $inc: { stock: 2 } },
        expect.any(Object),
      );
      expect(sessionMock.commitTransaction).toHaveBeenCalled();
    });
  });
});
