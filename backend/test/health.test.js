const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createHealthRouter } = require('../src/routes/healthRoutes');

describe('Security Hardening - Fase 5: Health Check e Diagnóstico da Aplicação (#19)', () => {
  let server;
  let baseUrl;
  let mockDbSuccess = true;

  const mockDb = {
    collection: () => ({
      limit: () => ({
        get: async () => {
          if (!mockDbSuccess) {
            throw new Error('Firestore connection timeout');
          }
          return { empty: false };
        },
      }),
    }),
  };

  test('setup do servidor de teste para /health', async () => {
    const app = express();
    app.use(createHealthRouter(mockDb));

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
  });

  test('GET /health deve responder 200 com status healthy, métricas de memória e banco ok', async () => {
    mockDbSuccess = true;
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'healthy');
    assert.ok(body.timestamp, 'timestamp deve existir');
    assert.equal(typeof body.uptimeSeconds, 'number');
    assert.ok(body.memory, 'memory deve existir');
    assert.equal(typeof body.memory.rssMb, 'number');
    assert.equal(typeof body.memory.heapUsedMb, 'number');
    assert.equal(body.checks.server, 'ok');
    assert.equal(body.checks.database, 'ok');
    assert.equal(typeof body.checks.dbLatencyMs, 'number');
  });

  test('GET /health deve responder 503 com status degraded quando o banco de dados falha', async () => {
    mockDbSuccess = false;
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 503);

    const body = await res.json();
    assert.equal(body.status, 'degraded');
    assert.equal(body.checks.database, 'error');
    assert.equal(body.checks.server, 'ok');
  });
});
