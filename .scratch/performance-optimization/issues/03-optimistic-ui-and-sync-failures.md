# 03: Interface Otimista (Optimistic UI) e Tratamento de Falhas

**What to build:** O app mudará a maneira como lida com inclusões e exclusões de gastos. O usuário não ficará mais encarando um modal travado ou tela em loading. Quando clicar em "Salvar", o gasto aparecerá imediatamente na lista e no cálculo total. O aplicativo enviará o comando ao servidor em background. Se a internet falhar (ou no metrô), o gasto ficará vermelho na tela acompanhado de um botão "Tentar Novamente", permitindo ao usuário re-submeter sem perder tudo que preencheu.

**Blocked by:** 01 (é ideal que o backend responda de forma otimizada para estabilizar o fluxo antes de testar otimismo no front).

**Status:** done

- [x] Modificar `saveExpense` em `app.js`. Injetar um objeto temporário com `_fireId: 'temp_' + id` e `_syncStatus: 'pending'` no `AppState.allReceipts`.
- [x] O modal é fechado na hora e `renderAll()` é disparado para exibir a alteração instantânea.
- [x] A chamada para a API (`POST` ou `PATCH`) é executada em background.
- [x] Em caso de SUCESSO: O ID `temp_` é substituído pelo ID real e o `_syncStatus` é deletado.
- [x] Em caso de FALHA: O item recebe `_syncStatus: 'failed'` e a tela é atualizada.
- [x] O front-end exibe uma estilização específica (`style.css` `.receipt-failed`) para itens em estado de erro, incluindo um botão de "Tentar Novamente" que chama a função de salvar novamente.
