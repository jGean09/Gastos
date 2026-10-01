## Agent skills

### Issue tracker

Issues live in GitHub Issues (repo: jGean09/Gastos). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-dev`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

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

## Fluxo de Trabalho no GitHub

Para qualquer funcionalidade nova ou correção, seguir sempre esta ordem. O erro mais comum é programar primeiro e organizar depois: planejar antes de escrever qualquer linha de código.

```
[Criar Issue] ➔ [Criar Branch] ➔ [Programar/Commit] ➔ [Push] ➔ [Abrir PR linkado à Issue] ➔ [Merge]
```

1. *Criar a Issue (planejamento)*: antes de programar, garantir que existe uma Issue descrevendo o objetivo da funcionalidade ou do bug. Se não existir, propor ao usuário o título e a descrição da Issue e aguardar confirmação antes de seguir.
2. *Criar uma branch (ambiente seguro)*: a partir da `main` atualizada, criar uma branch nova para o trabalho. *Nunca programar direto na `main`.* Usar o número da issue no nome da branch, com prefixo do tipo de trabalho (ex: `feature/ajuste-login-12`, `fix/calculo-media-15` ou `issue-12-nova-funcionalidade`).
3. *Programar e fazer commits (o trabalho)*: desenvolver na branch criada, com commits pequenos, atômicos e em Conventional Commits, sempre respeitando a "Regra de Commits" acima (propor, aguardar aprovação, só então commitar).
4. *Enviar para o GitHub (push)*: ao terminar, enviar a branch com `git push origin nome-da-branch`, *somente após confirmação explícita do usuário*.
5. *Abrir o Pull Request e vincular à Issue (revisão)*: abrir o PR da branch para a `main` e, na descrição, incluir uma palavra-chave de fechamento com o número da issue (ex: `Closes #12` ou `Fixes #12`). Assim o GitHub linka os dois e fecha a Issue automaticamente quando o PR for mesclado. Propor o título e a descrição do PR ao usuário antes de abri-lo.
6. *Fazer o merge (finalização)*: depois que o código for revisado e aprovado (pelo usuário ou por colegas), o merge do PR joga a funcionalidade na `main`. *O agente nunca faz merge por conta própria*; essa etapa é do usuário.

## Skills de Engenharia (mattpocock/skills)

Este repo usa as skills de https://github.com/mattpocock/skills. Elas ficam encaixadas no Fluxo de Trabalho acima; não o substituem. A "Regra de Commits" e as confirmações de push/merge continuam valendo em todas as etapas.

*Regra de invocação:*
- Skills *user-invoked* (`/grill-with-docs`, `/to-spec`, `/to-tickets`, `/implement`, `/implement-spec`, `/triage`, `/handoff`, `/retro`, `/improve-codebase-architecture`) só rodam quando o usuário digitar. O agente *não* dispara essas por conta própria: ele apenas *sugere o próximo passo* quando terminar uma etapa.
- Skills *model-invoked* (`tdd`, `diagnosing-bugs`, `code-review`, `pr`, `domain-modeling`, `codebase-design`, `prototype`, `research`) o agente pode usar sozinho quando a tarefa pedir.
- Uma skill user-invoked pode acionar skills model-invoked, mas nunca outra user-invoked.

### Funcionalidade nova (fluxo completo)

1. *Alinhar:* `/grill-with-docs` para o agente entrevistar o usuário antes de qualquer código, afinando a linguagem do projeto (`CONTEXT.md`) e registrando decisões difíceis em `docs/adr/`. Para temas sem código, `/grill-me`.
2. *Especificar:* `/to-spec` transforma a conversa em uma spec (problema, solução, histórias de usuário, decisões de implementação e seams de teste) e publica no GitHub Issues. Não faz entrevista, só sintetiza o que já foi discutido.
3. *Fatiar:* `/to-tickets` quebra a spec em tickets verticais ("tracer bullets"). Cada ticket atravessa todas as camadas necessárias (dados, regra de negócio, UI e testes), declara quem bloqueia quem (`Blocked by: #N`) e é validado com o usuário antes de publicar. Cada ticket vira uma Issue do passo 1 do fluxo.
4. *Implementar:* por ticket sem dependências pendentes, criar a branch (passo 2 do fluxo) e rodar `/implement` apontando para o ticket. Ele aciona `tdd` (red → green → refactor, uma fatia vertical por vez, nos seams combinados). Para implementar uma spec inteira numa branch de integração, `/implement-spec`.
5. *Revisar:* ao terminar o ticket e com os testes passando, `/code-review` (Standards: segue as regras deste `AGENTS.md` e do repo; Spec: atende exatamente ao ticket, sem escopo extra). Aplicar os ajustes apontados e só então propor o commit conforme a "Regra de Commits".
6. *PR:* seguir os passos 4 a 6 do fluxo. A descrição do PR segue a skill `pr`: resumo visual curto da mudança, evidência de antes/depois e a avaliação de risco do merge (porta de mão única ou dupla, e raio de impacto), sempre com `Closes #N`.

Nunca tentar implementar uma spec inteira num único chat sem fatiar em tickets: isso estoura o contexto e gera alucinação.

### Bugs encontrados em teste manual

Quando o usuário reportar um bug, usar `diagnosing-bugs` em vez de sair adivinhando correção. O agente *não* pode "chutar" fix às cegas. Seguir o loop, fase por fase:

1. Criar um teste automatizado que reproduza o erro exato e falhe (red).
2. Reduzir ao cenário mínimo.
3. Levantar hipóteses e investigar com instrumentação/logs direcionados.
4. Aplicar o fix e deixar a reprodução como teste de regressão permanente (green).

Se o relato vier incompleto, pedir: (1) o que o usuário fez, passo a passo; (2) o que esperava; (3) o que aconteceu de fato (traceback, mensagem de erro ou comportamento estranho). O bug segue o mesmo Fluxo de Trabalho: Issue → branch `fix/...-N` → commits aprovados → PR com `Fixes #N`.

### Manutenção da sessão e do código

- *Contexto longo:* quando a conversa estiver grande ou a sessão for encerrada, sugerir `/handoff` para gerar o documento de continuidade (estado atual, tickets resolvidos e pendentes, e quais skills o próximo agente deve rodar).
- *Mensagem que não ficou clara:* `/wait-what` faz o agente reexplicar com o contexto que faltava, em linguagem simples, usando o vocabulário do `CONTEXT.md`.
- *Qualidade de design:* sugerir `/improve-codebase-architecture` de tempos em tempos (a cada poucos dias de trabalho) para achar oportunidades de aprofundar módulos, e `/retro` ao fim de sessões longas para melhorar o ambiente do agente.
- *Triagem de issues:* `/triage` move as Issues pelas labels definidas em "Triage labels".
- *Escrever/editar este arquivo ou skills:* seguir `writing-for-agents`.

### Setup

Se as skills ainda não estiverem configuradas neste repo, rodar `/setup-matt-pocock-skills` uma vez (tracker: GitHub Issues; labels: as de "Triage labels"; docs: layout de "Domain docs").