# 01: Substituir seletor de pessoas por pílulas de abas na tela de Histórico

**What to build:**
Substituir o menu seletor dropdown `filter-person` na tela de Histórico por 4 botões em formato de pílulas/abas no topo do histórico (`👩‍❤️‍👨 Compras do Casal`, `🔵 Somente Gean`, `🔴 Somente Luciana`, `🌐 Todos os Lançamentos`).
A pílula ativa deve ter destaque visual. A aba padrão selecionada ao carregar deve ser "Compras do Casal".
A filtragem de lançamentos na tela de Histórico deve seguir estritamente as regras:
- **Compras do Casal**: Recibos onde há itens divididos/compartilhados (`himCents > 0 && herCents > 0`), ou com itens para ambos.
- **Somente Gean**: Recibos onde 100% dos custos pertencem ao Gean (`herCents === 0 && otherCents === 0`).
- **Somente Luciana**: Recibos onde 100% dos custos pertencem à Luciana (`himCents === 0 && otherCents === 0`).
- **Todos os Lançamentos**: Todos os recibos sem restrição.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Remover o dropdown `filter-person` em `index.html` e adicionar a barra de pílulas de navegação por abas.
- [x] Adicionar estilos CSS para a barra de pílulas (`.tab-pill-group` e `.tab-pill`), incluindo o estado ativo (`.active`).
- [x] Atualizar o estado global em `AppState` para armazenar a aba ativa de histórico.
- [x] Atualizar a função `renderHistory()` em `app.js` para filtrar os recibos de acordo com a aba selecionada.
- [x] Garantir que o visual dos cards permaneça consistente (exibindo `🔵 R$ X` / `🔴 R$ Y`).
