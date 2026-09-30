const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ExpenseController');

const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');

// Todas as rotas de dados e configurações exigem autenticação
router.use(authenticateToken);

// ── Rotas de Recibos ──
router.get('/receipts', ctrl.getAll);
router.post('/receipts', ctrl.create);
router.delete('/receipts/all', requireRole('admin'), ctrl.clearAll);
router.delete('/receipts/:id', ctrl.deleteOne);
router.patch('/receipts/:id/status', ctrl.toggleStatus);
router.patch('/receipts/:id', ctrl.updateOne);
router.post('/receipts/close-cycle', requireRole('admin'), ctrl.closeCycle);

// ── Rotas de Configurações ──
router.get('/settings', ctrl.getSettings);
router.post('/settings', ctrl.saveSettings);

module.exports = router;
