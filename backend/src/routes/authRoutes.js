const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/AuthController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// ── Rotas Públicas de Autenticação ──
router.post('/login', ctrl.login);
router.post('/login/mfa', ctrl.verifyMfaLogin);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout); // Token enviado no body; o serviço o invalida no Firestore

// ── Rotas Protegidas (Requerem Token JWT) ──
router.get('/me', authenticateToken, ctrl.me);
router.post('/mfa/setup', authenticateToken, ctrl.setupMfa);
router.post('/mfa/verify', authenticateToken, ctrl.verifyMfa);
router.post('/mfa/disable', authenticateToken, ctrl.disableMfa);
router.post('/change-password', authenticateToken, ctrl.changePassword);

module.exports = router;
