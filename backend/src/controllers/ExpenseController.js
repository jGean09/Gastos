/**
 * ── Padrão Controller (GRASP) ──
 * O Controller é o "porteiro": recebe a requisição HTTP, valida os parâmetros
 * superficialmente, delega a lógica para o Service e devolve a resposta.
 *
 * Princípio SRP (SOLID S): o Controller NÃO contém regras de negócio.
 * Se a regra mudar, apenas o Service precisa ser alterado.
 */
const expenseService = require('../services/ExpenseService');
const { logAudit } = require('../services/AuditService');

class ExpenseController {
  // ──────────────────────────────────────────────
  //  RECIBOS
  // ──────────────────────────────────────────────

  async getAll(req, res) {
    try {
      const { cycle } = req.query; // 'current' | 'all' | undefined
      const receipts = await expenseService.getAllReceipts(cycle);
      res.json(receipts);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  async create(req, res) {
    try {
      const receipt = await expenseService.addReceipt(req.body);
      res.status(201).json(receipt);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async deleteOne(req, res) {
    try {
      await expenseService.deleteReceipt(req.params.id);
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  async toggleStatus(req, res) {
    try {
      const { currentStatus } = req.body;
      const updated = await expenseService.toggleReceiptStatus(req.params.id, currentStatus);
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  async updateOne(req, res) {
    try {
      const updated = await expenseService.updateReceipt(req.params.id, req.body);
      res.json(updated);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async clearAll(req, res) {
    try {
      await expenseService.clearAllReceipts();
      await logAudit('EXPENSE_CLEAR_ALL', {
        actor: req.user?.who || 'unknown',
        ip: req.ip,
        status: 'SUCCESS',
      });
      res.status(204).send();
    } catch (e) {
      await logAudit('EXPENSE_CLEAR_ALL', {
        actor: req.user?.who || 'unknown',
        ip: req.ip,
        status: 'FAILED',
        details: { error: e.message },
      });
      res.status(500).json({ error: e.message });
    }
  }

  async closeCycle(req, res) {
    try {
      const result = await expenseService.closeCycle(req.body);
      await logAudit('EXPENSE_CLOSE_CYCLE', {
        actor: req.user?.who || req.body.payer || 'unknown',
        ip: req.ip,
        status: 'SUCCESS',
        details: { payer: req.body.payer },
      });
      res.json(result);
    } catch (e) {
      await logAudit('EXPENSE_CLOSE_CYCLE', {
        actor: req.user?.who || req.body.payer || 'unknown',
        ip: req.ip,
        status: 'FAILED',
        details: { error: e.message },
      });
      res.status(400).json({ error: e.message });
    }
  }

  // ──────────────────────────────────────────────
  //  CONFIGURAÇÕES
  // ──────────────────────────────────────────────

  async getSettings(req, res) {
    try {
      const settings = await expenseService.getSettings();
      res.json(settings);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  async saveSettings(req, res) {
    try {
      await expenseService.saveSettings(req.body);
      await logAudit('SETTINGS_UPDATE', {
        actor: req.user?.who || 'unknown',
        ip: req.ip,
        status: 'SUCCESS',
      });
      res.json({ success: true });
    } catch (e) {
      await logAudit('SETTINGS_UPDATE', {
        actor: req.user?.who || 'unknown',
        ip: req.ip,
        status: 'FAILED',
        details: { error: e.message },
      });
      res.status(400).json({ error: e.message });
    }
  }
}

module.exports = new ExpenseController();
