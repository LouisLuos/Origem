# ADR-005: Adotar Portas e Adaptadores com lock pessimista na reserva para impedir venda duplicada

- **Status:** Aceita
- **Data:** 2026-11-23
- **Autor:** MATHEUS DE FREITAS OLIVEIRA (mfo@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O Origem é um marketplace de artesanato pernambucano em que a maioria das peças é única (estoque = 1). A equipe é pequena, formada por estudantes que cursam outras disciplinas em paralelo, e tem um semestre de prazo. A stack foi acordada com Desenvolvimento Web (backend Express 5 + TypeScript + Prisma 7) e o modelo de dados com Banco de Dados (PostgreSQL no Supabase). Não há orçamento de infraestrutura. A prioridade definida é confiabilidade (ausência de falhas) no fluxo de compra: nenhuma peça pode ser vendida duas vezes (Invariante 1, HU-09).

## Preocupações

consistência do estoque, concorrência, testabilidade, prazo, custo de infraestrutura, desempenho da compra

## Decisão

Estruturar a reserva e a confirmação da compra no padrão Portas e Adaptadores: o serviço de domínio (`reservaEstoque.service.ts`) depende apenas da porta `ReservaEstoqueRepository` (`repositories/contracts/reservas.contracts.ts`) e aplica a regra "só reserva se houver estoque". O adaptador de persistência (`prismaReserva.repository.ts`) implementa essa porta com lock pessimista (`SELECT ... FOR UPDATE` via `tx.$queryRaw` do Prisma) no PostgreSQL, dentro de uma transação, travando as peças sempre em ordem crescente de ID. Efeitos secundários, como notificações, são publicados somente após o commit (ver ADR-001 e ADR-002).

## Justificativa

O lock pessimista faz com que as reservas concorrentes da mesma peça sejam processadas uma de cada vez no banco: a primeira transação trava a linha e baixa o estoque, e as demais encontram estoque 0 e são recusadas com HTTP 409. Isso garante exatamente 1 reserva, as demais recusadas e estoque final 0. Portas e Adaptadores mantém essa regra no serviço, testável sem banco (os testes trocam o adaptador Prisma por um adaptador em memória), e isola o mecanismo de lock no adaptador, que pode ser trocado sem alterar a regra de negócio. A solução usa recursos nativos do PostgreSQL e do Prisma, sem infraestrutura extra.

## Consequências

Ganhos: zero venda duplicada, regra de estoque testável isoladamente, mecanismo de concorrência substituível, nenhum custo extra de infraestrutura.
Perdas: mais interfaces e arquivos (porta, adaptador Prisma e adaptador "não configurado"), o que aumenta o esforço inicial da equipe; SQL escrito à mão (`$queryRaw`) para o lock, com menos ajuda do ORM. Reservas da mesma peça ficam serializadas, o que aumenta a latência sob alta disputa. Há risco de deadlock em carrinhos com várias peças, mitigado travando as peças sempre na mesma ordem (por ID).

## Alternativas consideradas

Orientado a Eventos na baixa de estoque (baixa assíncrona): descartado porque a consistência eventual permitiria confirmar a compra antes de garantir o estoque. CQRS: descartado pela complexidade e por não resolver a disputa por estoque. Camadas tradicionais sem porta: descartado porque o serviço passaria a depender do Prisma, dificultando os testes da regra. Lock otimista (coluna de versão): descartado porque, com estoque 1 e muita disputa, quase todas as transações falhariam e precisariam de nova tentativa.

## Rastreabilidade

**Atributo de qualidade:** Confiabilidade · Ausência de falhas

**Cenário que originou a decisão:**

> Em operação normal, com uma peça artesanal de estoque igual a 1, 50 compradores autenticados tentam reservar essa mesma peça ao mesmo tempo. O módulo de reserva confirma apenas uma e recusa as demais informando que o item esgotou, resultando em exatamente 1 reserva criada (HTTP 201), 49 recusas (HTTP 409), estoque final igual a 0 e nenhum estoque negativo.

**Padrão arquitetural adotado:** Portas e Adaptadores

**Táticas empacotadas:** Encapsular a dependência externa; Usar intermediário (a porta); Inverter e injetar dependência; Isolar dependência externa para teste

HU-09 (Carrinho Fracionado e Reserva Concorrente), HU-06 (Lotes e Estoque), HU-10 (Checkout), RNF-01 (Consistência Transacional), RNF-03 (Tempo de Resposta), RNF-08 (Testabilidade). Módulos: `backend/src/services/reservaEstoque.service.ts`, `backend/src/repositories/contracts/reservas.contracts.ts`, `backend/src/repositories/prismaReserva.repository.ts` (função `lockPecasOrdenadas`) e `backend/src/repositories/prismaPedidoPagamento.repository.ts`.

## Verificação

- **Teste do cenário (unitário):** `backend/tests/hu09/hu09-carrinho-reserva-concorrente.test.ts`, caso TC-STRESS-01: dispara 50 requisições simultâneas contra a API Express com um adaptador em memória que reproduz a semântica do `FOR UPDATE`. Passa com exatamente 1 HTTP 201, 49 HTTP 409 e estoque final 0. Executado com `npm test` em 23/11/2026: 241 testes, 241 aprovados.
- **Teste do cenário (integração com PostgreSQL real):** `backend/tests/integracao/hu06-estoque-concorrencia.test.ts`, caso TC-STRESS-01 em escala (50 compradores para 1 unidade e 10 compradores para lote de 3) usando o adaptador Prisma real. Executado com `npm run test:integration`.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
