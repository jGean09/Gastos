# Plano de Recuperação de Desastres (DRP), Rollback e Resiliência

> **Fase 6 do Security Hardening — Requisitos #8 (Migrations), #9 (Rollback), #15 (Backups) e #20 (Plano de Continuidade e DRP)**

Este documento estabelece as diretrizes formais para recuperação de desastres, continuidade operacional, versionamento de banco de dados, política de cópias de segurança e procedimentos de rollback para a aplicação **Gastos do Casal**.

---

## 1. Métricas Chave de Resiliência (RPO e RTO)

| Métrica | Definição | Meta do Projeto |
|:---|:---|:---:|
| **RPO (Recovery Point Objective)** | Limite máximo tolerável de perda de dados no tempo em caso de desastre físico ou corrupção total do banco. | **24 horas** (ou menos com backups sob demanda) |
| **RTO (Recovery Time Objective)** | Tempo máximo aceitável para restaurar o sistema e deixá-lo 100% operacional após um incidente crítico. | **Menos de 1 hora** |

---

## 2. Sistema de Migrações Idempotentes do Firestore

O esquema do banco evolui de forma controlada através de scripts versionados em [`backend/src/migrations/scripts/`](file:///c:/Users/joseg/Documents/GASTOS/Gastos/backend/src/migrations/scripts).

### Estrutura de Cada Script de Migração:
Cada arquivo exporta `id`, `up(db)` e `down(db)`:
```javascript
module.exports = {
  id: '001_initial_schema_indexes',
  async up(db) {
    // Aplica alterações de esquema ou dados iniciais
  },
  async down(db) {
    // Reverte as alterações aplicadas de forma segura
  },
};
```

### Comandos de Operação (via npm):
- **Verificar status das migrações:**
  ```bash
  npm run migrate:status --prefix backend
  ```
- **Aplicar migrações pendentes (`up`):**
  ```bash
  npm run migrate:up --prefix backend
  # Ou simular sem alterar o banco:
  npm run migrate:up --prefix backend -- --dry-run
  ```
- **Reverter a última migração (`down`):**
  ```bash
  npm run migrate:down --prefix backend
  # Ou simular sem alterar o banco:
  npm run migrate:down --prefix backend -- --dry-run
  ```

### Garantia de Idempotência:
As migrações executadas são gravadas de forma atômica na coleção `_schema_migrations` do Firestore. O `MigrationRunner` ignora automaticamente scripts já executados, evitando duplicação.

---

## 3. Política e Rotinas de Backup

### 3.1. Backup Pontual Pré-Deploy / Pré-Migração (Local / Operacional)
Antes de qualquer alteração de esquema ou manutenção manual, gere um snapshot completo das coleções:
```bash
npm run db:backup --prefix backend
```
O arquivo gerado é salvo em `backend/backups/backup-gastos-<timestamp>.json` com metadados de integridade.

### 3.2. Backup Automatizado Diário em Nuvem (Google Cloud Firestore)
Para produção, o Firestore possui integração nativa com o **Google Cloud Storage**:

1. **Configuração via Google Cloud Console:**
   - Crie um bucket dedicado no Cloud Storage: `gs://gastos-casal-firestore-backups/`
   - Configure regra de ciclo de vida (Lifecycle Rule): retenção de 30 dias com deleção automática das cópias antigas.
2. **Automação Diária via Cloud Scheduler:**
   - Crie um job agendado no Cloud Scheduler (cron: `0 3 * * *` — todo dia às 03:00 UTC).
   - Target HTTP disparando a API do Firestore:
     ```http
     POST https://firestore.googleapis.com/v1/projects/[PROJECT_ID]/databases/(default):exportDocuments
     Content-Type: application/json
     {
       "outputUriPrefix": "gs://gastos-casal-firestore-backups/daily"
     }
     ```

---

## 4. Procedimentos de Rollback de Emergência

### 4.1. Rollback de Código e Deploy

Se uma nova versão em produção apresentar instabilidade ou erros críticos:

1. **Rollback Imediato na Plataforma (Render / Firebase):**
   - Acesse o painel do Render > Serviço `gastos-casal-api` > **Deploys**.
   - Localize o commit estável anterior e clique em **Rollback to this deploy**.
   - O tráfego será redirecionado em segundos para a versão anterior sem downtime.

2. **Rollback via Git:**
   - Se for necessário reverter no repositório:
     ```bash
     git revert HEAD --no-edit
     git push origin main
     ```

### 4.2. Rollback de Dados e Esquema

1. Se uma migração falhou na metade do caminho:
   ```bash
   npm run migrate:down --prefix backend
   ```
2. Se houve corrupção de dados após deploy:
   - Siga o procedimento de restauração de desastre abaixo.

---

## 5. Roteiro Passo a Passo de Restauração de Desastres (DRP)

Em caso de destruição acidental da base ou corrupção catastrófica:

### Etapa 1: Notificação e Congelamento do Sistema (Minuto 0 a 5)
1. Coloque a API em modo de manutenção ou interrompa o serviço no Render para impedir novas escritas incorretas:
   - Defina `MAINTENANCE_MODE=true` nas variáveis de ambiente.

### Etapa 2: Localização do Ponto de Restauração Mais Recente (Minuto 5 a 15)
1. Verifique os backups disponíveis no bucket:
   ```bash
   gcloud storage ls gs://gastos-casal-firestore-backups/daily/
   ```
2. Escolha o snapshot mais recente anterior ao incidente.

### Etapa 3: Restauração no Firestore (Minuto 15 a 40)
1. Execute o comando oficial do Google Cloud SDK para importação dos dados:
   ```bash
   gcloud firestore import gs://gastos-casal-firestore-backups/daily/[TIMESTAMP_DA_PASTA] --project=[PROJECT_ID]
   ```
2. Caso esteja utilizando o backup JSON local (`backup.js`), execute a importação das coleções correspondentes utilizando o runner do SDK.

### Etapa 4: Validação de Integridade Pós-Recuperação (Minuto 40 a 50)
Execute o checklist obrigatório:
- [ ] Rota `GET /health` responde HTTP 200 (`healthy`) com banco conectado.
- [ ] Total de documentos na coleção `receipts` condiz com o esperado.
- [ ] Coleção `settings` contém as chaves de configuração ativas.
- [ ] Login e validação MFA funcionam sem inconsistência de sessão.
- [ ] Balanço financeiro do ciclo atual calcula o rateio corretamente.

### Etapa 5: Reabertura do Sistema (Minuto 50 a 60)
1. Remova o `MAINTENANCE_MODE` no Render.
2. Comunique os usuários de que o sistema está 100% operacional.
3. Registre um Post-Mortem detalhando a causa raiz, tempo de recuperação e medidas preventivas.
