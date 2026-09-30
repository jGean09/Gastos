const { rateLimit } = require('express-rate-limit');

/**
 * Limitador de taxa contra ataques de força bruta no Login e MFA.
 * - Janela: 15 minutos
 * - Limite: 5 tentativas incorretas por IP
 * - skipSuccessfulRequests: true (requisições bem-sucedidas com status < 400 não consomem o limite)
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5, // máx 5 falhas por IP dentro da janela
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: 'Muitas tentativas incorretas de login. Por segurança, aguarde 15 minutos antes de tentar novamente.',
    code: 'TOO_MANY_ATTEMPTS',
  },
  handler: (req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = {
  loginLimiter,
};
