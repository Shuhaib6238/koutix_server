/**
 * @file POS routes — status and sync endpoints.
 */
const { Router } = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const Store = require("../models/Store");
const PosConfig = require("../models/PosConfig");
const { success, error } = require("../utils/response");

const router = Router();

/**
 * GET /pos/status/:storeId — Get POS sync status.
 */
router.get("/status/:storeId", authenticate, async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.storeId)
      .select("pos name")
      .lean();
    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    const posConfig = await PosConfig.findOne({ storeId: store._id }).lean();

    return success(res, {
      data: {
        storeName: store.name,
        posType: store.pos?.type || "manual",
        lastSyncAt: store.pos?.lastSyncAt || null,
        syncStatus: store.pos?.syncStatus || "never",
        config: posConfig,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /pos/sync/:storeId — Trigger manual sync.
 */
router.post(
  "/sync/:storeId",
  authenticate,
  requireRole("branchManager", "chainManager", "superAdmin"),
  async (req, res, next) => {
    try {
      const store = await Store.findById(req.params.storeId);
      if (!store)
        return error(res, { statusCode: 404, message: "Store not found" });

      store.pos = store.pos || {};
      store.pos.syncStatus = "syncing";
      await store.save();

      // TODO: Enqueue BullMQ job for immediate sync
      return success(res, {
        message: "POS sync triggered",
        data: { syncStatus: "syncing" },
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
