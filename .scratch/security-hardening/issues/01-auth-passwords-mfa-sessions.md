# 01: Autenticação, Senhas Fortes, MFA e Controle de Sessão

> **Requisitos contemplados:**
> - [x] **#2: Senhas com Hash**
> - [x] **#3: MFA (Autenticação Multifator)**
> - [x] **#10: Controle de Acesso (RBAC)**
> - [x] **#11: Expiração de Sessão**

---

## What to build:

Implementar uma camada completa de autenticação e autorização para o aplicativo **Gastos do Casal**, eliminando o acesso anônimo a todas as rotas da API e protegendo a integridade das finanças do casal.

### Componentes Chave:
1. **Hashing Seguro de Senhas:**
   - Adicionar suporte a hashing com `bcrypt` (fator de custo 12) ou `argon2id`.
   - Política de senhas mínimas: mínimo de 8 caracteres, contendo letras maiúsculas, minúsculas, números e caracteres especiais.
   - Nenhuma senha jamais deve ser gravada em texto plano ou trafegada sem TLS.

2. **Autenticação Multifator (MFA / 2FA):**
   - Suporte a autenticação TOTP (Time-Based One-Time Password via Google Authenticator, Authy ou 1Password) usando biblioteca como `speakeasy` + `qrcode`.
   - Geração de códigos de recuperação de emergência (backup recovery codes) com hashing de uso único.

3. **Controle de Acesso Baseado em Papéis (RBAC) e Household Isolation:**
   - Criação da coleção `users` no Firestore (`email`, `passwordHash`, `mfaSecret`, `mfaEnabled`, `role`, `householdId`, `createdAt`).
   - Papéis (`roles`): `user` (pode criar, visualizar e editar recibos do casal) e `admin` (pode fechar faturas, gerenciar membros e configurações globais).
   - Middleware `authMiddleware.js` no Express que extrai e valida o token Bearer ou cookie de sessão antes de cada rota de `/api/*`.

4. **Gerenciamento e Expiração de Sessão:**
   - Implementação de JWT com chave secreta forte (`JWT_SECRET`).
   - **Access Token:** validade curta (ex: 15 a 30 minutos).
   - **Refresh Token:** persistido de forma segura com expiração de 7 dias, armazenado em cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
   - Endpoint de logout `/api/auth/logout` que invalida o refresh token imediatamente.

---

**Blocked by:** None (pode ser iniciado imediatamente).

**Status:** done

---

## Acceptance Criteria:

- [x] Criado módulo de serviços de autenticação (`AuthService.js`) com rotas `/api/auth/login`, `/api/auth/login/mfa`, `/api/auth/refresh`, `/api/auth/me`.
- [x] Senhas recebidas são submetidas a hash com `bcrypt` (12 rounds) antes de serem persistidas no Firestore, com migração automática transparente de senhas legadas em texto plano.
- [x] Implementado fluxo completo de 2FA/MFA com geração de chave TOTP, QR Code em Base64 e validação de token de 6 dígitos.
- [x] Criado middleware `authenticateToken` que bloqueia qualquer requisição não autenticada em rotas protegidas (`/api/receipts/*`, `/api/settings`) com HTTP 401.
- [x] Criado middleware `requireRole('admin')` para ações críticas (ex: `/api/receipts/all`).
- [x] Sessões gerenciadas com JWT com renovação automática silenciosa via refresh token em caso de token expirado.
- [x] Interface do usuário atualizada com fluxo de login com suporte a MFA, gestão de 2FA (QR Code) nas configurações e troca de senha segura.
- [x] Suíte de testes automatizados (`test/auth.test.js`) cobrindo hash bcrypt, MFA TOTP, autorização JWT, bloqueio por papel e expiração de sessão.
