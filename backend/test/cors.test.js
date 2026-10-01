const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const { corsOptions } = require('../src/config/cors');

describe('Security Hardening - Fase 2: CORS Estrito (#13)', () => {
  let server;
  let baseUrl;

  test('setup do servidor Express com CORS estrito', async () => {
    const app = express();
    app.use(cors(corsOptions));
    app.use(express.json());

    app.get('/test-endpoint', (req, res) => {
      res.json({ message: 'sucesso' });
    });

    // Middleware de erro de CORS
    app.use((err, req, res, next) => {
      if (err && (err.code === 'CORS_NOT_ALLOWED' || err.message?.includes('CORS'))) {
        return res.status(403).json({
          error: err.message,
          code: 'CORS_FORBIDDEN',
        });
      }
      next(err);
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  test('deve permitir requisições vindas de origem autorizada oficial', async () => {
    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'GET',
      headers: {
        'Origin': 'https://gastos-casal-26c77.web.app',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://gastos-casal-26c77.web.app');
    const data = await res.json();
    assert.equal(data.message, 'sucesso');
  });

  test('deve responder adequadamente a requisição preflight (OPTIONS)', async () => {
    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://gastos-casal-26c77.web.app',
        'Access-Control-Request-Method': 'POST',
      },
    });

    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://gastos-casal-26c77.web.app');
    assert.ok(res.headers.get('access-control-allow-methods').includes('POST'));
    assert.ok(res.headers.get('access-control-max-age'));
  });

  test('deve permitir chamadas sem cabeçalho Origin (health check e same-origin)', async () => {
    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'GET',
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.message, 'sucesso');
  });

  test('deve bloquear requisições vindas de origens não autorizadas com HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'GET',
      headers: {
        'Origin': 'https://site-malicioso-hacker.com',
      },
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.code, 'CORS_FORBIDDEN');
    assert.ok(data.error.includes('não autorizada'));
  });

  after(() => {
    if (server) server.close();
  });
});
