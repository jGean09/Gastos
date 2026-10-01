const express = require('express');

/**
 * Cria o roteador de health check com verificação dinâmica da conexão com o banco
 * @param {object} [db] - Instância do Firestore para ping
 */
function createHealthRouter(db) {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    const memory = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    let databaseStatus = 'ok';
    let dbLatencyMs = null;

    if (db && typeof db.collection === 'function') {
      const start = Date.now();
      try {
        await db.collection('settings').limit(1).get();
        dbLatencyMs = Date.now() - start;
      } catch (err) {
        databaseStatus = 'error';
        if (req.log) {
          req.log.error({ err: err.message }, 'Health check: Falha de conectividade com o banco');
        }
      }
    }

    const isHealthy = databaseStatus === 'ok';

    const payload = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      },
      checks: {
        server: 'ok',
        database: databaseStatus,
        ...(dbLatencyMs !== null ? { dbLatencyMs } : {}),
      },
    };

    res.status(isHealthy ? 200 : 503).json(payload);
  });

  return router;
}

module.exports = {
  createHealthRouter,
};
