const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado pelo NIST para AES-GCM
const PREFIX = 'enc:v1:';

/**
 * Obtém ou deriva a chave de 256 bits (32 bytes) para o AES-GCM.
 * Se ENCRYPTION_KEY estiver no .env, utiliza-a (deve ter 32 bytes ou 64 caracteres hex).
 * Caso contrário, deriva deterministicamente uma chave segura de 32 bytes via SHA-256 do JWT_SECRET.
 */
function getEncryptionKey() {
  if (process.env.ENCRYPTION_KEY) {
    const raw = process.env.ENCRYPTION_KEY;
    if (raw.length === 64) {
      return Buffer.from(raw, 'hex');
    }
    return crypto.createHash('sha256').update(raw).digest();
  }

  const fallbackSecret = process.env.JWT_SECRET || 'gastos-casal-default-dev-secret-key-2026';
  return crypto.createHash('sha256').update(fallbackSecret).digest();
}

/**
 * Criptografa um texto em repouso com AES-256-GCM (Criptografia Autenticada).
 * Formato resultante: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
function encrypt(plainText) {
  if (!plainText || typeof plainText !== 'string') return plainText;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descriptografa um texto criptografado em repouso com AES-256-GCM.
 * Se o texto não contiver o prefixo enc:v1:, retorna o texto original (retrocompatibilidade segura).
 */
function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith(PREFIX)) {
    return cipherText;
  }

  const key = getEncryptionKey();
  const parts = cipherText.slice(PREFIX.length).split(':');

  if (parts.length !== 3) {
    throw new Error('Formato de dados criptografados inválido.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    throw new Error(`Falha na descriptografia: dados corrompidos ou chave inválida (${err.message}).`);
  }
}

/**
 * Verifica se um determinado valor está criptografado no formato AES-256-GCM.
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
};
