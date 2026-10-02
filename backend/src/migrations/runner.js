const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');

class MigrationRunner {
  constructor({ migrationsDir, migrations, collectionName = '_schema_migrations' } = {}) {
    this.migrationsDir = migrationsDir || path.join(__dirname, 'scripts');
    this.customMigrations = migrations;
    this.collectionName = collectionName;
  }

  loadMigrations() {
    if (this.customMigrations) {
      return this.customMigrations;
    }

    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith('.js'))
      .sort();

    return files.map((file) => {
      const fullPath = path.join(this.migrationsDir, file);
      const mod = require(fullPath);
      return {
        id: mod.id || path.basename(file, '.js'),
        name: file,
        up: mod.up,
        down: mod.down,
      };
    });
  }

  async getAppliedMap(db) {
    const appliedMap = new Map();
    const snapshot = await db.collection(this.collectionName).get();

    for (const doc of snapshot.docs) {
      const data = typeof doc.data === 'function' ? doc.data() : doc;
      appliedMap.set(doc.id, data);
    }

    return appliedMap;
  }

  async getStatus(db) {
    const all = this.loadMigrations();
    const appliedMap = await this.getAppliedMap(db);

    return all.map((m) => {
      const isApplied = appliedMap.has(m.id);
      const appliedRecord = appliedMap.get(m.id);
      return {
        id: m.id,
        name: m.name || m.id,
        applied: isApplied,
        appliedAt: isApplied ? appliedRecord?.appliedAt || null : null,
      };
    });
  }

  async up(db, { dryRun = false } = {}) {
    const all = this.loadMigrations();
    const appliedMap = await this.getAppliedMap(db);

    const pending = all.filter((m) => !appliedMap.has(m.id));

    if (pending.length === 0) {
      return {
        executedCount: 0,
        alreadyUpToDate: true,
        message: 'Todas as migrações já estão aplicadas.',
      };
    }

    if (dryRun) {
      return {
        dryRun: true,
        simulatedCount: pending.length,
        simulatedIds: pending.map((m) => m.id),
      };
    }

    const appliedIds = [];

    for (const migration of pending) {
      if (typeof migration.up !== 'function') {
        throw new Error(`Migração ${migration.id} não exporta o método up(db)`);
      }

      logger.info({ migrationId: migration.id }, `Executando migração up: ${migration.id}`);
      await migration.up(db);

      const record = {
        id: migration.id,
        appliedAt: new Date().toISOString(),
      };

      await db.collection(this.collectionName).doc(migration.id).set(record);
      appliedIds.push(migration.id);
    }

    return {
      executedCount: appliedIds.length,
      appliedIds,
    };
  }

  async down(db, { dryRun = false } = {}) {
    const all = this.loadMigrations();
    const appliedMap = await this.getAppliedMap(db);

    const appliedList = all.filter((m) => appliedMap.has(m.id));

    if (appliedList.length === 0) {
      return {
        revertedCount: 0,
        message: 'Nenhuma migração aplicada para reverter.',
      };
    }

    // Pega a última migração aplicada
    const lastMigration = appliedList[appliedList.length - 1];

    if (dryRun) {
      return {
        dryRun: true,
        simulatedRevertedId: lastMigration.id,
      };
    }

    if (typeof lastMigration.down !== 'function') {
      throw new Error(`Migração ${lastMigration.id} não exporta o método down(db)`);
    }

    logger.info({ migrationId: lastMigration.id }, `Executando rollback down: ${lastMigration.id}`);
    await lastMigration.down(db);

    await db.collection(this.collectionName).doc(lastMigration.id).delete();

    return {
      revertedCount: 1,
      revertedId: lastMigration.id,
    };
  }
}

module.exports = {
  MigrationRunner,
};
