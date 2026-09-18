# 02: Category Progress Visualization

**What to build:** Visual tracking of individual category limits. Update the "Progresso da Fatura Atual" (Por Categoria) section to display two vertically stacked mini-bars for each category (one blue for Gean, one pink for Luciana) instead of a single bar.

**Blocked by:** 01-category-limits-config

**Status:** done

- [x] Update `renderGoals` to read individual spent amounts and individual limits per category.
- [x] Replace the single `goalBar` usage in the categories section with two stacked `goalBar` elements using `--him` and `--her` colors.
- [x] Ensure formatting remains neat and correctly visually grouped under each category label.
