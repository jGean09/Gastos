const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { MigrationRunner } = require('../src/migrations/runner');

describe('Security Hardening - Fase 6: Sistema de Migrações e Rollback do Firestore (#8, #9)', () => {
  let mockDb;
  let migrationsCollection;
  let sampleDataCollection;

  beforeEach(() => {
    // Mock em memória do Firestore
    const memoryStore = {
      _schema_migrations: new Map(),
      settings: new Map([['general', { version: 1, householdName: 'Nossa Casa' }]]),
    };

    mockDb = {
      collection: (name) => {
        if (!memoryStore[name]) memoryStore[name] = new Map();
        const store = memoryStore[name];

        return {
          doc: (id) => ({
            get: async () => ({
              exists: store.has(id),
              data: () => store.get(id),
              id,
            }),
            set: async (data) => {
              store.set(id, { ...data });
            },
            delete: async () => {
              store.delete(id);
            },
          }),
          get: async () => {
            const docs = [];
            for (const [id, data] of store.entries()) {
              docs.push({
                id,
                exists: true,
                data: () => data,
              });
            }
            return {
              docs,
              empty: docs.length === 0,
              size: docs.length,
            };
          },
        };
      },
      _store: memoryStore,
    };
  });

  const sampleMigrations = [
    {
      id: '001_add_default_categories',
      async up(db) {
        await db.collection('settings').doc('categories').set({
          list: ['Mercado', 'Aluguel', 'Lazer'],
        });
      },
      async down(db) {
        await db.collection('settings').doc('categories').delete();
      },
    },
    {
      id: '002_add_currency_config',
      async up(db) {
        await db.collection('settings').doc('currency').set({
          symbol: 'R$',
          code: 'BRL',
        });
      },
      async down(db) {
        await db.collection('settings').doc('currency').delete();
      },
    },
  ];

  test('status deve listar todas as migrações como pendentes inicialmente', async () => {
    const runner = new MigrationRunner({ migrations: sampleMigrations });
    const status = await runner.getStatus(mockDb);

    assert.equal(status.length, 2);
    assert.equal(status[0].id, '001_add_default_categories');
    assert.equal(status[0].applied, false);
    assert.equal(status[1].id, '002_add_currency_config');
    assert.equal(status[1].applied, false);
  });

  test('up deve aplicar todas as migrações pendentes e registrar no _schema_migrations', async () => {
    const runner = new MigrationRunner({ migrations: sampleMigrations });
    const results = await runner.up(mockDb);

    assert.equal(results.executedCount, 2);
    assert.deepEqual(results.appliedIds, ['001_add_default_categories', '002_add_currency_config']);

    // Verifica se os dados foram criados no banco
    const catDoc = await mockDb.collection('settings').doc('categories').get();
    assert.equal(catDoc.exists, true);
    assert.deepEqual(catDoc.data().list, ['Mercado', 'Aluguel', 'Lazer']);

    // Verifica se o histórico de migração foi salvo
    const migrationDoc = await mockDb.collection('_schema_migrations').doc('001_add_default_categories').get();
    assert.equal(migrationDoc.exists, true);
    assert.ok(migrationDoc.data().appliedAt);
  });

  test('up deve ser estritamente idempotente (não reexecutar o que já foi aplicado)', async () => {
    const runner = new MigrationRunner({ migrations: sampleMigrations });
    await runner.up(mockDb);

    // Segunda execução
    const secondRun = await runner.up(mockDb);
    assert.equal(secondRun.executedCount, 0);
    assert.equal(secondRun.alreadyUpToDate, true);
  });

  test('down deve reverter a última migração aplicada e removê-la de _schema_migrations', async () => {
    const runner = new MigrationRunner({ migrations: sampleMigrations });
    await runner.up(mockDb);

    const rollbackResult = await runner.down(mockDb);
    assert.equal(rollbackResult.revertedId, '002_add_currency_config');

    // A migração 002 foi desfeita
    const currencyDoc = await mockDb.collection('settings').doc('currency').get();
    assert.equal(currencyDoc.exists, false);

    // O registro em _schema_migrations foi removido
    const migrationDoc = await mockDb.collection('_schema_migrations').doc('002_add_currency_config').get();
    assert.equal(migrationDoc.exists, false);

    // A migração 001 continua preservada
    const catDoc = await mockDb.collection('settings').doc('categories').get();
    assert.equal(catDoc.exists, true);
  });

  test('dry-run não deve alterar dados reais nem gravar no histórico de migrações', async () => {
    const runner = new MigrationRunner({ migrations: sampleMigrations });
    const results = await runner.up(mockDb, { dryRun: true });

    assert.equal(results.dryRun, true);
    assert.equal(results.simulatedCount, 2);

    const catDoc = await mockDb.collection('settings').doc('categories').get();
    assert.equal(catDoc.exists, false);

    const migrationDoc = await mockDb.collection('_schema_migrations').doc('001_add_default_categories').get();
    assert.equal(migrationDoc.exists, false);
  });
});
