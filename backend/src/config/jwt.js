const crypto = require('crypto');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY] ⚠️  JWT_SECRET não configurado! Usando chave volátil em memória — todos os tokens são invalidados ao reiniciar o servidor. Configure JWT_SECRET no .env para produção.');
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || '7d';

module.exports = {
  JWT_SECRET,
  JWT_EXPIRATION,
  REFRESH_TOKEN_EXPIRATION,
};
