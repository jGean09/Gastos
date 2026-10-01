# 04: Gestão de Segredos, Princípio do Menor Privilégio (PMP) e Segurança de Dependências

> **Requisitos contemplados:**
> - [x] **#12: Secrets (Gestão de Segredos e Variáveis de Ambiente)**
> - [x] **#17: Dependências (Auditoria Contínua e Gestão de Vulnerabilidades)**
> - [x] **#18: PMP (Princípio do Menor Privilégio / Least Privilege)**

---

## What to build:

Estabelecer governança sobre credenciais de acesso, privilégios de execução no ecossistema Google Cloud / Firebase e integridade da cadeia de suprimentos de pacotes (Supply Chain Security).

### Componentes Chave:
1. **Gestão de Segredos e Proteção de `.env`:**
   - Criar arquivo `.gitignore` unificado e abrangente na raiz do repositório para evitar que chaves privadas (`serviceAccountKey.json`, `.env`, certificados SSL, credenciais de produção) sejam commitadas no Git.
   - Criar arquivo `.env.example` com placeholders claros de todas as variáveis necessárias:
     - `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `JWT_SECRET`, `FIREBASE_CREDENTIALS_JSON`, etc.
   - Adicionar validação de variáveis de ambiente no boot do servidor via Zod / `dotenv-safe`: o servidor deve falhar imediatamente na inicialização se alguma variável obrigatória estiver ausente ou inválida.
   - Em produção (Render / GCP), os segredos devem ser injetados exclusivamente via Environment Secrets ou GCP Secret Manager, nunca mantidos em arquivos no repositório.

2. **Princípio do Menor Privilégio (PMP - Least Privilege) no GCP e Firebase:**
   - **Service Account do Firebase Admin:** restringir o papel da conta de serviço no Google Cloud IAM. Em vez de utilizar papéis amplos como `Owner` ou `Editor`, conceder estritamente `roles/datastore.user` (leitura/escrita no Firestore).
   - **Firestore Security Rules:** revisar e reforçar as regras do Cloud Firestore para que clientes web diretos não consigam ler ou alterar coleções de forma anônima se a arquitetura for via API backend (`allow read, write: if false;` ou restrito ao `request.auth != null`).

3. **Auditoria e Segurança de Dependências:**
   - Adicionar pipeline de checagem de vulnerabilidades:
     - Script `npm run audit` e configuração de travamento de build caso existam vulnerabilidades de nível `High` ou `Critical`.
   - Adicionar configuração do GitHub Dependabot (`.github/dependabot.yml`) para verificar automaticamente atualizações de segurança semanais nos diretórios `Gastos/backend` e dependências frontend.
   - Garantir que o arquivo `package-lock.json` esteja sempre versionado para congelar a árvore de dependências exatas.

---

**Blocked by:** None (pode ser iniciado imediatamente).

**Status:** done

---

## Acceptance Criteria:

- [x] `.gitignore` consolidado na raiz do projeto garantindo que nenhum `.env`, `*.pem`, `*.json` de credencial possa ser adicionado ao git.
- [x] `.env.example` documentado com todas as variáveis requeridas e seus formatos.
- [x] O boot da aplicação valida a presença e integridade de todas as variáveis de ambiente essenciais.
- [x] Guia de configuração do IAM do GCP com permissões mínimas (`roles/datastore.user`) documentado em `docs/IAM_LEAST_PRIVILEGE.md`.
- [x] Script de auditoria de vulnerabilidades (`npm run audit`) configurado no `package.json`.
- [x] Arquivo de automação `.github/dependabot.yml` configurado para monitoramento de CVEs.
