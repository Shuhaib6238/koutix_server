/**
 * @file Store controller — public store endpoints + customer-facing APIs.
 */
const Store = require("../models/Store");
const Product = require("../models/Product");
const { success, error } = require("../utils/response");
const { paginate } = require("../utils/paginate");

/**
 * GET /stores/nearby?lat=&lng=&radius=
 * Geospatial query — promoted stores first in results.
 */
async function getNearbyStores(req, res, next) {
  try {
    const { lat, lng, radius = 10000 } = req.query; // radius in meters, default 10km

    if (!lat || !lng) {
      return error(res, {
        statusCode: 400,
        message: "lat and lng query params required",
      });
    }

    const stores = await Store.find({
      status: "active",
      isApproved: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(radius, 10),
        },
      },
    })
      .sort({ isPromoted: -1 }) // Promoted first
      .limit(50)
      .lean();

    return success(res, { data: stores });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /stores/promoted?lat=&lng=
 * 20km radius — for app carousel.
 */
async function getPromotedStores(req, res, next) {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return error(res, {
        statusCode: 400,
        message: "lat and lng query params required",
      });
    }

    const stores = await Store.find({
      status: "active",
      isApproved: true,
      isPromoted: true,
      promotionExpiresAt: { $gt: new Date() },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: 20000, // 20km
        },
      },
    })
      .limit(20)
      .lean();

    return success(res, { data: stores });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /stores/:id — Single store detail (includes payment.publicKey).
 */
async function getStore(req, res, next) {
  try {
    const store = await Store.findById(req.params.id).lean();
    if (!store) {
      return error(res, { statusCode: 404, message: "Store not found" });
    }

    return success(res, { data: store });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /stores/:id/products — Paginated products with search & category filter.
 */
async function getStoreProducts(req, res, next) {
  try {
    const { search, category } = req.query;
    const filter = { storeId: req.params.id, isActive: true };

    if (category) {
      filter.category = category;
    }

    let query;
    if (search) {
      filter.$text = { $search: search };
      query = Product.find(filter, { score: { $meta: "textScore" } }).sort({
        score: { $meta: "textScore" },
      });
    } else {
      query = Product.find(filter);
    }

    const { docs, meta } = await paginate(query, req.query);

    return success(res, { data: docs, meta });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /stores/:id/operating-hours
 */
async function getOperatingHours(req, res, next) {
  try {
    const store = await Store.findById(req.params.id)
      .select("operatingHours name")
      .lean();

    if (!store) {
      return error(res, { statusCode: 404, message: "Store not found" });
    }

    return success(res, { data: store.operatingHours || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNearbyStores,
  getPromotedStores,
  getStore,
  getStoreProducts,
  getOperatingHours,
};
