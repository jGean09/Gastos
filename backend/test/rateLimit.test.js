const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { loginLimiter } = require('../src/middlewares/rateLimitMiddleware');

describe('Security Hardening - Fase 2: Rate Limiting de Autenticação (#4)', () => {
  let server;
  let baseUrl;

  // Cria um mini-servidor Express exclusivo para testar o rate limiter
  test('setup do servidor de teste de rate limit', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    // Endpoint simulando login com falha
    app.post('/test-login-fail', loginLimiter, (req, res) => {
      res.status(401).json({ error: 'Senha incorreta' });
    });

    // Endpoint simulando login com sucesso
    app.post('/test-login-success', loginLimiter, (req, res) => {
      res.status(200).json({ success: true });
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  test('deve permitir requisições com sucesso sem consumir limite indevidamente', async () => {
    // 3 logins bem-sucedidos
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/test-login-success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(res.status, 200);
    }
  });

  test('deve bloquear após 5 falhas consecutivas de login retornando HTTP 429', async () => {
    // 5 falhas consecutivas permitidas (retornam 401)
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/test-login-fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(res.status, 401);
    }

    // A 6ª tentativa DEVE ser barrada pelo Rate Limiter com HTTP 429
    const blockedRes = await fetch(`${baseUrl}/test-login-fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(blockedRes.status, 429);
    const body = await blockedRes.json();
    assert.equal(body.code, 'TOO_MANY_ATTEMPTS');
    assert.ok(body.error.includes('Muitas tentativas incorretas'));
  });

  after(() => {
    if (server) server.close();
  });
});
