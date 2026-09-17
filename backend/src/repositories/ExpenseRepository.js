/**
 * ── Padrão Repository (Adapter) ──
 * Encapsula TODO acesso ao Firestore. O resto da aplicação não sabe que
 * o banco de dados é o Firebase — segue o Princípio da Inversão de Dependência (SOLID D).
 */
const { db } = require('../config/firebase');

class ReceiptRepository {
  constructor() {
    this.col = db.collection('receipts');
  }

  async findAll() {
    const snap = await this.col.orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ ...d.data(), _fireId: d.id }));
  }

  async create(data) {
    const ref = await this.col.add(data);
    return { ...data, _fireId: ref.id };
  }

  async updateFields(id, fields) {
    await this.col.doc(id).set(fields, { merge: true });
    return { _fireId: id, ...fields };
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
};
