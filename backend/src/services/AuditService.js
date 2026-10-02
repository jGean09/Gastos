const { logger } = require('../config/logger');

const auditLogger = logger.child({ type: 'AUDIT' });

/**
 * ── Serviço de Trilha de Auditoria (Audit Trail) ──
 * Registra eventos de segurança críticos (tentativas de login, MFA, operações financeiras sensíveis)
 * de forma imutável e estruturada.
 *
 * @param {string} event - Identificador do evento (ex: 'AUTH_LOGIN_SUCCESS', 'EXPENSE_CLOSE_CYCLE')
 * @param {object} params
 * @param {string} [params.actor] - Quem disparou a ação (ex: 'jose', 'anônimo')
 * @param {string} [params.ip] - IP de origem
 * @param {string} [params.status='SUCCESS'] - 'SUCCESS' | 'FAILED' | 'BLOCKED'
 * @param {object} [params.details={}] - Metadados adicionais (sem dados sensíveis)
 * @param {object} [params.db] - Instância opcional do Firestore para persistência
 */
async function logAudit(event, { actor = 'anonymous', ip = 'unknown', status = 'SUCCESS', details = {}, db } = {}) {
  const auditEntry = {
    type: 'AUDIT',
    auditEvent: event,
    actor,
    ip,
    status,
    details,
    timestamp: new Date().toISOString(),
  };

  // 1. Grava no stream de logs estruturados
  auditLogger.info(auditEntry, `[AUDIT] ${event}: ${status}`);

  // 2. Persistência assíncrona no Firestore (se conexão fornecida)
  if (db && typeof db.collection === 'function') {
    try {
      await db.collection('audit_logs').add({
        ...auditEntry,
        createdAt: new Date(),
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Falha ao persistir audit log no Firestore');
    }
  }

  return auditEntry;
}

module.exports = {
  logAudit,
  auditLogger,
};
