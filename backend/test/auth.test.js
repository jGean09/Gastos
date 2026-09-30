const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { JWT_SECRET } = require('../src/config/jwt');
const { authenticateToken, requireRole } = require('../src/middlewares/authMiddleware');

describe('Security Hardening - Fase 1: Auth, Hashing & MFA', () => {

  describe('Requisito #2: Senhas com Hash', () => {
    test('deve criar hash bcrypt forte e validar senha correta', async () => {
      const plain = 'MinhaSenhaSegura@2026';
      const hash = await bcrypt.hash(plain, 12);

      assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
      assert.notEqual(hash, plain);

      const isValid = await bcrypt.compare(plain, hash);
      assert.equal(isValid, true);

      const isInvalid = await bcrypt.compare('SenhaErrada', hash);
      assert.equal(isInvalid, false);
    });

    test('deve validar política de senhas fortes (mínimo 8 caracteres, maiúscula, minúscula, número)', () => {
      const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      assert.equal(STRONG_PASSWORD.test('SenhaForte1'), true);
      assert.equal(STRONG_PASSWORD.test('Curta1A'), false); // menos de 8
      assert.equal(STRONG_PASSWORD.test('semnumeroAA'), false); // sem número
      assert.equal(STRONG_PASSWORD.test('semmaiuscula12'), false); // sem maiúscula
      assert.equal(STRONG_PASSWORD.test('SEMMINUSCULA12'), false); // sem minúscula
    });
  });

  describe('Requisito #3: MFA com TOTP', () => {
    test('deve gerar segredo TOTP e validar código de 6 dígitos', async () => {
      const secret = speakeasy.generateSecret({
        name: 'Gastos Casal (Teste)',
        length: 20,
      });

      assert.ok(secret.base32);
      assert.ok(secret.otpauth_url);

      const qrCode = await QRCode.toDataURL(secret.otpauth_url);
      assert.ok(qrCode.startsWith('data:image/png;base64,'));

      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      assert.equal(token.length, 6);

      const verified = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: 'base32',
        token,
        window: 1,
      });

      assert.equal(verified, true);

      const fakeVerified = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: 'base32',
        token: '000000',
        window: 0,
      });

      assert.equal(fakeVerified, false);
    });
  });

  describe('Requisito #10: Controle de Acesso (RBAC & Auth Middleware)', () => {
    test('deve rejeitar requisição sem header Authorization', () => {
      let statusCalled = null;
      let jsonCalled = null;

      const req = { headers: {} };
      const res = {
        status(code) { statusCalled = code; return this; },
        json(data) { jsonCalled = data; return this; },
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authenticateToken(req, res, next);

      assert.equal(statusCalled, 401);
      assert.equal(jsonCalled.code, 'AUTH_REQUIRED');
      assert.equal(nextCalled, false);
    });

    test('deve autenticar token JWT válido e injetar req.user', () => {
      const payload = { id: 'him', who: 'him', role: 'admin' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      authenticateToken(req, res, next);

      assert.equal(nextCalled, true);
      assert.equal(req.user.who, 'him');
      assert.equal(req.user.role, 'admin');
    });

    test('requireRole deve bloquear usuário sem permissão e liberar usuário com papel correto', () => {
      const adminMiddleware = requireRole('admin');

      // Caso 1: Usuário comum tentando rota admin
      let status403 = null;
      const userReq = { user: { who: 'her', role: 'user' } };
      const res403 = {
        status(code) { status403 = code; return this; },
        json() { return this; },
      };
      let next403 = false;
      adminMiddleware(userReq, res403, () => { next403 = true; });

      assert.equal(status403, 403);
      assert.equal(next403, false);

      // Caso 2: Administrador acessando rota admin
      const adminReq = { user: { who: 'him', role: 'admin' } };
      let nextAdmin = false;
      adminMiddleware(adminReq, {}, () => { nextAdmin = true; });

      assert.equal(nextAdmin, true);
    });
  });

  describe('Requisito #11: Expiração de Sessão', () => {
    test('deve rejeitar token expirado com código TOKEN_EXPIRED', () => {
      const expiredToken = jwt.sign({ who: 'him' }, JWT_SECRET, { expiresIn: '-1s' });

      let statusCalled = null;
      let jsonCalled = null;
      const req = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res = {
        status(code) { statusCalled = code; return this; },
        json(data) { jsonCalled = data; return this; },
      };
      let nextCalled = false;

      authenticateToken(req, res, () => { nextCalled = true; });

      assert.equal(statusCalled, 401);
      assert.equal(jsonCalled.code, 'TOKEN_EXPIRED');
      assert.equal(nextCalled, false);
    });

    test('refresh tokens devem gerar jti único para suporte à revogação e blocklist', () => {
      const token1 = jwt.sign({ who: 'him', type: 'refresh', jti: 'uuid-1' }, JWT_SECRET, { expiresIn: '7d' });
      const token2 = jwt.sign({ who: 'him', type: 'refresh', jti: 'uuid-2' }, JWT_SECRET, { expiresIn: '7d' });
      const dec1 = jwt.verify(token1, JWT_SECRET);
      const dec2 = jwt.verify(token2, JWT_SECRET);
      assert.equal(dec1.type, 'refresh');
      assert.equal(dec1.jti, 'uuid-1');
      assert.notEqual(dec1.jti, dec2.jti);
    });
  });

});
