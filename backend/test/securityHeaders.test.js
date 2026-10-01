const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { enforceHttps, securityHeaders } = require('../src/middlewares/securityHeadersMiddleware');

describe('Security Hardening - Fase 2: Blindagem de Cabeçalhos e HTTPS (#1)', () => {
  let server;
  let baseUrl;

  test('setup do servidor Express com Helmet e HTTPS enforcement', async () => {
    const app = express();
    app.use(enforceHttps);
    app.use(securityHeaders);

    app.get('/test-headers', (req, res) => {
      res.json({ status: 'ok' });
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  test('deve injetar cabeçalho X-Content-Type-Options: nosniff', async () => {
    const res = await fetch(`${baseUrl}/test-headers`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('deve injetar cabeçalho Anti-Clickjacking (X-Frame-Options: DENY)', async () => {
    const res = await fetch(`${baseUrl}/test-headers`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  test('deve ocultar o cabeçalho X-Powered-By para não vazar tecnologia', async () => {
    const res = await fetch(`${baseUrl}/test-headers`);
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  test('deve configurar HSTS (Strict-Transport-Security) com 1 ano e subdomínios', async () => {
    const res = await fetch(`${baseUrl}/test-headers`);
    const hsts = res.headers.get('strict-transport-security');
    assert.ok(hsts, 'HSTS deve estar presente');
    assert.ok(hsts.includes('max-age=31536000'));
    assert.ok(hsts.includes('includeSubDomains'));
  });

  test('deve configurar Cross-Origin-Resource-Policy como cross-origin para servir o web app', async () => {
    const res = await fetch(`${baseUrl}/test-headers`);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  });

  test('enforceHttps deve redirecionar requisição HTTP para HTTPS quando em produção', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await fetch(`${baseUrl}/test-headers`, {
        headers: {
          'x-forwarded-proto': 'http',
        },
        redirect: 'manual', // Não segue o redirect para inspecionar o status 301
      });

      assert.equal(res.status, 301);
      const location = res.headers.get('location');
      assert.ok(location.startsWith('https://'));
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  after(() => {
    if (server) server.close();
  });
});
