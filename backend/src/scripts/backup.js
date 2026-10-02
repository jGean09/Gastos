const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

const DEFAULT_COLLECTIONS = ['receipts', 'settings', 'audit_logs', '_schema_migrations'];

/**
 * Exporta coleções do Firestore para um arquivo JSON formatado com metadados
 * @param {object} db - Instância do Firestore
 * @param {object} options
 * @param {string} [options.outputDir] - Diretório de destino
 * @param {string[]} [options.collections] - Coleções para exportar
 */
async function exportDatabase(db, { outputDir, collections = DEFAULT_COLLECTIONS } = {}) {
  const targetDir = outputDir || path.join(__dirname, '..', '..', 'backups');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `backup-gastos-${timestamp}.json`;
  const filePath = path.join(targetDir, fileName);

  const backupData = {
    metadata: {
      createdAt: new Date().toISOString(),
      collections: {},
      totalDocuments: 0,
      appVersion: '1.0.0',
    },
    data: {},
  };

  let totalDocs = 0;

  for (const collectionName of collections) {
    backupData.data[collectionName] = [];
    try {
      const snapshot = await db.collection(collectionName).get();
      const docs = snapshot.docs || [];

      for (const doc of docs) {
        backupData.data[collectionName].push({
          id: doc.id,
          ...(typeof doc.data === 'function' ? doc.data() : doc),
        });
      }

      backupData.metadata.collections[collectionName] = docs.length;
      totalDocs += docs.length;
    } catch (err) {
      logger.warn({ collection: collectionName, err: err.message }, 'Aviso ao exportar coleção');
      backupData.metadata.collections[collectionName] = 0;
    }
  }

  backupData.metadata.totalDocuments = totalDocs;

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
  logger.info({ filePath, totalDocs }, 'Backup do Firestore gerado com sucesso');

  return {
    filePath,
    fileName,
    totalDocuments: totalDocs,
    collections: backupData.metadata.collections,
  };
}

async function cli() {
  const { db } = require('../config/firebase');
  console.log('📦 Iniciando exportação de backup do banco de dados Firestore...');
  try {
    const result = await exportDatabase(db);
    console.log(`✅ Backup concluído com sucesso: ${result.filePath}`);
    console.log(`📄 Total de documentos salvos: ${result.totalDocuments}`);
    console.table(result.collections);
  } catch (err) {
    console.error('❌ Falha ao gerar backup:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  cli();
}

module.exports = {
  exportDatabase,
  DEFAULT_COLLECTIONS,
};
