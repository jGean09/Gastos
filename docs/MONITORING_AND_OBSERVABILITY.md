# Guia de Monitoramento, Observabilidade e Trilha de Auditoria

> **Fase 5 do Security Hardening — Requisitos #14 (Logs e Auditoria) e #19 (Monitoramento e Uptime)**

Este documento detalha a arquitetura de observabilidade, registro de logs estruturados, correlation IDs, trilha de auditoria e monitoramento de saúde do backend e frontend do aplicativo **Gastos do Casal**.

---

## 1. Logs Estruturados com Pino

A aplicação utiliza o **Pino**, o logger JSON de mais alta performance para o ecossistema Node.js, configurado em [`backend/src/config/logger.js`](file:///c:/Users/joseg/Documents/GASTOS/Gastos/backend/src/config/logger.js).

### Formato Padrão de Log
Cada linha de log é um JSON estruturado seguindo o padrão RFC 5424 e ISO 8601 UTC:

```json
{
  "level": "info",
  "time": "2026-10-01T23:55:00.000Z",
  "pid": 1234,
  "hostname": "render-srv-01",
  "requestId": "e1f13b30-c8f9-43a2-9382-93b5847dbb1b",
  "method": "POST",
  "url": "/api/receipts",
  "statusCode": 201,
  "responseTimeMs": 42,
  "ip": "203.0.113.195",
  "userId": "jose",
  "msg": "HTTP Request Completed"
}
```

### Mascaramento Automático de Dados Pessoais (PII Redaction)
Para total conformidade com a LGPD e boas práticas de segurança (OWASP Logging Cheat Sheet), o logger mascara automaticamente campos sensíveis substituindo seu valor por `[REDACTED]`:
- `password`, `*.password`
- `secret`, `mfaSecret`, `*.secret`
- `token`, `tempToken`, `refreshToken`, `*.token`
- `totpCode`, `*.totpCode`
- `authorization`, `req.headers.authorization`
- `req.headers.cookie`
- `creditCard`, `pixKey`

---

## 2. Correlation ID (`x-request-id`)

O middleware [`backend/src/middlewares/loggerMiddleware.js`](file:///c:/Users/joseg/Documents/GASTOS/Gastos/backend/src/middlewares/loggerMiddleware.js) garante a rastreabilidade ponta a ponta:

1. **Recepção:** Verifica se o cliente enviou `x-request-id` ou `x-correlation-id`.
2. **Geração:** Caso não exista, gera um novo UUID v4 criptográfico (`crypto.randomUUID()`).
3. **Injeção de Resposta:** Devolve o cabeçalho `x-request-id` na resposta HTTP, permitindo que usuários e frontends reportem problemas citando o ID exato da transação.
4. **Contexto de Log:** Cria `req.log`, um child logger que propaga o `requestId` automaticamente para qualquer log disparado durante o ciclo de vida da requisição.

---

## 3. Trilha de Auditoria (Audit Trail)

Operações sensíveis que impactam a segurança do sistema ou os registros financeiros dos usuários disparam eventos de auditoria imutáveis via [`backend/src/services/AuditService.js`](file:///c:/Users/joseg/Documents/GASTOS/Gastos/backend/src/services/AuditService.js).

### Eventos Auditados:
| Evento | Descrição | Nível de Risco |
|:---|:---|:---:|
| `AUTH_LOGIN_SUCCESS` | Login bem-sucedido | Médio |
| `AUTH_LOGIN_FAILURE` | Tentativa de login com senha incorreta | **Alto** |
| `AUTH_MFA_LOGIN_SUCCESS`| Segundo fator validado com sucesso | Médio |
| `AUTH_MFA_LOGIN_FAILURE`| Falha na validação do token TOTP de 6 dígitos | **Alto** |
| `AUTH_MFA_DISABLED` | Desativação voluntária de MFA na conta | **Alto** |
| `EXPENSE_CLOSE_CYCLE` | Fechamento de ciclo de fatura com acerto de contas | **Alto** |
| `EXPENSE_CLEAR_ALL` | Limpeza em lote de faturas | **Crítico** |
| `SETTINGS_UPDATE` | Alteração de limites de categorias ou regras de divisão | Médio |

### Exemplo de Registro de Auditoria:
```json
{
  "type": "AUDIT",
  "auditEvent": "EXPENSE_CLOSE_CYCLE",
  "actor": "jose",
  "ip": "203.0.113.195",
  "status": "SUCCESS",
  "details": {
    "payer": "jose",
    "totalReceiptsArchived": 14
  },
  "timestamp": "2026-10-01T23:55:12.123Z"
}
```

---

## 4. Endpoint de Diagnóstico (`GET /health`)

A rota [`GET /health`](file:///c:/Users/joseg/Documents/GASTOS/Gastos/backend/src/routes/healthRoutes.js) fornece um relatório instantâneo sobre a saúde física do container e da conectividade com o Cloud Firestore.

### Resposta 200 OK (Serviço Saudável):
```json
{
  "status": "healthy",
  "timestamp": "2026-10-01T23:55:00.000Z",
  "uptimeSeconds": 86420,
  "memory": {
    "rssMb": 48,
    "heapUsedMb": 23,
    "heapTotalMb": 35
  },
  "checks": {
    "server": "ok",
    "database": "ok",
    "dbLatencyMs": 14
  }
}
```

### Resposta 503 Service Unavailable (Serviço Degradado / Banco Indisponível):
```json
{
  "status": "degraded",
  "timestamp": "2026-10-01T23:55:00.000Z",
  "uptimeSeconds": 86420,
  "memory": {
    "rssMb": 52,
    "heapUsedMb": 26,
    "heapTotalMb": 38
  },
  "checks": {
    "server": "ok",
    "database": "error"
  }
}
```

---

## 5. Configuração de Monitor de Uptime Gratuito

Para garantir disponibilidade 24/7 e ser alertado proativamente antes que os usuários percebam indisponibilidade:

### Opção A: Better Stack Uptime (Recomendado - Gratuito)
1. Crie uma conta em [betterstack.com](https://betterstack.com).
2. Adicione um novo monitor HTTP:
   - **URL:** `https://seu-backend.onrender.com/health`
   - **Heartbeat Interval:** `3 minutes` (evita que instâncias no plano gratuito do Render hibernem desnecessariamente se configurado com ping frequente).
   - **Expected Status Code:** `200`.
   - **Alerting:** Notificação via WhatsApp, Telegram, E-mail ou Discord Webhook.

### Opção B: UptimeRobot (Alternativa Gratuita)
1. Crie um monitor em [uptimerobot.com](https://uptimerobot.com).
2. Configure o tipo como **HTTP(s)** apontando para `/health`.
3. Defina o monitoramento de 5 em 5 minutos.

---

## 6. Rastreamento de Erros e Exceções (Sentry / GlitchTip)

Para capturar exceções não tratadas em tempo real em produção:

### Integração Backend (Node.js/Express)
1. Instale o SDK:
   ```bash
   npm i @sentry/node @sentry/profiling-node --prefix backend
   ```
2. Adicione a inicialização antes de qualquer outro middleware em `server.js`:
   ```javascript
   const Sentry = require("@sentry/node");

   if (process.env.SENTRY_DSN) {
     Sentry.init({
       dsn: process.env.SENTRY_DSN,
       environment: process.env.NODE_ENV || 'production',
       tracesSampleRate: 0.2, // 20% das transações para telemetria de performance
     });
     app.use(Sentry.Handlers.requestHandler());
     app.use(Sentry.Handlers.tracingHandler());
   }
   ```
3. Registre o handler de erro do Sentry antes do middleware global de tratamento de erros:
   ```javascript
   if (process.env.SENTRY_DSN) {
     app.use(Sentry.Handlers.errorHandler());
   }
   ```

### Integração Frontend (Web App)
1. No `index.html`, carregue o script CDN oficial do Sentry:
   ```html
   <script
     src="https://browser.sentry-cdn.com/7.x/bundle.tracing.min.js"
     crossorigin="anonymous"
   ></script>
   <script>
     if (window.Sentry && window.location.hostname !== 'localhost') {
       Sentry.init({
         dsn: "SUA_DSN_AQUI",
         integrations: [new Sentry.BrowserTracing()],
         tracesSampleRate: 0.1,
       });
     }
   </script>
   ```
