/**
 * Migração 001: Inicialização de configurações padrão e controle de schema
 */
module.exports = {
  id: '001_initial_schema_indexes',
  async up(db) {
    // Garante que o documento de configurações gerais exista
    const settingsDoc = await db.collection('settings').doc('general').get();
    if (!settingsDoc.exists) {
      await db.collection('settings').doc('general').set({
        schemaVersion: 1,
        systemName: 'Gastos do Casal',
        defaultCurrency: 'BRL',
        updatedAt: new Date().toISOString(),
      });
    }
  },

  async down(db) {
    // Reverte a configuração inicial se necessário
    const settingsDoc = await db.collection('settings').doc('general').get();
    if (settingsDoc.exists) {
      await db.collection('settings').doc('general').delete();
    }
  },
};
