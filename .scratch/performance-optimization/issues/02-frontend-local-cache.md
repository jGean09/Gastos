# 02: Cache Local e Sincronização em Background (Frontend)

**What to build:** O aplicativo vai carregar instantaneamente, sem travar na tela de loading branca. Ao abrir, ele vai usar o `localStorage` do navegador para desenhar a fatura do último acesso. Imediatamente após carregar a tela, ele exibe uma discreta barra "Sincronizando..." no topo e pede os dados atualizados para a API (focando apenas no mês atual). Assim que a API responde, ele atualiza o Cache e o AppState invisivelmente, removendo a barra.

**Blocked by:** 01 (requer a API para buscar apenas o ciclo `current` de forma otimizada).

**Status:** ready-for-agent

- [ ] A função `initApp()` verifica o `localStorage.getItem('gastos_current_cycle')`.
- [ ] Se os dados em cache existirem, eles são aplicados no `AppState.allReceipts` e a tela é renderizada na hora (0.01s).
- [ ] O frontend faz a busca `api.getReceipts({ cycle: 'current' })`.
- [ ] Enquanto busca, a UI exibe uma barra de alerta/carregamento sutil "Sincronizando..." (sem impedir cliques ou leitura da tela).
- [ ] Ao obter resposta, o `localStorage` é salvo, o `AppState` é atualizado silenciósamente e a barra de sincronização desaparece.
