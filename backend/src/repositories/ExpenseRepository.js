/**
 * ── Padrão Repository (Adapter) ──
 * Encapsula TODO acesso ao Firestore. O resto da aplicação não sabe que
 * o banco de dados é o Firebase — segue o Princípio da Inversão de Dependência (SOLID D).
 *
 * ── DTO (Data Transfer Object) — Defesa contra NoSQL Injection / Object Poisoning ──
 * Nenhuma rota passa `req.body` diretamente para o Firestore.
 * Apenas campos da whitelist explícita são persistidos. Qualquer campo
 * extra (ex: `isAdmin`, `_id`, `__proto__`) é silenciosamente descartado.
 */
const { db } = require('../config/firebase');

/**
 * Campos permitidos para um documento de recibo no Firestore.
 * Esta whitelist é a única fonte de verdade sobre o que pode ser gravado.
 * Qualquer campo fora desta lista é ignorado.
 */
const RECEIPT_ALLOWED_FIELDS = new Set([
  'store', 'date', 'type', 'payer', 'method', 'category', 'scope',
  'status', 'items', 'himCents', 'herCents', 'otherCents', 'coupleCents',
  'totalCents', 'amountCents', 'imageBase64', 'imageMime', 'names',
  'cycle', 'createdAt', 'notes', 'description', 'id',
]);

/**
 * Aplica a whitelist DTO: retorna um novo objeto contendo
 * SOMENTE os campos permitidos. Campos extras são descartados.
 * @param {object} data
 * @returns {object}
 */
function toReceiptDTO(data) {
  const dto = {};
  for (const [key, value] of Object.entries(data)) {
    if (RECEIPT_ALLOWED_FIELDS.has(key)) {
      dto[key] = value;
    }
    // Campos fora da whitelist são silenciosamente descartados (proteção contra field injection)
  }
  return dto;
}

class ReceiptRepository {
  constructor() {
    this.col = db.collection('receipts');
  }

  async findAll() {
    const snap = await this.col.orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ ...d.data(), _fireId: d.id }));
  }

  /**
   * Cria um novo documento no Firestore.
   * O DTO garante que apenas campos permitidos cheguem ao banco.
   */
  async create(data) {
    const dto = toReceiptDTO(data);
    const ref = await this.col.add(dto);
    return { ...dto, _fireId: ref.id };
  }

  /**
   * Atualiza campos de um documento existente com merge.
   * O DTO impede que um cliente mal-intencionado sobrescreva campos arbitrários.
   */
  async updateFields(id, fields) {
    const dto = toReceiptDTO(fields);
    await this.col.doc(id).set(dto, { merge: true });
    return { _fireId: id, ...dto };
  }

  async delete(id) {
    await this.col.doc(id).delete();
  }

  async deleteAll() {
    const snap = await this.col.get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}

class ConfigRepository {
  constructor() {
    this.ref = db.collection('config').doc('settings');
  }

  async load() {
    const snap = await this.ref.get();
    return snap.exists ? snap.data() : null;
  }

  async save(settings) {
    await this.ref.set(settings, { merge: true });
  }
}

// Exporta instâncias únicas (Singleton por convenção)
module.exports = {
  receiptRepo: new ReceiptRepository(),
  configRepo: new ConfigRepository(),
  // Exportado apenas para testes unitários do DTO (não deve ser usado fora de testes)
  toReceiptDTO_TEST: toReceiptDTO,
};
