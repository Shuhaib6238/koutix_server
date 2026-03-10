/**
 * @file Auth controller — handles all signup and authentication flows.
 * @description Chain signup, standalone signup, sync-user, set-password.
 */
const { z } = require("zod");
const crypto = require("crypto");
const { getAuth } = require("../config/firebase");
const User = require("../models/User");
const Chain = require("../models/Chain");
const Store = require("../models/Store");
const { encrypt } = require("../utils/encrypt");
const {
  createCustomer,
  createTrialSubscription,
} = require("../services/stripe.service");
const { success, error } = require("../utils/response");
const logger = require("../utils/logger");

// ─── Zod Schemas ─────────────────────────────────────────

/** Fields that must be REJECTED if sent (400 error) */
const REJECTED_FIELDS = [
  "vatTrn",
  "hqAddress",
  "tradeLicense",
  "expectedBranchCount",
];

const chainSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  chainName: z.string().min(1),
  posSystem: z.string().optional(),
  primaryColor: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  planType: z.enum(["chain_starter", "chain_growth", "chain_enterprise"]),
  paymentGatewayType: z.enum(["checkout", "stripe"]).optional(),
  paymentSecretKey: z.string().optional(),
  paymentPublicKey: z.string().optional(),
});

const standaloneSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  storeName: z.string().min(1),
  address: z.string().optional(),
  posSystem: z.string().optional(),
  primaryColor: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  planType: z.enum(["single_starter", "single_growth"]),
  paymentGatewayType: z.enum(["checkout", "stripe"]).optional(),
  paymentSecretKey: z.string().optional(),
  paymentPublicKey: z.string().optional(),
});

const setPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

// ─── Helpers ─────────────────────────────────────────────

/**
 * Check for rejected fields and return 400 if any found.
 */
function checkRejectedFields(body) {
  const found = REJECTED_FIELDS.filter((f) => body[f] !== undefined);
  if (found.length > 0) {
    return `These fields are not accepted: ${found.join(", ")}`;
  }
  return null;
}

// ─── Controllers ─────────────────────────────────────────

/**
 * POST /auth/signup/chain — Chain Manager Signup
 * Full flow: email check → Firebase createUser → custom claims →
 * Chain doc → User doc → Stripe trial → response
 */
async function signupChain(req, res, next) {
  try {
    // Check for rejected fields
    const rejectedMsg = checkRejectedFields(req.body);
    if (rejectedMsg) {
      return error(res, { statusCode: 400, message: rejectedMsg });
    }

    const data = chainSignupSchema.parse(req.body);

    // 1. Check email uniqueness BEFORE Firebase user creation (avoid orphans)
    const existingUser = await User.findOne({
      email: data.email.toLowerCase(),
    });
    if (existingUser) {
      return error(res, {
        statusCode: 409,
        message: "Email already registered",
      });
    }

    // Also check Firebase
    try {
      await getAuth().getUserByEmail(data.email);
      return error(res, {
        statusCode: 409,
        message: "Email already registered",
      });
    } catch (fbErr) {
      if (fbErr.code !== "auth/user-not-found") throw fbErr;
    }

    // 2. Firebase Admin createUser
    const firebaseUser = await getAuth().createUser({
      email: data.email,
      password: data.password,
      displayName: data.fullName,
    });

    // 3. Set custom claims
    await getAuth().setCustomUserClaims(firebaseUser.uid, {
      role: "chainManager",
      accountType: "chain",
    });

    // 4. Create Chain document
    const chain = await Chain.create({
      name: data.chainName,
      ownerId: firebaseUser.uid,
      primaryColor: data.primaryColor || "#A9ED42",
      logoUrl: data.logoUrl || null,
      posSystem: data.posSystem || null,
      payment: {
        gatewayType: data.paymentGatewayType || null,
        encryptedSecretKey: data.paymentSecretKey
          ? encrypt(data.paymentSecretKey)
          : null,
        publicKey: data.paymentPublicKey || null,
      },
    });

    // 5. Create User document
    const user = await User.create({
      uid: firebaseUser.uid,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      fullName: data.fullName,
      role: "chainManager",
      accountType: "chain",
      chainId: chain._id,
      status: "active",
    });

    // 6. Stripe: createCustomer → createSubscription(planType, trial_period_days:14)
    let stripeClientSecret = null;
    try {
      const stripeCustomer = await createCustomer({
        email: data.email,
        name: data.fullName,
        metadata: { chainId: chain._id.toString(), role: "chainManager" },
      });

      const subscription = await createTrialSubscription({
        customerId: stripeCustomer.id,
        planType: data.planType,
      });

      // Update chain with Stripe IDs
      chain.stripeCustomerId = stripeCustomer.id;
      chain.stripeSubscriptionId = subscription.id;
      chain.subscription = {
        planType: data.planType,
        status: "trial",
        trialEndsAt: new Date(subscription.trial_end * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      };
      await chain.save();

      // Get client secret for frontend payment setup
      stripeClientSecret =
        subscription.latest_invoice?.payment_intent?.client_secret || null;
    } catch (stripeErr) {
      logger.error(`Stripe error during chain signup: ${stripeErr.message}`);
      // Don't fail signup if Stripe fails — subscription can be set up later
    }

    // 7. Return response
    return success(res, {
      statusCode: 201,
      message: "Chain account created successfully",
      data: {
        user: {
          _id: user._id,
          uid: user.uid,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        chain: {
          _id: chain._id,
          name: chain.name,
          subscription: chain.subscription,
        },
        stripeClientSecret,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/signup/standalone — Standalone Store Signup
 * Full flow: email check → Firebase createUser → custom claims →
 * Store doc → User doc → Stripe trial → response
 */
async function signupStandalone(req, res, next) {
  try {
    // Check for rejected fields
    const rejectedMsg = checkRejectedFields(req.body);
    if (rejectedMsg) {
      return error(res, { statusCode: 400, message: rejectedMsg });
    }

    const data = standaloneSignupSchema.parse(req.body);

    // 1. Email uniqueness check before Firebase
    const existingUser = await User.findOne({
      email: data.email.toLowerCase(),
    });
    if (existingUser) {
      return error(res, {
        statusCode: 409,
        message: "Email already registered",
      });
    }

    try {
      await getAuth().getUserByEmail(data.email);
      return error(res, {
        statusCode: 409,
        message: "Email already registered",
      });
    } catch (fbErr) {
      if (fbErr.code !== "auth/user-not-found") throw fbErr;
    }

    // 2. Firebase Admin createUser
    const firebaseUser = await getAuth().createUser({
      email: data.email,
      password: data.password,
      displayName: data.fullName,
    });

    // 3. Set custom claims
    await getAuth().setCustomUserClaims(firebaseUser.uid, {
      role: "branchManager",
      accountType: "standalone",
    });

    // 4. Create Store document
    const store = await Store.create({
      chainId: null,
      name: data.storeName,
      address: data.address || null,
      accountType: "standalone",
      primaryColor: data.primaryColor || "#A9ED42",
      logoUrl: data.logoUrl || null,
      pos: { type: data.posSystem || null },
      payment: {
        gatewayType: data.paymentGatewayType || null,
        encryptedSecretKey: data.paymentSecretKey
          ? encrypt(data.paymentSecretKey)
          : null,
        publicKey: data.paymentPublicKey || null,
      },
      status: "active",
    });

    // 5. Create User document
    const user = await User.create({
      uid: firebaseUser.uid,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      fullName: data.fullName,
      role: "branchManager",
      accountType: "standalone",
      storeId: store._id,
      status: "active",
    });

    // 6. Stripe trial subscription
    let stripeClientSecret = null;
    try {
      const stripeCustomer = await createCustomer({
        email: data.email,
        name: data.fullName,
        metadata: { storeId: store._id.toString(), role: "branchManager" },
      });

      const subscription = await createTrialSubscription({
        customerId: stripeCustomer.id,
        planType: data.planType,
      });

      store.stripeCustomerId = stripeCustomer.id;
      store.stripeSubscriptionId = subscription.id;
      store.subscription = {
        planType: data.planType,
        status: "trial",
        trialEndsAt: new Date(subscription.trial_end * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      };
      await store.save();

      stripeClientSecret =
        subscription.latest_invoice?.payment_intent?.client_secret || null;
    } catch (stripeErr) {
      logger.error(
        `Stripe error during standalone signup: ${stripeErr.message}`,
      );
    }

    // 7. Return response
    return success(res, {
      statusCode: 201,
      message: "Standalone store account created successfully",
      data: {
        user: {
          _id: user._id,
          uid: user.uid,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        store: {
          _id: store._id,
          name: store.name,
          subscription: store.subscription,
        },
        stripeClientSecret,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/sync-user — After any Firebase login
 * Verify token → upsert User in MongoDB → return user with role and storeId/chainId
 */
async function syncUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return error(res, {
        statusCode: 401,
        message: "Missing Authorization header",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await getAuth().verifyIdToken(idToken);

    // Upsert user in MongoDB
    const user = await User.findOneAndUpdate(
      { uid: decoded.uid },
      {
        uid: decoded.uid,
        email: decoded.email || null,
        role: decoded.role || "customer",
        accountType: decoded.accountType || null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    return success(res, {
      data: {
        user,
        role: user.role,
        storeId: user.storeId || null,
        chainId: user.chainId || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/set-password — Branch manager activates invite
 * Body: { token, password }
 * 1. Find User by inviteToken where inviteTokenExpiry > now
 * 2. Firebase Admin setPassword
 * 3. Activate User + Store
 */
async function setPassword(req, res, next) {
  try {
    const data = setPasswordSchema.parse(req.body);

    // 1. Find user by invite token
    const user = await User.findOne({
      inviteToken: data.token,
      inviteTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return error(res, {
        statusCode: 400,
        message: "Invalid or expired invite link",
      });
    }

    // 2. Firebase Admin — update password
    await getAuth().updateUser(user.uid, { password: data.password });

    // 3. Activate user
    user.status = "active";
    user.inviteToken = null;
    user.inviteTokenExpiry = null;
    await user.save();

    // 4. Activate associated store
    if (user.storeId) {
      await Store.findByIdAndUpdate(user.storeId, { status: "active" });
    }

    return success(res, {
      message: "Account activated successfully",
      data: { email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signupChain,
  signupStandalone,
  syncUser,
  setPassword,
};
