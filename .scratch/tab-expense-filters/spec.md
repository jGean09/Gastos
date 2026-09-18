# Especificação Técnica: Divisão por Abas de Compras (Casal vs. Individuais)

## Problem Statement

Atualmente, na tela de Histórico, a filtragem de quem consumiu é feita por um menu dropdown (`filter-person`) com as opções "Todos", "Só meus" e "Só dela". Essa interface não reflete de forma clara e direta a intenção do casal de diferenciar os gastos compartilhados dos gastos 100% individuais de cada um. Além disso, a tela de Relatório não possui esse mesmo filtro rápido por tipo de gasto, o que dificulta visualizar os resumos e estatísticas isoladamente para o casal ou para cada membro.

## Solution

Substituir o menu seletor atual por um conjunto de 4 abas/pílulas horizontais destacadas no topo das telas de **Histórico** e **Relatório**:

1. **👩‍❤️‍👨 Compras do Casal (Aba padrão)**: Exibe apenas compras compartilhadas (recibos divididos entre os dois, com itens para ambos ou com itens mistos).
2. **🔵 Somente Gean**: Exibe apenas recibos cujos itens pertencem 100% exclusivamente ao Gean (`herCents === 0` e `otherCents === 0`).
3. **🔴 Somente Luciana**: Exibe apenas recibos cujos itens pertencem 100% exclusivamente à Luciana (`himCents === 0` e `otherCents === 0`).
4. **🌐 Todos os Lançamentos**: Exibe todos os lançamentos sem nenhuma filtragem de dono/divisão.

## User Stories

1. As a couple user, I want the default view of History to open on "Compras do Casal", so that I can immediately focus on shared expenses that impact our joint budget.
2. As Gean, I want to click on the "Somente Gean" tab in History, so that I can quickly review all purchases where 100% of the cost was mine.
3. As Luciana, I want to click on the "Somente Luciana" tab in History, so that I can view only my personal expenses without mixed couple items.
4. As a user, I want to click on "Todos os Lançamentos", so that I can see the complete history of all receipts regardless of who paid or consumed them.
5. As a user, I want receipt cards in History to keep their standard visual badges (`🔵 R$ X` / `🔴 R$ Y`) across all tabs, so that the visual design remains consistent and recognizable.
6. As a user, I want the Report screen to feature the same 4 tab filters, so that all total calculations, charts, and top stores dynamically reflect the selected expense mode.
7. As a user, I want the selected tab state to feel responsive with visual indicator styling (highlighted background, active color), so that I instantly know which filter is currently active.

## Implementation Decisions

- **State Management**: Add a global or tab-specific state variable (e.g., `AppState.historyTabFilter` and `AppState.reportTabFilter`) defaulting to `'couple'`.
- **Classification Logic**:
  - `'couple'`: Receipts where `himCents > 0 && herCents > 0`, or receipts containing shared/divided items (`split === 'both'`), or mixed receipts.
  - `'him'`: Receipts where `himCents > 0 && herCents === 0 && otherCents === 0`.
  - `'her'`: Receipts where `herCents > 0 && himCents === 0 && otherCents === 0`.
  - `'all'`: All receipts in the active invoice cycle.
- **UI Components**:
  - Replace `<select id="filter-person">` in `index.html` with a horizontal pill button group (`.tab-pill-group`).
  - Add a matching `.tab-pill-group` at the top of `#report-content` in `app.js`.
- **Rendering Trigger**: Clicking a tab updates the active state and re-invokes `renderHistory()` or `renderReport()`.

## Testing Decisions

- **Seam**: High-level behavioral testing of `renderHistory()` and `renderReport()` with mock datasets containing:
  - 100% Gean receipts
  - 100% Luciana receipts
  - 50/50 shared receipts
  - Mixed receipts (Gean item + Luciana item)
- **Validation**: Verify that switching tabs filters the displayed list to match exact expected item counts and calculated totals.

## Out of Scope

- Modifying the upload or expense creation flow.
- Modifying backend Firebase security rules or data structures.
- Changing individual item splitting options inside receipts.

## Further Notes

- The tab visual design should use the existing theme variables (`var(--both)`, `var(--him)`, `var(--her)`, `var(--primary)`).
