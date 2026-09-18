# 01: Filtragem por Ciclo e Cache em Memória (Backend)

**What to build:** O backend passará a ser capaz de enviar apenas os dados de um ciclo específico (ex: fatura atual) em vez de enviar o banco de dados inteiro. Além disso, o servidor vai memorizar (fazer cache em memória) a última resposta do Firebase; assim, se a pessoa abrir o app e ninguém tiver feito compras novas, o servidor devolve a resposta instantaneamente sem gastar leitura no banco. O cache deve ser esvaziado imediatamente sempre que houver qualquer alteração nos gastos (novo Pix, nova compra, deleção, edição).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] A API (`ExpenseController` e `ExpenseService`) recebe e trata um parâmetro `?cycle=current` (ou string específica).
- [x] Os dados passam a ser filtrados (pode ser via consulta no Firebase ou pós-busca em memória) antes de serem enviados ao cliente.
- [x] `ExpenseService` implementa um cache simples (objeto global ou Map) que guarda o resultado do Firebase.
- [x] O cache é retornado imediatamente se for válido.
- [x] O cache é invalidado e destruído (`cache.clear()`) nos métodos de criação, exclusão e alteração de despesas ou fechamento de fatura.
