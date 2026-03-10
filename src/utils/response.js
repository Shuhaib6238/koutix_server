/**
 * @file Standardized API response helpers.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {number} [options.statusCode=200]
 * @param {string} [options.message='Success']
 * @param {*} [options.data]
 * @param {object} [options.meta] - Pagination or extra metadata
 */
function success(
  res,
  { statusCode = 200, message = "Success", data, meta } = {},
) {
  const body = { success: true, message };
  if (data !== undefined) body.data = data;
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {number} [options.statusCode=500]
 * @param {string} [options.message='Internal Server Error']
 * @param {Array} [options.errors] - Validation errors array
 */
function error(
  res,
  { statusCode = 500, message = "Internal Server Error", errors } = {},
) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { success, error };
