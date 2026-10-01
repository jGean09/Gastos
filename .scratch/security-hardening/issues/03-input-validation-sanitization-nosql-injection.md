# 03: Validação de Inputs, Sanitização de Dados e Proteção contra NoSQL/SQL Injection

> **Requisitos contemplados:**
> - [x] **#5: Validação de Inputs (Schema Validation)**
> - [x] **#6: Sanitização de Dados (Anti-XSS)**
> - [x] **#7: Proteção contra Injeção (SQL & NoSQL Injection no Firestore)**

---

## What to build:

Garantir que nenhum dado não confiável originado da interface ou de sistemas externos possa corromper o banco de dados Firestore, executar scripts maliciosos (Stored XSS) ou explorar comportamentos anômalos no backend.

### Componentes Chave:
1. **Validação Estrita de Esquemas com Zod:**
   - Adicionar biblioteca `zod` no backend.
   - Criar esquemas rigorosos para todas as entidades e requisições:
     - `createReceiptSchema`: valida `store` (string, max 100 caracteres), `date` (data ISO válida), `type` (enum restrito: `'store' | 'pix' | 'custom' | 'settlement'`), `payer` (`'him' | 'her'`), `amountCents` ou valores decimais positivos (com limites razoáveis, ex: R$ 0,01 a R$ 100.000,00), `scope` (`'household' | 'individual'`).
     - `updateReceiptSchema`: valida campos parciais com tipos e restrições idênticas.
     - `closeCycleSchema`: valida dados de fechamento, valores pagos e nomes dos pagadores.
     - `settingsSchema`: valida limites por categoria e orçamentos configurados.
   - Rejeição com HTTP 422 / 400 detalhando os campos inválidos sem vazar stacktrace de sistema.
   - Modo estrito (*strict parsing*): qualquer campo adicional desconhecido (ex: `isAdmin`, `_id`, protótipos) deve ser descartado ou causar erro de validação.

2. **Sanitização de Strings e Proteção contra XSS:**
   - Sanitizar campos textuais livres (`store`, `description`, `notes`, `category`) no backend utilizando `xss` ou `sanitize-html` antes de persistir no banco.
   - No frontend (`app.js` e views):
     - Auditar todas as atribuições `element.innerHTML = ...` para garantir que dados dinâmicos de recibos passem por escape seguro (`escapeHtml()` ou uso prioritário de `textContent`).
     - Bloquear tags perigosas (`<script>`, `<iframe>`, `javascript:`, `onerror=`) nos inputs de formulário.

3. **Prevenção contra NoSQL Injection & Object Poisoning no Firestore:**
   - Como o Firestore não usa SQL textual, o risco principal é a passagem de objetos aninhados arbitrários que alterem dados restritos via `col.doc(id).set(fields, { merge: true })`.
   - Adicionar camada de DTO (Data Transfer Object) no `ExpenseRepository`:
     - O repositório jamais aceita `req.body` diretamente.
     - Apenas um objeto tipado e sanitizado contendo campos previamente permitidos na whitelist é passado para as funções `.add()`, `.set()` ou `.update()`.
   - Validação de identificadores de documento (`id` do Firestore): garantir que o ID obedeça ao formato alfanumérico padrão do Firestore antes de buscar ou deletar documentos.

---

**Blocked by:** Phase 01 / Phase 02 (pode ser iniciado assim que os esquemas de rotas forem definidos).

**Status:** done

---

## Acceptance Criteria:

- [x] Biblioteca `zod` integrada com middleware de validação genérico `validateRequest({ body, query, params })`.
- [x] Validação ativa para todas as rotas de criação, atualização e exclusão em `ExpenseController`.
- [x] Testes de envio de payloads maliciosos (strings com scripts `<script>alert(1)</script>`, números negativos, campos com prototype pollution) são bloqueados com erro 400/422.
- [x] Repositórios desacoplados de `req.body` com uso obrigatório de DTOs mapeados.
- [x] Frontend sanitiza e escapa todo texto renderizado dinamicamente em tabelas e cards de recibos.
