/**
 * @file Product controller — barcode lookup.
 */
const Product = require("../models/Product");
const { success, error } = require("../utils/response");

/**
 * GET /products/barcode/:barcode — Lookup product by barcode.
 */
async function getByBarcode(req, res, next) {
  try {
    const product = await Product.findOne({
      barcode: req.params.barcode,
      isActive: true,
    }).lean();

    if (!product) {
      return error(res, { statusCode: 404, message: "Product not found" });
    }

    return success(res, { data: product });
  } catch (err) {
    next(err);
  }
}

module.exports = { getByBarcode };
