## Problem Statement

O aplicativo carrega uma grande quantidade de dados a cada inicialização e mutação. Quando o front-end solicita `GET /api/receipts`, o back-end retorna todos os recibos já cadastrados em todo o histórico da aplicação. Isso gera lentidão na rede (payload gigante) e lentidão no banco de dados. Além disso, a aplicação trava a interface toda vez que ocorre uma exclusão ou inclusão, aguardando um refresh completo que derruba a usabilidade quando o usuário está em redes móveis (4G) intermitentes.

## Solution

Implementar uma arquitetura de Cliente-Servidor otimizada com três pilares principais:
1. **Filtro no Backend:** O servidor Node.js entregará apenas a fatura solicitada (ex: `current`) para economizar banda.
2. **Sistema Híbrido de Cache:** O servidor Node.js armazenará a leitura na memória (Server Cache) para evitar bater no Firestore a todo instante, e o navegador usará `localStorage` (Local Cache) para desenhar a interface em 0.01s na abertura.
3. **Interface Otimista (Optimistic UI):** As mutações (criação, deleção) alterarão a interface do usuário imediatamente e sincronizarão em background. Caso haja falha de rede, a interface informará o erro e permitirá uma nova tentativa sem perder os dados.

## User Stories

1. As an usuário final, I want o aplicativo carregando os gastos instantaneamente ao ser aberto, so that eu possa conferir minhas contas rapidamente sem ver telas de carregamento brancas.
2. As an usuário final, I want que meus novos gastos (Pix, Cartão) apareçam na tela imediatamente após eu clicar em "Salvar", so that eu sinta que o aplicativo é responsivo e não preciso esperar um loading que trava a tela.
3. As an usuário em movimento, I want ser avisado claramente se o gasto que acabei de adicionar não foi salvo no servidor devido a falhas na internet, so that eu possa tentar enviá-lo novamente depois sem precisar redigitar tudo.
4. As an desenvolvedor, I want que o servidor mande apenas os dados da fatura do mês atual no carregamento inicial, so that o tráfego de rede e o consumo do banco de dados (Firestore) sejam reduzidos ao mínimo possível.
5. As an usuário consultando o histórico, I want que o aplicativo faça o download dos meses anteriores apenas quando eu clicar na aba "Histórico", so that a tela principal continue absurdamente rápida.
6. As an usuário no navegador móvel, I want ver uma indicação sutil de "Sincronizando..." no topo da tela enquanto o cache local é atualizado com as novidades do banco de dados, so that eu saiba que a aplicação está buscando a verdade absoluta.
7. As an provedor da nuvem (Render/Firebase), I want que a API em Node.js sirva requisições simultâneas usando um cache em memória se ninguém tiver cadastrado dados nos últimos segundos, so that os custos de leitura no Firestore diminuam.

## Implementation Decisions

- **Node.js Memory Cache:**
  - `ExpenseService` vai ter uma propriedade (ex: `const cache = new Map()`).
  - Ao fazer um GET filtrado por `cycle`, o Node verifica o map. Se houver os dados e forem válidos, devolve na hora.
  - O cache não terá expiração por tempo (TTL), será infinito. Mas será 100% limpo sempre que as funções `addReceipt`, `deleteReceipt`, `updateReceipt`, `toggleReceiptStatus`, e `closeCycle` forem chamadas.
- **API Fetch Filtering:**
  - O controlador de `GET /receipts` processará a querystring `?cycle=current` ou `?cycle=all`.
  - O backend continuará lendo todo o banco se o Firebase não estiver estruturado para ler apenas do ciclo (para evitar custos de criação de index complexo que impactem a estrutura atual), mas a filtragem ocorrerá antes da resposta HTTP, diminuindo brutalmente o Payload.
- **Optimistic UI em `app.js`:**
  - Ao invés de aguardar o fechamento do modal e o retorno de `api.getReceipts()`, `saveExpense()` cria um ID fake temporário (`temp_123`) e altera o state `AppState.allReceipts`. Em caso de falha, adiciona-se o campo `_syncStatus: 'failed'` e força o re-render.
  - Ícones vermelhos e botões ".btn-retry" serão inseridos no HTML dinâmico quando `_syncStatus === 'failed'`.
- **Local Cache (`localStorage`):**
  - Variável de chave: `gastos_current_cycle`.
  - `initApp()` fará parse desta variável. Se encontrar um array, inicializa `AppState.allReceipts` e imediatamente chama `renderAll()`.
  - Uma barra `.sync-bar` (`display: block` e `display: none`) gerenciará o feedback visual.
- **Comportamento da Aba Histórico:**
  - Um novo flag no state (`historyLoaded = false`). Ao tentar desenhar o Histórico, verifica esse flag. Se falso, engatilha `GET /api/receipts?cycle=all`, exibe um spinner, salva no state, muda para `true` e redesenha.

## Testing Decisions

- A principal seam para testar no Backend será bater nos endpoints `GET /api/receipts?cycle=current` repetidas vezes via terminal (cURL/Postman) e observar nos logs do backend se a consulta no Firestore está ocorrendo (deve ocorrer apenas na primeira requisição, ou logo após uma mutação).
- A seam para a Interface Otimista e Cache será desligar a conexão com a internet (Offline Mode do Chrome DevTools) logo após adicionar um recibo. A expectativa é o recibo ficar vermelho com botão de Tentar Novamente sem que a aplicação crashe.
- Prior art: Não há testes automatizados maduros; a validação visual ocorrerá nos renders (`renderReport`, `renderHistory`) que são as maiores engrenagens da aplicação cliente.

## Out of Scope

- Otimização da escrita no banco (ex. transações pesadas do Firebase). As escritas continuarão síncronas.
- Service Workers (PWA pleno) para habilitar acesso 100% offline. O objetivo é Optimistic UI e Cache rápido, não transformar o app numa PWA complexa instalável que guarde uploads em fila de banco de dados offline.
- Mudança na modelagem do banco no Firestore para suportar paginação profunda com `startAfter()`. Como o fluxo do app é voltado a fechar faturas mensais, gerenciar a paginação por "ciclos" e usar a memória do Node.js é infinitamente mais adequado do que cursores de Firebase clássicos.

## Further Notes

- O design da barrinha sutil "Sincronizando..." deve ser harmônico (talvez cores da paleta, com um gradiente CSS discreto ou spinner inline), no topo da tela, evitando ser intrusivo.
- O botão "Tentar Novamente" no item que falhar pode simplesmente recuperar os dados daquele item e submetê-los no mesmo fluxo de `api.request('POST')`.
