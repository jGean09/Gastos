const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/AuthController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { loginLimiter } = require('../middlewares/rateLimitMiddleware');
const { validateRequest } = require('../middlewares/validationMiddleware');
const {
  loginSchema,
  mfaLoginSchema,
  refreshSchema,
  changePasswordSchema,
  mfaVerifySchema,
  mfaDisableSchema,
} = require('../schemas/authSchemas');

// ── Rotas Públicas de Autenticação ──
router.post('/login', loginLimiter, validateRequest({ body: loginSchema }), ctrl.login);
router.post('/login/mfa', loginLimiter, validateRequest({ body: mfaLoginSchema }), ctrl.verifyMfaLogin);
router.post('/refresh', validateRequest({ body: refreshSchema }), ctrl.refresh);
router.post('/logout', validateRequest({ body: refreshSchema }), ctrl.logout);

// ── Rotas Protegidas (Requerem Token JWT) ──
router.get('/me', authenticateToken, ctrl.me);
router.post('/mfa/setup', authenticateToken, ctrl.setupMfa);
router.post('/mfa/verify', authenticateToken, validateRequest({ body: mfaVerifySchema }), ctrl.verifyMfa);
router.post('/mfa/disable', authenticateToken, validateRequest({ body: mfaDisableSchema }), ctrl.disableMfa);
router.post('/change-password', authenticateToken, validateRequest({ body: changePasswordSchema }), ctrl.changePassword);

module.exports = router;
