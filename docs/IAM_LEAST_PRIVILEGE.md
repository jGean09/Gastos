# Guia de Configuração do IAM do GCP (Princípio do Menor Privilégio - PMP)

Para garantir a máxima segurança dos dados financeiros do projeto **Gastos do Casal**, a conta de serviço (Service Account) utilizada pelo Firebase Admin / API Backend deve obedecer estritamente ao Princípio do Menor Privilégio (PMP).

---

## 1. Regras do IAM (Identity and Access Management)

### ❌ Permissões Proibidas em Produção
- `roles/owner` (Proprietário)
- `roles/editor` (Editor)
- `roles/firebase.admin` (Administrador Firebase Completo)

### ✅ Papel Recomendado (Mínimo Necessário)
- **`roles/datastore.user` (Usuário do Cloud Datastore / Firestore)**
  - Concede acesso exclusivo de leitura e escrita nos documentos da base de dados Firestore.
  - Impede que a conta altere regras de segurança do banco, modifique buckets do Cloud Storage ou crie/exclua outros recursos do GCP.

---

## 2. Passo a Passo de Configuração no Google Cloud Console

1. Acesse o [Console do IAM do Google Cloud](https://console.cloud.google.com/iam-admin/iam).
2. Localize a conta de serviço associada à aplicação (`gastos-casal-backend@...`).
3. Clique no ícone de lápis **Editar principal**.
4. Remova papéis genéricos (`Editor` / `Owner`).
5. Adicione o papel **`Cloud Datastore User`** (`roles/datastore.user`).
6. Salve as alterações.

---

## 3. Segurança das Regras do Cloud Firestore

No arquivo de regras do Firestore (`firestore.rules`), o acesso direto de clientes não autenticados deve ser totalmente bloqueado:

```ruby
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Bloqueia leituras e escritas diretas pela SDK Web pública (todas as operações passam pelo backend autenticado)
      allow read, write: if false;
    }
  }
}
```
