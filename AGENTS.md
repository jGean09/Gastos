## Agent skills

### Issue tracker

Issues live in GitHub Issues (repo: jGean09/Gastos). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.

##  Regra de Commits

- *Nunca executar git commit* (ou qualquer comando de escrita no histórico do Git) sem antes perguntar explicitamente ao usuário e receber confirmação. Isso vale mesmo que o usuário tenha pedido para "implementar a feature X" sem mencionar commit — implementar não é sinônimo de autorização para commitar.
- *Prefira commits pequenos e atômicos*: um commit por unidade lógica de trabalho (ex: criar um hook, criar um componente e integrá-lo, corrigir um bug específico), em vez de acumular várias mudanças não relacionadas em um único commit no final da sessão.
- *Ao concluir uma unidade lógica de trabalho, PARE e apresente ao usuário:*
  1. Um resumo do que foi alterado (arquivos e o motivo da mudança).
  2. Uma mensagem de commit sugerida, seguindo [Conventional Commits](https://www.conventionalcommits.org/) (ex: feat: adiciona KpiCard de progresso, fix: corrige cálculo de média no gráfico, refactor: extrai lógica de fetch para hook useHistorico).
  3. Aguardar aprovação (ou ajuste da mensagem) antes de rodar git add e git commit.
- *Se uma tarefa gerar múltiplas unidades lógicas* (ex: criar hook + criar componente + integrar na página), separar em múltiplos checkpoints de commit propostos, um por vez, em vez de propor um único commit no final cobrindo tudo.
- *Nunca fazer git push* sem confirmação explícita do usuário, mesmo após o commit ser aprovado.