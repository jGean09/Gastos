const { ZodError } = require('zod');

/**
 * Middleware genérico para validação de requisições Express com esquemas Zod.
 * Valida e sanitiza body, query e params, rejeitando payloads inválidos com HTTP 400.
 *
 * @param {object} options
 * @param {import('zod').ZodSchema} [options.body] - Esquema para req.body
 * @param {import('zod').ZodSchema} [options.query] - Esquema para req.query
 * @param {import('zod').ZodSchema} [options.params] - Esquema para req.params
 */
function validateRequest({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (query) {
        req.query = query.parse(req.query);
      }
      if (params) {
        req.params = params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        return res.status(400).json({
          error: 'Dados da requisição inválidos.',
          code: 'VALIDATION_ERROR',
          details,
        });
      }
      next(err);
    }
  };
}

module.exports = {
  validateRequest,
};
