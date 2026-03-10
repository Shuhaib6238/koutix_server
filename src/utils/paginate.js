/**
 * @file Reusable Mongoose pagination helper.
 */

/**
 * Apply pagination to a Mongoose query.
 * @param {import('mongoose').Query} query - The Mongoose query
 * @param {object} options
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.sort='-createdAt'] - Mongoose sort string
 * @returns {Promise<{docs: Array, meta: object}>}
 */
async function paginate(
  query,
  { page = 1, limit = 20, sort = "-createdAt" } = {},
) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [docs, totalDocs] = await Promise.all([
    query.clone().sort(sort).skip(skip).limit(limit).lean(),
    query.clone().countDocuments(),
  ]);

  const totalPages = Math.ceil(totalDocs / limit);

  return {
    docs,
    meta: {
      page,
      limit,
      totalDocs,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

module.exports = { paginate };
