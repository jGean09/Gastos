const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ExpenseController');

const { authenticateToken, requireRole } = require('../middlewares/authMiddleware');
const { validateRequest } = require('../middlewares/validationMiddleware');
const {
  idParamSchema,
  createReceiptSchema,
  updateReceiptSchema,
  toggleStatusSchema,
  closeCycleSchema,
  settingsSchema,
} = require('../schemas/expenseSchemas');

// Todas as rotas de dados e configurações exigem autenticação
router.use(authenticateToken);

// ── Rotas de Recibos ──
router.get('/receipts', ctrl.getAll);
router.post('/receipts', validateRequest({ body: createReceiptSchema }), ctrl.create);
router.delete('/receipts/all', requireRole('admin'), ctrl.clearAll);
router.delete('/receipts/:id', validateRequest({ params: idParamSchema }), ctrl.deleteOne);
router.patch('/receipts/:id/status', validateRequest({ params: idParamSchema, body: toggleStatusSchema }), ctrl.toggleStatus);
router.patch('/receipts/:id', validateRequest({ params: idParamSchema, body: updateReceiptSchema }), ctrl.updateOne);
router.post('/receipts/close-cycle', requireRole('admin'), validateRequest({ body: closeCycleSchema }), ctrl.closeCycle);

// ── Rotas de Configurações ──
router.get('/settings', ctrl.getSettings);
router.post('/settings', validateRequest({ body: settingsSchema }), ctrl.saveSettings);

module.exports = router;
