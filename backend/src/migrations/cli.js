const { db } = require('../config/firebase');
const { MigrationRunner } = require('./runner');
const { logger } = require('../config/logger');

async function main() {
  const command = process.argv[2] || 'status';
  const dryRun = process.argv.includes('--dry-run');

  const runner = new MigrationRunner();

  try {
    if (command === 'status') {
      const status = await runner.getStatus(db);
      console.log('\n📊 Status das Migrações do Firestore:');
      console.table(
        status.map((m) => ({
          ID: m.id,
          Aplicada: m.applied ? '✅ SIM' : '⏳ PENDENTE',
          'Data de Execução': m.appliedAt || '-',
        }))
      );
    } else if (command === 'up') {
      console.log(`🚀 Executando migrações up ${dryRun ? '(MODO DRY-RUN)' : ''}...`);
      const res = await runner.up(db, { dryRun });
      console.log(JSON.stringify(res, null, 2));
    } else if (command === 'down') {
      console.log(`⏪ Revertendo última migração down ${dryRun ? '(MODO DRY-RUN)' : ''}...`);
      const res = await runner.down(db, { dryRun });
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.error(`Comando desconhecido: ${command}. Use: status | up | down [--dry-run]`);
      process.exit(1);
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Falha no runner de migrações');
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
