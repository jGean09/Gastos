# 05: Logs Estruturados, Auditoria de Segurança e Monitoramento

> **Requisitos contemplados:**
> - [x] **#14: LOGS (Logging Estruturado e Auditoria de Eventos Sensíveis)**
> - [x] **#19: Monitoramento (Health Checks, Uptime e Rastreamento de Erros)**

---

## What to build:

Implementar observabilidade completa na aplicação, permitindo detecção precoce de anomalias, rastreamento de erros em tempo real e auditoria formal de operações financeiras sensíveis.

### Componentes Chave:
1. **Logging Estruturado em JSON com Pino:**
   - Substituir chamadas soltas de `console.log` e `console.error` pelo logger estruturado `pino` (com `pino-http` para o Express).
   - Injetar em cada requisição um identificador de correlação (`x-request-id` / `correlationId`) gerado via `crypto.randomUUID()`.
   - Formato padronizado de log:
     - `timestamp` (ISO 8601 UTC)
     - `level` (`info`, `warn`, `error`)
     - `requestId`
     - `method`, `url`, `statusCode`, `responseTimeMs`
     - `ip` (anonimizado / mascarado se necessário)
     - `userId` (quando autenticado)
   - **Mascaramento Automático de Dados Pessoais e Sensíveis (PII):**
     - O logger deve mascarar automaticamente campos como `password`, `token`, `authorization`, `creditCard`, `pixKey`, `email`.

2. **Trilha de Auditoria (Audit Logs) para Ações Críticas:**
   - Criar uma coleção ou canal de log dedicado para auditoria de segurança (`audit_logs` no Firestore ou log estruturado com tag `[AUDIT]`):
     - Login com sucesso / falha de login (com contagem de tentativas erradas).
     - Fechamento de ciclo de fatura (`closeCycle`).
     - Exclusão em lote de faturas (`clearAllReceipts`).
     - Alteração de limites de categorias e configurações do sistema.

3. **Monitoramento Ativo e Health Checks:**
   - Expandir a rota de health check (`GET /health`) para um diagnóstico real do sistema:
     - Status do servidor HTTP (ok).
     - Conectividade com o Firestore (ping de leitura/escrita).
     - Consumo de memória (`process.memoryUsage()`) e tempo de atividade (`process.uptime()`).
   - Retorno de status HTTP 200 (saudável) ou HTTP 503 (serviço degradado / Firestore inacessível).
   - Integração com monitor de uptime gratuito (Better Stack / UptimeRobot / health-check do Render) para alertas automáticos caso a API fique fora do ar.
   - Integração com capturador de erros em tempo real (ex: Sentry ou GlitchTip) no backend e no frontend para receber notificações de exceções não tratadas.

---

**Blocked by:** Phase 01 / Phase 02

**Status:** ready

---

## Acceptance Criteria:

- [ ] Logger estruturado `pino` configurado em `backend/src/config/logger.js`.
- [ ] Middleware `correlationId` associando um UUID para cada requisição recebida.
- [ ] Nenhum segredo ou dado sensível (senhas, tokens) aparece em texto puro nos logs do servidor.
- [ ] Eventos críticos (tentativas de invasão, login, `clearAll`, `closeCycle`) gravados com tag explícita de auditoria.
- [ ] Rota `GET /health` responde com métricas completas de saúde do servidor e do banco de dados.
- [ ] Configuração de alerta de uptime e rastreamento de exceções documentada e pronta para ativação.
