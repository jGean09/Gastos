const helmet = require('helmet');

/**
 * Middleware para forçar redirecionamento HTTP -> HTTPS em ambiente de produção (Render / Proxies).
 */
function enforceHttps(req, res, next) {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
  }
  next();
}

/**
 * Configuração do Helmet com cabeçalhos de segurança essenciais:
 * - HSTS (Strict-Transport-Security): força TLS/HTTPS por 1 ano com subdomínios
 * - Anti-Clickjacking: X-Frame-Options DENY
 * - Anti-MIME Sniffing: X-Content-Type-Options nosniff
 * - Ocultação de tecnologia: Remove X-Powered-By
 * - CORP (Cross-Origin Resource Policy): cross-origin para servir o frontend
 */
const securityHeaders = helmet({
  hsts: {
    maxAge: 31536000, // 1 ano em segundos
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  noSniff: true,
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
  // Como o backend é uma API REST que retorna JSON, desativa o CSP de páginas HTML completas
  contentSecurityPolicy: false,
});

module.exports = {
  enforceHttps,
  securityHeaders,
};
