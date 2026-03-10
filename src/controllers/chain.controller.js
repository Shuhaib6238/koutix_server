/**
 * @file Chain manager controller — branch management.
 * @description Add, list, update, delete branches under a chain.
 */
const { z } = require("zod");
const crypto = require("crypto");
const { getAuth } = require("../config/firebase");
const User = require("../models/User");
const Chain = require("../models/Chain");
const Store = require("../models/Store");
const Order = require("../models/Order");
const { encrypt } = require("../utils/encrypt");
const { sendBranchInviteEmail } = require("../services/resend.service");
const { success, error } = require("../utils/response");
const { paginate } = require("../utils/paginate");
const logger = require("../utils/logger");

// ─── Zod Schemas ─────────────────────────────────────────

const addBranchSchema = z.object({
  branchName: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  managerName: z.string().min(1),
  managerEmail: z.string().email(),
  managerPhone: z.string().optional(),
  posSystem: z.string().optional(),
});

const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  managerName: z.string().optional(),
  managerPhone: z.string().optional(),
  operatingHours: z
    .array(
      z.object({
        day: z.string(),
        open: z.string(),
        close: z.string(),
      }),
    )
    .optional(),
});

// ─── Controllers ─────────────────────────────────────────

/**
 * POST /chain/branches — Create branch + invited User + send Resend invite email.
 */
async function addBranch(req, res, next) {
  try {
    const data = addBranchSchema.parse(req.body);

    // Find the chain owned by this user
    const chain = await Chain.findOne({ ownerId: req.user.uid });
    if (!chain) {
      return error(res, { statusCode: 404, message: "Chain not found" });
    }

    // Check if manager email is already used
    const existingUser = await User.findOne({
      email: data.managerEmail.toLowerCase(),
    });
    if (existingUser) {
      return error(res, {
        statusCode: 409,
        message: "Manager email already in use",
      });
    }

    // 1. Create Store
    const store = await Store.create({
      chainId: chain._id,
      name: data.branchName,
      address: data.address || null,
      city: data.city || null,
      location: {
        type: "Point",
        coordinates: [data.lng || 0, data.lat || 0],
      },
      managerName: data.managerName,
      managerEmail: data.managerEmail,
      managerPhone: data.managerPhone || null,
      accountType: "chain",
      primaryColor: chain.primaryColor,
      logoUrl: chain.logoUrl,
      payment: {
        gatewayType: chain.payment?.gatewayType || null,
        encryptedSecretKey: chain.payment?.encryptedSecretKey || null,
        publicKey: chain.payment?.publicKey || null,
      },
      pos: { type: data.posSystem || null },
      status: "pending_setup",
    });

    // 2. Create User with invite token
    const inviteToken = crypto.randomUUID();
    const inviteTokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // Create Firebase user (without password — manager sets it via invite)
    const firebaseUser = await getAuth().createUser({
      email: data.managerEmail,
      displayName: data.managerName,
    });

    await getAuth().setCustomUserClaims(firebaseUser.uid, {
      role: "branchManager",
      accountType: "chain",
    });

    const manager = await User.create({
      uid: firebaseUser.uid,
      email: data.managerEmail.toLowerCase(),
      fullName: data.managerName,
      phone: data.managerPhone || null,
      role: "branchManager",
      accountType: "chain",
      storeId: store._id,
      chainId: chain._id,
      status: "invited",
      inviteToken,
      inviteTokenExpiry,
    });

    // 3. Send invite email via Resend
    try {
      await sendBranchInviteEmail({
        to: data.managerEmail,
        managerName: data.managerName,
        chainName: chain.name,
        branchName: data.branchName,
        inviteToken,
        from: process.env.RESEND_FROM || "noreply@koutix.com",
        frontendUrl: process.env.FRONTEND_URL || "https://admin.koutix.com",
      });
    } catch (emailErr) {
      logger.error(`Failed to send invite email: ${emailErr.message}`);
      // Don't fail the request — email can be resent
    }

    // 4. Return response
    return success(res, {
      statusCode: 201,
      message: "Branch created and invite sent",
      data: {
        branch: store,
        manager: {
          email: manager.email,
          status: manager.status,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /chain/branches — List all branches with status, ordersToday, syncStatus.
 */
async function listBranches(req, res, next) {
  try {
    const chain = await Chain.findOne({ ownerId: req.user.uid });
    if (!chain) {
      return error(res, { statusCode: 404, message: "Chain not found" });
    }

    const query = Store.find({
      chainId: chain._id,
      status: { $ne: "deactivated" },
    });
    const { docs: branches, meta } = await paginate(query, req.query);

    // Enrich with ordersToday count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = await Promise.all(
      branches.map(async (branch) => {
        const ordersToday = await Order.countDocuments({
          storeId: branch._id,
          createdAt: { $gte: today },
        });
        return {
          ...branch,
          ordersToday,
          syncStatus: branch.pos?.syncStatus || "never",
        };
      }),
    );

    return success(res, {
      data: enriched,
      meta,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /chain/branches/:id — Update branch details.
 */
async function updateBranch(req, res, next) {
  try {
    const data = updateBranchSchema.parse(req.body);
    const chain = await Chain.findOne({ ownerId: req.user.uid });
    if (!chain) {
      return error(res, { statusCode: 404, message: "Chain not found" });
    }

    const store = await Store.findOneAndUpdate(
      { _id: req.params.id, chainId: chain._id },
      { $set: data },
      { new: true, runValidators: true },
    );

    if (!store) {
      return error(res, { statusCode: 404, message: "Branch not found" });
    }

    return success(res, {
      message: "Branch updated",
      data: store,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /chain/branches/:id — Soft delete (status: deactivated).
 */
async function deleteBranch(req, res, next) {
  try {
    const chain = await Chain.findOne({ ownerId: req.user.uid });
    if (!chain) {
      return error(res, { statusCode: 404, message: "Chain not found" });
    }

    const store = await Store.findOneAndUpdate(
      { _id: req.params.id, chainId: chain._id },
      { status: "deactivated" },
      { new: true },
    );

    if (!store) {
      return error(res, { statusCode: 404, message: "Branch not found" });
    }

    // Suspend the branch manager user
    await User.updateMany(
      { storeId: store._id, role: "branchManager" },
      { status: "suspended" },
    );

    return success(res, {
      message: "Branch deactivated",
      data: { _id: store._id, status: store.status },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { addBranch, listBranches, updateBranch, deleteBranch };
