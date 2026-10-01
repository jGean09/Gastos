/**
 * ── Utilitário de Sanitização Anti-XSS ──
 *
 * Limpa campos de texto livres antes de persistir no banco,
 * prevenindo Stored XSS (Cross-Site Scripting).
 *
 * Usa a biblioteca `xss` que aplica uma allowlist de tags HTML
 * e escapa qualquer tag não permitida — por padrão, nenhuma tag é permitida
 * em campos financeiros.
 */
const xss = require('xss');

/**
 * Opções restritivas: bloqueia TODAS as tags HTML.
 * Qualquer `<script>`, `<img onerror=...>`, `<a href="javascript:...">`, etc.
 * será escapado para texto puro antes de chegar ao Firestore.
 */
const STRICT_OPTIONS = {
  whiteList: {},          // Nenhuma tag permitida
  escapeHtml: true,       // Escapa <, >, &, " para entidades HTML
  stripIgnoreTag: true,   // Remove tags não permitidas (não apenas escapa)
  stripIgnoreTagBody: ['script', 'style'], // Também remove o conteúdo interno de <script> e <style>
};

/**
 * Sanitiza uma string usando as opções restritas.
 * @param {string} value
 * @returns {string}
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return xss(value, STRICT_OPTIONS);
}

/**
 * Sanitiza campos textuais específicos de um objeto de dados.
 * Campos não listados em `fields` são retornados sem alteração.
 *
 * @param {object} obj - O objeto de dados a ser sanitizado
 * @param {string[]} fields - Lista de campos de texto livre a sanitizar
 * @returns {object} Novo objeto com os campos sanitizados
 */
function sanitizeFields(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = { ...obj };
  for (const field of fields) {
    if (field in sanitized) {
      sanitized[field] = sanitizeString(sanitized[field]);
    }
  }
  return sanitized;
}

/**
 * Campos textuais livres dos recibos que precisam de sanitização.
 * Campos enumerados (payer, scope, status, type) são controlados pelo Zod — não precisam de xss.
 */
const RECEIPT_TEXT_FIELDS = ['store', 'category', 'method', 'notes', 'description'];

/**
 * Sanitiza os campos de texto de um recibo de gasto.
 * @param {object} receipt
 * @returns {object}
 */
function sanitizeReceipt(receipt) {
  return sanitizeFields(receipt, RECEIPT_TEXT_FIELDS);
}

module.exports = {
  sanitizeString,
  sanitizeFields,
  sanitizeReceipt,
  RECEIPT_TEXT_FIELDS,
};
