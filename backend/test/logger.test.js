const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { logger, redactConfig } = require('../src/config/logger');
const { correlationIdMiddleware, requestLogger } = require('../src/middlewares/loggerMiddleware');
const { logAudit, auditLogger } = require('../src/services/AuditService');

describe('Security Hardening - Fase 5: Logs Estruturados, Correlation ID e Auditoria (#6)', () => {
  let server;
  let baseUrl;

  test('setup do servidor Express com middlewares de logging e health check', async () => {
    const app = express();
    app.use(express.json());
    app.use(correlationIdMiddleware);
    app.use(requestLogger);

    app.get('/test-correlation', (req, res) => {
      res.json({
        requestId: req.id,
        hasLogChild: typeof req.log?.info === 'function',
      });
    });

    app.post('/test-redaction', (req, res) => {
      req.log.info({ body: req.body }, 'Test redaction payload');
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

  after(() => {
    if (server) server.close();
  });

  test('deve gerar x-request-id UUID v4 quando não fornecido pelo cliente', async () => {
    const res = await fetch(`${baseUrl}/test-correlation`);
    assert.equal(res.status, 200);

    const headerRequestId = res.headers.get('x-request-id');
    assert.ok(headerRequestId, 'Header x-request-id deve estar presente');
    // Valida formato UUID v4
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(headerRequestId, uuidRegex, 'x-request-id deve ser um UUID v4');

    const body = await res.json();
    assert.equal(body.requestId, headerRequestId);
    assert.equal(body.hasLogChild, true);
  });

  test('deve preservar x-request-id enviado pelo cliente no header', async () => {
    const customId = 'custom-client-trace-12345';
    const res = await fetch(`${baseUrl}/test-correlation`, {
      headers: { 'x-request-id': customId },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-request-id'), customId);

    const body = await res.json();
    assert.equal(body.requestId, customId);
  });

  test('logger deve conter regras de mascaramento (redaction) para senhas, tokens e credenciais', () => {
    assert.ok(redactConfig, 'redactConfig deve existir');
    assert.ok(Array.isArray(redactConfig.paths), 'redactConfig.paths deve ser um array');

    const expectedMaskedFields = [
      'password',
      'token',
      'secret',
      'mfaSecret',
      'totpCode',
      'authorization',
      'creditCard',
      'pixKey',
      'req.headers.authorization',
      'req.headers.cookie',
    ];

    for (const field of expectedMaskedFields) {
      const hasField = redactConfig.paths.some((p) => p === field || p.includes(field));
      assert.ok(hasField, `Campo sensível ${field} deve estar configurado para mascaramento`);
    }
  });

  test('logAudit deve registrar evento com tag AUDIT, timestamp ISO, ator e status', async () => {
    let capturedLog = null;
    const originalInfo = auditLogger.info;
    auditLogger.info = (obj, msg) => {
      capturedLog = { ...obj, msg };
    };

    try {
      await logAudit('AUTH_LOGIN_FAILURE', {
        actor: 'jose',
        ip: '192.168.1.100',
        status: 'FAILED',
        details: { attempts: 3, reason: 'Senha incorreta' },
      });

      assert.ok(capturedLog, 'logAudit deve ter chamado auditLogger');
      assert.equal(capturedLog.type, 'AUDIT');
      assert.equal(capturedLog.auditEvent, 'AUTH_LOGIN_FAILURE');
      assert.equal(capturedLog.actor, 'jose');
      assert.equal(capturedLog.ip, '192.168.1.100');
      assert.equal(capturedLog.status, 'FAILED');
      assert.equal(capturedLog.details.attempts, 3);
      assert.ok(capturedLog.timestamp, 'timestamp deve estar presente');
    } finally {
      auditLogger.info = originalInfo;
    }
  });
});
