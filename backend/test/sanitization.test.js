/**
 * ── Testes de Segurança: Sanitização e Proteção contra Payloads Maliciosos ──
 *
 * Issue #4 — Fase 3: Validação de Entrada, Sanitização e Proteção NoSQL Injection
 * Acceptance Criteria:
 *   - Testes de envio de payloads maliciosos (<script>alert(1)</script>,
 *     números negativos, campos com prototype pollution) são bloqueados.
 *   - DTO descarta silenciosamente campos fora da whitelist (isAdmin, __proto__).
 *   - Frontend sanitiza texto (testado via utilitário sanitizeReceipt).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeReceipt, sanitizeString } = require('../src/utils/sanitize');
const { toReceiptDTO_TEST } = require('../src/repositories/ExpenseRepository');
const { validateRequest } = require('../src/middlewares/validationMiddleware');
const { createReceiptSchema } = require('../src/schemas/expenseSchemas');
const express = require('express');

// ────────────────────────────────────────────────────────────────────
// 1. Testes de sanitização XSS (utilitário sanitize.js)
// ────────────────────────────────────────────────────────────────────
describe('Sanitização Anti-XSS — sanitizeReceipt()', () => {

  test('deve remover <script> do campo store', () => {
    const input = { store: '<script>alert("xss")</script>Padaria', date: '2026-10-01' };
    const result = sanitizeReceipt(input);
    assert.ok(!result.store.includes('<script>'), 'Tag <script> não deve estar presente');
    assert.ok(!result.store.includes('</script>'), 'Tag </script> não deve estar presente');
  });

  test('deve remover atributos onerror de imagens injetadas', () => {
    const input = { store: '<img src=x onerror=alert(1)>Mercado', date: '2026-10-01' };
    const result = sanitizeReceipt(input);
    assert.ok(!result.store.includes('onerror'), 'Atributo onerror não deve estar presente');
    assert.ok(!result.store.includes('<img'), 'Tag <img> não deve estar presente');
  });

  test('deve remover link com javascript: do campo store', () => {
    const input = { store: '<a href="javascript:alert(1)">Clique</a>', date: '2026-10-01' };
    const result = sanitizeReceipt(input);
    assert.ok(!result.store.includes('javascript:'), 'javascript: não deve estar presente');
  });

  test('deve remover conteúdo interno de <style> embutido', () => {
    const input = { category: '<style>body{display:none}</style>Alimentação' };
    const result = sanitizeReceipt(input);
    assert.ok(!result.category.includes('<style>'), 'Tag <style> não deve estar presente');
    // O conteúdo interno é removido pelo stripIgnoreTagBody
    assert.ok(!result.category.includes('display:none'), 'Conteúdo CSS interno não deve estar presente');
  });

  test('deve preservar texto normal sem tags HTML', () => {
    const input = { store: 'Supermercado Central', category: 'Alimentação', method: 'Débito' };
    const result = sanitizeReceipt(input);
    assert.equal(result.store, 'Supermercado Central');
    assert.equal(result.category, 'Alimentação');
    assert.equal(result.method, 'Débito');
  });

  test('deve preservar campos não-string intactos (números, booleans, arrays)', () => {
    const input = {
      store: 'Farmácia',
      totalCents: 5000,
      payer: 'him',
      items: [{ name: 'Remédio', priceCents: 5000 }],
    };
    const result = sanitizeReceipt(input);
    assert.equal(result.totalCents, 5000);
    assert.equal(result.payer, 'him');
    assert.deepEqual(result.items, [{ name: 'Remédio', priceCents: 5000 }]);
  });

  test('sanitizeString deve remover tags HTML', () => {
    const result = sanitizeString('<b>Negrito</b> e texto normal');
    assert.ok(!result.includes('<b>'), 'Tag <b> não deve estar presente');
    assert.ok(!result.includes('</b>'), 'Tag </b> não deve estar presente');
    assert.ok(result.includes('Negrito'), 'Texto puro deve ser preservado');
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. Testes de DTO — whitelist de campos (ExpenseRepository)
// ────────────────────────────────────────────────────────────────────
describe('DTO Whitelist — Proteção contra NoSQL Field Injection', () => {

  test('deve descartar campo isAdmin fora da whitelist', () => {
    const input = { store: 'Padaria', date: '2026-10-01', isAdmin: true };
    const dto = toReceiptDTO_TEST(input);
    assert.equal(dto.isAdmin, undefined, 'isAdmin deve ser descartado pelo DTO');
    assert.equal(dto.store, 'Padaria', 'store deve ser preservado');
  });

  test('deve descartar __proto__ (prototype pollution attempt)', () => {
    const malicious = JSON.parse('{"store":"Test","__proto__":{"polluted":true}}');
    const dto = toReceiptDTO_TEST(malicious);
    assert.equal(dto.__proto__, Object.prototype, '__proto__ não deve ser sobrescrito');
    assert.equal(dto.store, 'Test');
  });

  test('deve descartar campo constructor fora da whitelist', () => {
    const input = { store: 'Loja', constructor: 'payload_malicioso', date: '2026-10-01' };
    const dto = toReceiptDTO_TEST(input);
    // constructor não está na whitelist, portanto deve ser o Function nativo, não a string
    assert.notEqual(typeof dto.constructor, 'string', 'constructor não deve ser sobrescrito com string');
  });

  test('deve descartar múltiplos campos extras de uma vez', () => {
    const input = {
      store: 'Supermercado',
      date: '2026-10-01',
      totalCents: 1500,
      isAdmin: true,
      role: 'admin',
      _fireId: 'injecao_de_id',
      userId: 'outro_usuario',
    };
    const dto = toReceiptDTO_TEST(input);
    assert.equal(dto.isAdmin, undefined);
    assert.equal(dto.role, undefined);
    assert.equal(dto._fireId, undefined, '_fireId não pode ser injetado externamente');
    assert.equal(dto.userId, undefined);
    // Campos legítimos devem passar
    assert.equal(dto.store, 'Supermercado');
    assert.equal(dto.totalCents, 1500);
  });

  test('deve preservar todos os campos da whitelist quando presentes', () => {
    const valid = {
      store: 'Padaria',
      date: '2026-10-01',
      type: 'store',
      payer: 'him',
      method: 'Débito',
      category: 'Alimentação',
      scope: 'household',
      status: 'open',
      totalCents: 3000,
      amountCents: 3000,
      createdAt: 1700000000000,
    };
    const dto = toReceiptDTO_TEST(valid);
    for (const [key, value] of Object.entries(valid)) {
      assert.equal(dto[key], value, `Campo ${key} deve ser preservado`);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Testes de Validação Zod — payloads maliciosos via HTTP
// ────────────────────────────────────────────────────────────────────
describe('Validação Zod — Rejeição de Payloads Maliciosos via HTTP', () => {
  let server;
  let baseUrl;

  // Setup do servidor de teste
  test('setup', async () => {
    const app = express();
    app.use(express.json());
    app.post('/receipt', validateRequest({ body: createReceiptSchema }), (req, res) => {
      res.status(201).json({ success: true, data: req.body });
    });
    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  test('deve rejeitar payer fora do enum (tentativa de escalação de privilégio)', async () => {
    const res = await fetch(`${baseUrl}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store: 'Loja', date: '2026-10-01', payer: 'admin' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field === 'payer'));
  });

  test('deve rejeitar scope inválido fora do enum', async () => {
    const res = await fetch(`${baseUrl}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store: 'Loja', date: '2026-10-01', scope: 'global' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field === 'scope'));
  });

  test('deve rejeitar priceCents negativo em item do recibo', async () => {
    const res = await fetch(`${baseUrl}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store: 'Supermercado',
        date: '2026-10-01',
        items: [{ name: 'Item', priceCents: -9999 }],
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field.includes('priceCents')));
  });

  test('deve rejeitar store vazio (string vazia)', async () => {
    const res = await fetch(`${baseUrl}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store: '', date: '2026-10-01' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field === 'store'));
  });

  test('deve rejeitar store maior que 150 caracteres', async () => {
    const res = await fetch(`${baseUrl}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store: 'A'.repeat(151), date: '2026-10-01' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'VALIDATION_ERROR');
    assert.ok(body.details.some(d => d.field === 'store'));
  });

  // Teardown
  test('teardown', async () => {
    if (server) await new Promise(resolve => server.close(resolve));
  });
});
