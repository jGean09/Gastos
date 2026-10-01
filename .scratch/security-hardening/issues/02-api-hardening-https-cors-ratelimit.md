# 02: Proteção de Rede, HTTPS, CORS Estrito, Rate Limiting e Criptografia

> **Requisitos contemplados:**
> - [x] **#1: HTTPS (TLS / HSTS)**
> - [x] **#4: Rate Limit (Limitação de Taxa de Requisições)**
> - [x] **#13: CORS (Cross-Origin Resource Sharing Seguro)**
> - [x] **#16: Criptografia (Em Trânsito e Repouso)**

---

## What to build:

Fortalecer a camada de rede e transporte da API Express e do Frontend estático, blindando a aplicação contra ataques de negação de serviço (DoS), ataques de força bruta, sequestro de requisições de origem cruzada e interceptação de tráfego (Man-in-the-Middle).

### Componentes Chave:
1. **HTTPS Forçado & Headers de Segurança com Helmet:**
   - Instalação e configuração de `helmet` no backend Express para injetar headers essenciais:
     - `Strict-Transport-Security` (HSTS: `max-age=31536000; includeSubDomains; preload`).
     - `X-Content-Type-Options: nosniff`.
     - `X-Frame-Options: DENY` (prevenção contra Clickjacking).
     - `Content-Security-Policy` (CSP) adaptada para os scripts e estilos da aplicação.
   - Forçar redirecionamento de `http://` para `https://` em ambientes de produção (Render / Firebase Hosting).

2. **Rate Limiting Granular (`express-rate-limit`):**
   - **Rate Limit Geral:** máx. 100 requisições a cada 15 minutos por IP para navegação regular.
   - **Rate Limit de Autenticação:** máx. 5 tentativas de login por IP a cada 15 minutos (mitigação contra ataques de força bruta e credential stuffing).
   - **Rate Limit para Mutações Sensíveis:** máx. 20 requisições por hora para fechamento de ciclo e exclusão de faturas (`/api/receipts/close-cycle`, `/api/receipts/all`).
   - Retorno padronizado HTTP 429 (`Too Many Requests`) com cabeçalho `Retry-After`.

3. **CORS Rigoroso e Auditado:**
   - Eliminar a brecha atual em `server.js` que permite requisições arbitrárias sem `origin` em rotas mutáveis.
   - Restringir estritamente as origens permitidas via variável de ambiente `ALLOWED_ORIGINS` (ex: `https://gastos-casal-26c77.web.app`, `https://gastos-casal-26c77.firebaseapp.com` e `localhost` apenas quando `NODE_ENV !== 'production'`).
   - Especificar explicitamente métodos HTTP permitidos: `['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']`.
   - Limitar `allowedHeaders` para `['Content-Type', 'Authorization', 'X-Requested-With']`.

4. **Criptografia em Trânsito e em Repouso:**
   - Garantir TLS 1.3 como padrão de comunicação cliente-servidor.
   - Verificar conformidade da criptografia em repouso padrão do Google Cloud KMS no Firestore.
   - Chaves e dados confidenciais (ex: tokens de integração bancária ou segredos TOTP) devem ser armazenados com criptografia simétrica AES-256-GCM antes de gravar no banco.

---

**Blocked by:** None (pode ser executado em paralelo com a Fase 1).

**Status:** done

---

## Acceptance Criteria:

- [x] Pacotes `helmet` e `express-rate-limit` instalados e configurados em `Gastos/backend`.
- [x] Requisições com métodos HTTP inválidos ou com headers perigosos são rejeitadas com status adequado.
- [x] Rate limit disparado após ultrapassar o teto estipulado, devolvendo HTTP 429 com mensagem explicativa em JSON.
- [x] Origens não autorizadas são bloqueadas pelo CORS com erro amigável e sem vazamento de stacktrace.
- [x] Headers de segurança HSTS e No-Sniff validados via verificação de headers de resposta.
- [x] Dados sensíveis criptografados em repouso com algoritmo padrão da indústria (AES-256-GCM).
