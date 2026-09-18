# 02: Adicionar abas de filtragem e recalcular os totais e gráficos na tela de Relatório

**What to build:**
Adicionar a barra de abas (`👩‍❤️‍👨 Compras do Casal`, `🔵 Somente Gean`, `🔴 Somente Luciana`, `🌐 Todos os Lançamentos`) no topo da tela de Relatório.
Ao alternar as abas, a função `renderReport()` deve recalcular dinamicamente os valores exibidos em toda a tela:
- Consumo individual e total
- Gráfico de rosca da proporção
- Ranking de gastos por categoria
- Ranking de estabelecimentos ("Onde vocês mais gastaram")
- Lista detalhada de contas na fatura

**Blocked by:** 01-history-tab-pills-ui

**Status:** done

- [x] Renderizar a barra de pílulas de navegação por abas no topo de `renderReport()`.
- [x] Aplicar o filtro da aba ativa na lista de recibos antes dos cálculos do relatório.
- [x] Atualizar o gráfico de rosca, cards de estátisticas, lista de categorias e lista de lojas para responderem à aba ativa.
- [x] Testar a alternância entre abas no Relatório e verificar se os totais recalculam com precisão.
