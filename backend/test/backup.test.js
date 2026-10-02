const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exportDatabase } = require('../src/scripts/backup');

describe('Security Hardening - Fase 6: Rotinas de Backup e Exportação do Firestore (#15)', () => {
  let tempDir;
  let mockDb;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gastos-backup-test-'));

    mockDb = {
      collection: (name) => ({
        get: async () => {
          if (name === 'receipts') {
            return {
              docs: [
                { id: 'rec-1', data: () => ({ store: 'Supermercado', amount: 15000 }) },
                { id: 'rec-2', data: () => ({ store: 'Farmácia', amount: 4500 }) },
              ],
            };
          }
          if (name === 'settings') {
            return {
              docs: [
                { id: 'general', data: () => ({ householdName: 'Casa' }) },
              ],
            };
          }
          return { docs: [] };
        },
      }),
    };
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('exportDatabase deve extrair coleções e salvar em arquivo JSON formatado', async () => {
    const result = await exportDatabase(mockDb, {
      outputDir: tempDir,
      collections: ['receipts', 'settings'],
    });

    assert.ok(result.filePath, 'Caminho do arquivo deve ser retornado');
    assert.ok(fs.existsSync(result.filePath), 'Arquivo de backup deve existir no disco');
    assert.equal(result.totalDocuments, 3);

    const fileContent = JSON.parse(fs.readFileSync(result.filePath, 'utf-8'));
    assert.ok(fileContent.metadata, 'Metadados devem existir no backup');
    assert.equal(fileContent.metadata.totalDocuments, 3);
    assert.equal(fileContent.data.receipts.length, 2);
    assert.equal(fileContent.data.settings.length, 1);
    assert.equal(fileContent.data.receipts[0].store, 'Supermercado');
  });
});
