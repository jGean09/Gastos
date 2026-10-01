const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { validateRequest } = require('../src/middlewares/validationMiddleware');
const {
  idParamSchema,
  createReceiptSchema,
  closeCycleSchema,
} = require('../src/schemas/expenseSchemas');
const { loginSchema, mfaLoginSchema } = require('../src/schemas/authSchemas');

describe('Security Hardening - Fase 3: Validação de Esquemas com Zod (#5)', () => {
  let server;
  let baseUrl;

  test('setup do servidor Express com rotas validadas', async () => {
    const app = express();
    app.use(express.json());

    // Rota de teste: criação de recibo
    app.post('/test-receipt', validateRequest({ body: createReceiptSchema }), (req, res) => {
      res.status(201).json({ success: true, data: req.body });
    });

    // Rota de teste: fechamento de ciclo
    app.post('/test-close-cycle', validateRequest({ body: closeCycleSchema }), (req, res) => {
      res.json({ success: true, cycle: req.body.cycleName });
    });

    // Rota de teste: validação de ID em params
    app.get('/test-receipt/:id', validateRequest({ params: idParamSchema }), (req, res) => {
      res.json({ id: req.params.id });
    });

    // Rota de teste: login auth
    app.post('/test-login', validateRequest({ body: loginSchema }), (req, res) => {
      res.json({ success: true });
    });

    // Rota de teste: mfa login
    app.post('/test-mfa', validateRequest({ body: mfaLoginSchema }), (req, res) => {
      res.json({ success: true });
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  test('deve aprovar payload válido para criação de recibo', async () => {
    const validReceipt = {
      store: 'Supermercado Central',
      date: '2026-10-01',
      payer: 'him',
      scope: 'household',
      items: [
        { name: 'Arroz', priceCents: 2500, split: 'both' },
        { name: 'Feijão', priceCents: 900, split: 'both' },
      ],
      totalCents: 3400,
    };

    const res = await fetch(`${baseUrl}/test-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validReceipt),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.data.store, 'Supermercado Central');
  });

  test('deve rejeitar criação de recibo sem nome do estabelecimento com HTTP 400', async () => {
    const invalidReceipt = {
      date: '2026-10-01',
      totalCents: 5000,
    };

    const res = await fetch(`${baseUrl}/test-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidReceipt),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field === 'store'));
  });

  test('deve rejeitar valor negativo de item no recibo', async () => {
    const invalidPrice = {
      store: 'Padaria',
      date: '2026-10-01',
      items: [{ name: 'Pão', priceCents: -500 }],
    };

    const res = await fetch(`${baseUrl}/test-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPrice),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field.includes('priceCents')));
  });

  test('deve rejeitar pagador inválido no fechamento de ciclo', async () => {
    const invalidCycle = {
      cycleName: 'Outubro 2026',
      payer: 'hacker', // Deve ser 'him' ou 'her'
      amountPaid: 15000,
      date: '2026-10-01',
    };

    const res = await fetch(`${baseUrl}/test-close-cycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidCycle),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field === 'payer'));
  });

  test('deve rejeitar ID com caracteres perigosos ou injeção de caminho', async () => {
    // Caracteres não permitidos como barras, arroba ou tags
    const res = await fetch(`${baseUrl}/test-receipt/id-invalido%2Fcom%2Fbarra`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field === 'id'));
  });

  test('deve rejeitar código MFA que não tenha exatamente 6 dígitos numéricos', async () => {
    const invalidMfa = {
      tempToken: 'token_temporario_valido',
      mfaCode: '123a5', // 5 caracteres e com letra
    };

    const res = await fetch(`${baseUrl}/test-mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidMfa),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field === 'mfaCode'));
  });

  after(() => {
    if (server) server.close();
  });
});
