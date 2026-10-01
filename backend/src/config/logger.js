const pino = require('pino');

/**
 * ── Configuração de Redaction / Mascaramento de Dados Sensíveis (PII) ──
 * Garante que senhas, tokens de autenticação, segredos MFA e cabeçalhos sensíveis
 * jamais sejam expostos em texto puro nos logs do servidor.
 */
const redactConfig = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'secret',
    'mfaSecret',
    'token',
    'tempToken',
    'refreshToken',
    'totpCode',
    'creditCard',
    'pixKey',
    'authorization',
    'body.password',
    'body.token',
    'body.secret',
    'body.mfaSecret',
    'body.totpCode',
    'body.refreshToken',
    'body.tempToken',
    '*.password',
    '*.token',
    '*.secret',
    '*.mfaSecret',
    '*.totpCode',
  ],
  censor: '[REDACTED]',
};

const isTest = process.env.NODE_ENV === 'test';

const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: redactConfig,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

module.exports = {
  logger,
  redactConfig,
};
