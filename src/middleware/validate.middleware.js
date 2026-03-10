/**
 * @file Zod schema validation middleware.
 * Validates req.body, req.query, and/or req.params.
 */
const { ZodError } = require("zod");
const { error } = require("../utils/response");

/**
 * Create a validation middleware for a Zod schema.
 * @param {object} schemas
 * @param {import('zod').ZodSchema} [schemas.body] - Validate req.body
 * @param {import('zod').ZodSchema} [schemas.query] - Validate req.query
 * @param {import('zod').ZodSchema} [schemas.params] - Validate req.params
 * @returns {import('express').RequestHandler}
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        return error(res, {
          statusCode: 400,
          message: "Validation failed",
          errors,
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
