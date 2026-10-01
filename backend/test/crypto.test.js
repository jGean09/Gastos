const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const speakeasy = require('speakeasy');
const { encrypt, decrypt, isEncrypted } = require('../src/utils/crypto');

describe('Security Hardening - Fase 2: Criptografia em Repouso AES-256-GCM (#16)', () => {

  test('deve criptografar texto em repouso no formato enc:v1:<iv>:<tag>:<ciphertext>', () => {
    const plain = 'JBSWY3DPEHPK3PXP'; // Exemplo de segredo TOTP base32
    const encrypted = encrypt(plain);

    assert.ok(isEncrypted(encrypted));
    assert.ok(encrypted.startsWith('enc:v1:'));
    assert.notEqual(encrypted, plain);

    const parts = encrypted.slice('enc:v1:'.length).split(':');
    assert.equal(parts.length, 3, 'Deve conter exatamente 3 partes: IV, AuthTag e Ciphertext');
    assert.equal(parts[0].length, 24, 'IV de 12 bytes deve ter 24 caracteres hexadecimais');
    assert.equal(parts[1].length, 32, 'AuthTag de 16 bytes deve ter 32 caracteres hexadecimais');
  });

  test('deve descriptografar com sucesso retornando exatamente o texto original', () => {
    const plain = 'MEU_SEGREDO_SUPER_CONFIDENCIAL_123';
    const encrypted = encrypt(plain);
    const decrypted = decrypt(encrypted);

    assert.equal(decrypted, plain);
  });

  test('dois textos idênticos devem gerar ciphertexts diferentes devido ao IV aleatório', () => {
    const plain = 'MESMO_SEGREDO';
    const enc1 = encrypt(plain);
    const enc2 = encrypt(plain);

    assert.notEqual(enc1, enc2, 'Cada cifragem deve usar um IV único e aleatório');
    assert.equal(decrypt(enc1), plain);
    assert.equal(decrypt(enc2), plain);
  });

  test('deve rejeitar e lançar erro se os dados cifrados ou a tag forem adulterados (GCM Integrity)', () => {
    const plain = 'DADOS_INTEGROS';
    const encrypted = encrypt(plain);
    const parts = encrypted.slice('enc:v1:'.length).split(':');

    // Substitui o último byte (2 caracteres hexadecimais) por 'ff' para simular adulteração
    const lastByte = parts[2].slice(-2);
    const newByte = lastByte === 'ff' ? '00' : 'ff';
    const tamperedCipher = parts[2].slice(0, -2) + newByte;
    const tampered = `enc:v1:${parts[0]}:${parts[1]}:${tamperedCipher}`;

    assert.throws(() => {
      decrypt(tampered);
    }, /Falha na descriptografia/);
  });

  test('deve manter retrocompatibilidade com segredos em texto puro legados', () => {
    const legacyPlain = 'SEGREDO_LEGADO_SEM_PREFIXO';
    assert.equal(isEncrypted(legacyPlain), false);
    assert.equal(decrypt(legacyPlain), legacyPlain);
  });

  test('deve funcionar perfeitamente com o fluxo completo de MFA TOTP', () => {
    // 1. Gera segredo TOTP real
    const secret = speakeasy.generateSecret({ length: 20 });
    const originalBase32 = secret.base32;

    // 2. Criptografa para persistir em repouso
    const encryptedInDb = encrypt(originalBase32);
    assert.ok(isEncrypted(encryptedInDb));

    // 3. Simula leitura do banco e descriptografia para validar código
    const decryptedSecret = decrypt(encryptedInDb);
    assert.equal(decryptedSecret, originalBase32);

    // 4. Gera token com segredo original e valida com segredo descriptografado
    const token = speakeasy.totp({ secret: originalBase32, encoding: 'base32' });
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    assert.equal(isValid, true);
  });

});
