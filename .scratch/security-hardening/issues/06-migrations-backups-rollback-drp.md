# 06: Migrações de Banco, Estratégia de Rollback, Backups Automáticos e Plano de Recuperação (DRP)

> **Requisitos contemplados:**
> - [x] **#8: Migrations (Versionamento e Evolução de Esquema)**
> - [x] **#9: Rollback (Reversão Segura de Código e Dados)**
> - [x] **#15: Backup's (Backups Programados e Exportação de Dados)**
> - [x] **#20: Plano de Recuperação (Disaster Recovery Plan - DRP)**

---

## What to build:

Estabelecer a resiliência de longo prazo dos dados financeiros do casal, garantindo que alterações no modelo de dados possam ser aplicadas e revertidas com segurança, que existam cópias de segurança confiáveis e que haja um procedimento formal de contingência para qualquer cenário de perda de dados.

### Componentes Chave:
1. **Sistema de Migrações Idempotentes para Firestore:**
   - Criar estrutura `backend/src/migrations/`:
     - Scripts numerados sequencialmente (ex: `001_add_household_id.js`, `002_convert_amounts_to_cents.js`).
     - Cada migração deve implementar funções `up(db)` e `down(db)`.
     - Suporte a modo *dry-run* (simula o número de documentos afetados sem persistir).
   - Manter histórico das migrações aplicadas na coleção de controle `_schema_migrations` no Firestore para garantir idempotência (nunca reexecutar uma migração já concluída).
   - Comandos npm dedicados: `npm run migrate:up`, `npm run migrate:status`, `npm run migrate:down`.

2. **Estratégia de Rollback (Código e Banco):**
   - **Rollback de Código:**
     - Utilizar deploys imutáveis com histórico de commits limpo e tags semânticas (ex: `v1.2.0`).
     - Procedimento rápido de rollback na plataforma de deploy (Render / Firebase Hosting) com retorno para a versão anterior em 1 clique via dashboard ou `git revert`.
   - **Rollback de Dados:**
     - Antes de qualquer migração estrutural, um snapshot ou exportação do Firestore deve ser disparado obrigatoriamente.
     - Scripts de `down` para operações compensatórias caso uma migração falhe na metade do caminho.

3. **Automação de Backups do Cloud Firestore:**
   - Configurar rotina de backup gerenciado do Google Cloud Firestore:
     - Export diário automatizado via Cloud Scheduler / Cloud Functions ou GCP Scheduled Export para um bucket Cloud Storage (`gs://gastos-casal-backups/firestore-daily/`).
     - Política de ciclo de vida (Lifecycle Rule) no bucket: retenção de 30 dias com deleção automática das cópias mais antigas para economizar custos.
   - Script de exportação pontual sob demanda (`npm run db:backup`) para uso antes de manutenções manuais.

4. **Plano de Recuperação de Desastres (Disaster Recovery Plan - DRP):**
   - Criar documento formal `docs/DRP.md` especificando:
     - **RPO (Recovery Point Objective):** tolerância máxima de 24 horas de perda de dados em caso de destruição do banco.
     - **RTO (Recovery Time Objective):** restabelecimento completo do serviço em menos de 1 hora.
     - **Passo a passo de restauração:** comandos exatos do `gcloud firestore import` a partir do bucket de backup.
     - **Checklist de Validação pós-recuperação:** roteiro de testes para conferir integridade dos cálculos de saldo e histórico de recibos.

---

**Blocked by:** Phase 03 / Phase 04

**Status:** ready-for-agent

---

## Acceptance Criteria:

- [ ] Runner de migrações implementado em `backend/src/migrations/runner.js` gravando histórico em `_schema_migrations`.
- [ ] Script de migração de exemplo implementado com métodos `up` e `down` funcionais.
- [ ] Procedimento de rollback de deploy e de banco de dados documentado no repositório.
- [ ] Rotina de backup do Firestore configurada ou script manual `npm run db:backup` disponibilizado.
- [ ] Documento `docs/DRP.md` criado com instruções detalhadas de restauração de desastre, RPO e RTO.
