const crypto = require('crypto');
const { logger } = require('../config/logger');

/**
 * ── Middleware de Correlation ID (x-request-id) ──
 * Garante que cada requisição HTTP possua um identificador único rastreável (UUID v4)
 * de ponta a ponta na esteira de logs.
 */
function correlationIdMiddleware(req, res, next) {
  const correlationId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    crypto.randomUUID();

  req.id = correlationId;
  res.setHeader('x-request-id', correlationId);

  // Cria um child logger com o contexto do requestId injetado automaticamente
  req.log = logger.child({ requestId: correlationId });

  next();
}

/**
 * ── Middleware de Logging HTTP de Requisições ──
 * Registra o término da requisição com latência (ms), status HTTP, método e rota.
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTimeMs = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTimeMs,
      ip: req.ip || req.socket?.remoteAddress,
      userId: req.user?.who || undefined,
    };

    if (res.statusCode >= 500) {
      (req.log || logger).error(logData, 'HTTP Request Error');
    } else if (res.statusCode >= 400) {
      (req.log || logger).warn(logData, 'HTTP Client Request Handled');
    } else {
      (req.log || logger).info(logData, 'HTTP Request Completed');
    }
  });

  next();
}

module.exports = {
  correlationIdMiddleware,
  requestLogger,
};
