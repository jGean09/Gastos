const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

/**
 * Middleware para validar o token JWT nas rotas protegidas.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Acesso não autorizado: token de autenticação não fornecido.',
      code: 'AUTH_REQUIRED',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      const isExpired = err.name === 'TokenExpiredError';
      return res.status(401).json({
        error: isExpired ? 'Sessão expirada. Por favor, renove sua autenticação.' : 'Token de autenticação inválido.',
        code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      });
    }

    req.user = decoded;
    next();
  });
}

/**
 * Middleware para exigir um papel específico (ex: 'admin').
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        error: `Acesso negado: permissão '${role}' necessária.`,
        code: 'FORBIDDEN',
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
};
