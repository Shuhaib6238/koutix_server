/**
 * @file Admin controller — Super Admin APIs.
 * @description Platform stats, store management, user management, promotions.
 */
const Store = require("../models/Store");
const User = require("../models/User");
const Chain = require("../models/Chain");
const { getAuth } = require("../config/firebase");
const { success, error } = require("../utils/response");
const { paginate } = require("../utils/paginate");

/**
 * GET /admin/stats — Platform statistics.
 * Returns: totalStores, MRR, activeSubscriptions, trialStores.
 */
async function getStats(req, res, next) {
  try {
    const [
      totalStores,
      activeSubscriptions,
      trialStores,
      totalUsers,
      totalChains,
    ] = await Promise.all([
      Store.countDocuments({ status: { $ne: "deactivated" } }),
      Store.countDocuments({ "subscription.status": "active" }),
      Store.countDocuments({ "subscription.status": "trial" }),
      User.countDocuments(),
      Chain.countDocuments(),
    ]);

    // Calculate MRR from active chain and store subscriptions
    const activeChains = await Chain.countDocuments({
      "subscription.status": "active",
    });
    const trialChains = await Chain.countDocuments({
      "subscription.status": "trial",
    });

    return success(res, {
      data: {
        totalStores,
        totalChains,
        totalUsers,
        activeSubscriptions: activeSubscriptions + activeChains,
        trialStores: trialStores + trialChains,
        // MRR would ideally come from Stripe — this is a simplified count
        MRR: "See Stripe Dashboard for accurate MRR",
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/stores — All stores, paginated, filterable.
 */
async function getAllStores(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.accountType) filter.accountType = req.query.accountType;
    if (req.query.isApproved !== undefined)
      filter.isApproved = req.query.isApproved === "true";
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { city: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const query = Store.find(filter).populate("chainId", "name");
    const { docs, meta } = await paginate(query, req.query);

    return success(res, { data: docs, meta });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /admin/stores/:id/approve — Approve a store.
 */
async function approveStore(req, res, next) {
  try {
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, status: "active" },
      { new: true },
    );

    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    return success(res, { message: "Store approved", data: store });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /admin/stores/:id/subscription — Update store subscription.
 */
async function updateStoreSubscription(req, res, next) {
  try {
    const { planType, status } = req.body;
    const update = {};
    if (planType) update["subscription.planType"] = planType;
    if (status) update["subscription.status"] = status;

    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true },
    );

    if (!store)
      return error(res, { statusCode: 404, message: "Store not found" });

    return success(res, { message: "Subscription updated", data: store });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/users — All users, paginated.
 */
async function getUsers(req, res, next) {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { email: { $regex: req.query.search, $options: "i" } },
        { fullName: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const query = User.find(filter);
    const { docs, meta } = await paginate(query, req.query);

    return success(res, { data: docs, meta });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /admin/users/:id/role — Update user role (Firebase custom claim + MongoDB).
 */
async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    const validRoles = [
      "superAdmin",
      "chainManager",
      "branchManager",
      "customer",
    ];

    if (!validRoles.includes(role)) {
      return error(res, {
        statusCode: 400,
        message: `Invalid role. Must be: ${validRoles.join(", ")}`,
      });
    }

    const user = await User.findById(req.params.id);
    if (!user)
      return error(res, { statusCode: 404, message: "User not found" });

    // Update Firebase custom claims
    await getAuth().setCustomUserClaims(user.uid, {
      role,
      accountType: user.accountType,
    });

    // Update MongoDB
    user.role = role;
    await user.save();

    return success(res, {
      message: "User role updated",
      data: { _id: user._id, email: user.email, role },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/promotions — List promoted stores.
 */
async function getPromotions(req, res, next) {
  try {
    const query = Store.find({ isPromoted: true }).select(
      "name city isPromoted promotionExpiresAt",
    );
    const { docs, meta } = await paginate(query, req.query);

    return success(res, { data: docs, meta });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  getAllStores,
  approveStore,
  updateStoreSubscription,
  getUsers,
  updateUserRole,
  getPromotions,
};
