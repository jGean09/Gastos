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

## Issues e PRs: sempre direto no GitHub

Issues, Pull Requests e labels vivem **no GitHub (jGean09/Gastos)**, não no repositório local.

- *Nunca criar issues como arquivos locais* (nada de `.scratch/`, `docs/issues/`, `TODO.md`, markdown de "issue" dentro do repo ou qualquer tracker local). Isso vale também para specs e tickets gerados por skills: publicar como Issue no GitHub.
- *Usar o GitHub CLI (`gh`)* para operar direto no GitHub: `gh issue create`, `gh issue list`, `gh issue view`, `gh issue edit` (labels), `gh pr create`, `gh pr view`, `gh pr list`. Se o `gh` não estiver instalado ou autenticado, avisar o usuário em vez de improvisar um substituto local.
- *Antes de criar* uma Issue ou PR, apresentar ao usuário o título, a descrição (e as labels, se for Issue) e aguardar aprovação. Só depois rodar o comando `gh`.
- *Consultar o GitHub antes de assumir estado:* para saber se já existe Issue, qual o número dela ou se um PR já foi mesclado, usar `gh` em vez de deduzir pelo histórico local.
- *Todo PR deve vincular a Issue* com `Closes #N` ou `Fixes #N` na descrição.
- *O agente nunca faz merge de PR por conta própria.* Essa etapa é do usuário.

### Ordem para qualquer funcionalidade ou correção

[Issue no GitHub] ➔ [Branch] ➔ [Programar/Commit] ➔ [Push] ➔ [PR linkado à Issue] ➔ [Merge pelo usuário]

1. *Issue:* garantir que existe uma Issue no GitHub descrevendo o objetivo. Se não existir, propor título e descrição e, com aprovação, criar com `gh issue create`.
2. *Branch:* criar a partir da `main` atualizada (`git pull` antes), com o número da issue no nome e prefixo do tipo de trabalho (ex: `feature/ajuste-login-12`, `fix/calculo-media-15`, `issue-12-nova-funcionalidade`). Nunca programar direto na `main`.
3. *Programar e commitar:* seguir a "Regra de Commits" acima.
4. *Push:* `git push origin nome-da-branch`, somente com confirmação explícita.
5. *PR:* abrir com `gh pr create` (base `main`), com `Closes #N` na descrição.
6. *Merge:* feito pelo usuário.

### Quando o PR anterior ainda não foi mesclado

Se a próxima tarefa começar enquanto o PR da anterior ainda está aberto:

- Se a nova tarefa *não depende* do código do PR aberto, criar a branch a partir da `main` atual e avisar o usuário que o PR anterior continua pendente.
- Se *depende* do código do PR aberto, parar e perguntar ao usuário se espera o merge ou se parte da branch do PR anterior.
- Em nenhum caso decidir isso sozinho em silêncio, nem fazer merge para destravar.

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

