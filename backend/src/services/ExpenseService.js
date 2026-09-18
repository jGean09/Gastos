/**
 * ── Padrões Information Expert (GRASP) + Strategy (GoF) ──
 *
 * ExpenseService é o "Expert": ele tem as informações (os recibos) e por isso
 * contém toda a lógica de negócio (cálculos, validações, fechamento de fatura).
 *
 * O método calculateBalances implementa internamente o padrão Strategy — a regra
 * de "quem deve quanto" fica encapsulada aqui, podendo ser trocada sem mexer
 * no Controller ou no Repository.
 *
 * Princípio SRP (SOLID S): este serviço tem um único motivo para mudar — a
 * regra de negócio financeira da aplicação.
 */
const { receiptRepo, configRepo } = require('../repositories/ExpenseRepository');

// ── Strategy: calcula centavos a partir de um valor decimal ──
function cents(v) { return Math.round((parseFloat(v) || 0) * 100); }

/**
 * ── Cache em Memória (Ticket 01 – Otimização de Performance) ──
 * Armazena os recibos buscados do Firestore indexados por chave de ciclo.
 * Invalidado em qualquer operação de escrita para garantir consistência.
 * Chaves: 'current' | 'all'
 */
const _cache = new Map();

class ExpenseService {
  // ──────────────────────────────────────────────
  //  RECIBOS
  // ──────────────────────────────────────────────

  /**
   * Retorna recibos filtrando por ciclo, servindo do cache em memória quando possível.
   * @param {string} [cycle] - 'current' para fatura aberta, 'all' ou omitido para todos.
   */
  async getAllReceipts(cycle) {
    const cacheKey = cycle || 'all';
    if (_cache.has(cacheKey)) {
      return _cache.get(cacheKey);
    }
    const all = await receiptRepo.findAll();
    // Filtragem pós-busca: mantém compatibilidade sem exigir índices compostos no Firestore
    const result = cycle === 'current'
      ? all.filter(r => !r.cycle || r.cycle === 'current')
      : all;
    _cache.set(cacheKey, result);
    return result;
  }

  async addReceipt(data) {
    // Validação básica (Single Responsibility: validar antes de persistir)
    if (!data.store && !data.type) throw new Error('Dados inválidos para o recibo.');
    data.createdAt = data.createdAt || Date.now();
    _cache.clear(); // invalida cache após escrita
    return receiptRepo.create(data);
  }

  async deleteReceipt(id) {
    if (!id) throw new Error('ID inválido.');
    _cache.clear(); // invalida cache após escrita
    return receiptRepo.delete(id);
  }

  async toggleReceiptStatus(id, currentStatus) {
    const newStatus = currentStatus === 'paid' ? 'open' : 'paid';
    _cache.clear(); // invalida cache após escrita
    return receiptRepo.updateFields(id, { status: newStatus });
  }

  async updateReceipt(id, updates) {
    if (!id) throw new Error('ID inválido.');
    _cache.clear(); // invalida cache após escrita
    return receiptRepo.updateFields(id, updates);
  }

  async clearAllReceipts() {
    _cache.clear(); // invalida cache após escrita
    return receiptRepo.deleteAll();
  }

  /**
   * ── Fechamento de Fatura (lógica complexa de negócio) ──
   * Information Expert: este serviço possui os recibos e sabe calcular o saldo.
   */
  async closeCycle({ cycleName, payer, amountPaid, date, names }) {
    const allReceipts = await receiptRepo.findAll();
    const activeReceipts = allReceipts.filter(r => !r.scope && (!r.cycle || r.cycle === 'current'));

    if (activeReceipts.length === 0) throw new Error('Nenhuma conta aberta.');

    // ── Strategy: Cálculo do saldo do casal ──
    let coupleBalanceCents = 0;
    activeReceipts.forEach(r => {
      if (r.type === 'settlement') {
        if (r.payer === 'him') coupleBalanceCents += r.amountCents;
        else if (r.payer === 'her') coupleBalanceCents -= r.amountCents;
      } else if (r.status !== 'paid') {
        const rHimC = r.himCents !== undefined ? r.himCents : cents(r.himTotal || 0);
        const rHerC = r.herCents !== undefined ? r.herCents : cents(r.herTotal || 0);
        if (r.payer === 'him') coupleBalanceCents += rHerC;
        else if (r.payer === 'her') coupleBalanceCents -= rHimC;
      }
    });

    if (payer === 'him') coupleBalanceCents += amountPaid;
    else if (payer === 'her') coupleBalanceCents -= amountPaid;

    // Atualiza todos os recibos ativos para o ciclo novo
    for (const r of activeReceipts) {
      await receiptRepo.updateFields(r._fireId, { cycle: cycleName });
    }

    // Registra o pagamento de acerto (se houver)
    if (amountPaid > 0) {
      const settlement = {
        id: Date.now(), type: 'settlement', store: '💸 Pix / Acerto Final',
        date, payer, amountCents: amountPaid, cycle: cycleName,
        names, createdAt: Date.now()
      };
      await receiptRepo.create(settlement);
    }

    // Registra o saldo restante (rollover) se houver
    if (coupleBalanceCents !== 0) {
      let rollPayer = '', rHimC = 0, rHerC = 0, splitType = '';
      const itemPrice = Math.abs(coupleBalanceCents);
      if (coupleBalanceCents > 0) { rollPayer = 'him'; rHerC = itemPrice; splitType = 'her'; }
      else { rollPayer = 'her'; rHimC = itemPrice; splitType = 'him'; }

      const rolloverItem = { id: Date.now(), name: 'Dívida pendente: ' + cycleName, priceCents: itemPrice, split: splitType, otherName: '' };
      const rolloverReceipt = {
        id: Date.now(), type: 'rollover', store: `Restante ref: ${cycleName}`,
        date, payer: rollPayer, method: 'Saldo Acumulado', category: 'outros', status: 'open', cycle: 'current',
        items: [rolloverItem], himCents: rHimC, herCents: rHerC, otherCents: 0, coupleCents: itemPrice, totalCents: itemPrice,
        imageBase64: null, imageMime: null, names, createdAt: Date.now() + 1000
      };
      await receiptRepo.create(rolloverReceipt);
    }

    _cache.clear(); // invalida cache após fechar fatura
    return { success: true, cycleName };
  }

  // ──────────────────────────────────────────────
  //  CONFIGURAÇÕES
  // ──────────────────────────────────────────────

  async getSettings() {
    const data = await configRepo.load();
    return data || { him: 'Eu', her: 'Ela', password: '15112018', passwordHer: '', geminiKey: '', monthlyGoal: 0 };
  }

  async saveSettings(settings) {
    return configRepo.save(settings);
  }
}

module.exports = new ExpenseService();
