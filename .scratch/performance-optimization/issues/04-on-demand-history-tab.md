# 04: Carregamento Sob Demanda da Aba Histórico

**What to build:** A aba "Histórico" vai se tornar "preguiçosa" (lazy loaded). Como a aplicação não baixará mais toda a base de dados no momento em que abrir, a aba Histórico precisará puxar as faturas antigas apenas quando o usuário navegar para ela pela primeira vez na sessão. Durante a busca, o usuário verá um círculo de carregamento, e logo em seguida o histórico do ano inteiro surgirá na tela.

**Blocked by:** 01 e 02 (depende da separação do tráfego entre fatura atual e mundo inteiro da API).

**Status:** ready-for-agent

- [ ] Criar a flag `AppState.historyLoaded = false` na inicialização do aplicativo.
- [ ] No evento de clique da aba "Histórico" ou na função `showPage('history')`, se a flag for `false`, bloquear a renderização e exibir o Spinner de carregamento.
- [ ] Chamar `api.getReceipts({ cycle: 'all' })` para o back-end.
- [ ] Atualizar o `AppState.allReceipts` com o volume de dados total retornado pela API.
- [ ] Alterar `historyLoaded` para `true` e chamar o `renderHistory()` finalizando o fluxo sem puxar da API nos próximos cliques dentro da mesma sessão.
