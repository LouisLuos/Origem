# ADR-001: Adotar Portas e Adaptadores com lock pessimista no checkout para impedir venda duplicada

- **Status:** Proposta
- **Data:** 2026-11-23
- **Autor:** MATHEUS DE FREITAS OLIVEIRA (mfo@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O Origem é um marketplace de artesanato pernambucano em que a maioria das peças é única (estoque = 1). A equipe é pequena, formada por estudantes que cursam outras disciplinas em paralelo, e tem um semestre de prazo. A stack foi acordada com Desenvolvimento Web (backend Spring Boot + JPA) e o modelo de dados com Banco de Dados (PostgreSQL). Não há orçamento de infraestrutura. A prioridade definida é confiabilidade (ausência de falhas) no checkout: nenhuma peça pode ser vendida duas vezes.

## Preocupações

consistência do estoque, concorrência, testabilidade, prazo, custo de infraestrutura, desempenho do checkout

## Decisão

Estruturar o checkout no padrão Portas e Adaptadores: o domínio declara uma porta para reservar o produto e aplica a regra "só vende se houver estoque", e o adaptador de persistência implementa essa porta com lock pessimista (SELECT ... FOR UPDATE) no PostgreSQL, dentro de uma transação. Eventos assíncronos são publicados somente após o commit, para efeitos secundários como notificação.

## Justificativa

O lock pessimista faz com que as compras concorrentes da mesma peça sejam processadas uma de cada vez no banco: a primeira transação reserva a linha e baixa o estoque, e as demais encontram estoque 0 e são recusadas com HTTP 409. Isso garante exatamente 1 pedido, 99 recusas e estoque final 0 no cenário da etapa 2. Portas e Adaptadores mantém essa regra no domínio, testável sem banco, e isola o mecanismo de lock no adaptador, que pode ser trocado sem alterar a regra de negócio. A solução usa recursos nativos do PostgreSQL e do Spring, sem infraestrutura extra.

## Consequências

Ganhos: zero venda duplicada, regra de estoque testável isoladamente, mecanismo de concorrência substituível, nenhum custo extra de infraestrutura.
Perdas: mais interfaces e classes (porta, adaptador e mapeamento entre entidade de domínio e entidade JPA), o que aumenta o esforço inicial da equipe. Compras da mesma peça ficam serializadas, o que aumenta a latência sob alta disputa. Há risco de deadlock em pedidos com vários itens, o que exige bloquear os produtos sempre na mesma ordem (por ID) e definir timeout de lock.

## Alternativas consideradas

Orientado a Eventos no checkout (baixa de estoque assíncrona): descartado porque a consistência eventual permitiria confirmar a compra antes de garantir o estoque, e exigiria um broker sem orçamento. CQRS: descartado pela complexidade e por não resolver a disputa por estoque. Camadas tradicionais: descartado porque o domínio passaria a depender de JPA, dificultando os testes da regra. Lock otimista (coluna de versão): descartado porque, com estoque 1 e muita disputa, quase todas as transações falhariam e precisariam de nova tentativa.

## Rastreabilidade

**Atributo de qualidade:** Confiabilidade · Ausência de falhas

**Cenário que originou a decisão:**

> Em operação normal, com uma peça artesanal de estoque igual a 1, 100 compradores autenticados finalizam o checkout dessa mesma peça ao mesmo tempo. O módulo de checkout confirma apenas uma compra e recusa as demais informando que o item esgotou, resultando em exatamente 1 pedido criado (HTTP 201), 99 recusas (HTTP 409), estoque final igual a 0 e nenhum estoque negativo.

**Padrão arquitetural adotado:** Portas e Adaptadores

**Táticas empacotadas:** Encapsular a dependência externa; Usar intermediário (a porta); Inverter e injetar dependência; Isolar dependência externa para teste; Adiar vinculação para tempo de configuração

RNF-01 (Consistência Transacional), RNF-03 (Tempo de Resposta), RNF-04 (Arquitetura em Camadas/Desacoplamento), RNF-08 (Testabilidade). Módulos: checkout/pedidos e catálogo/estoque. Documentos: docs/01-requisitos-e-arquitetura/06-requisitos-nao-funcionais-e-arquitetura.md e docs/03-computacao-concorrente-distribuida/01-concorrencia-e-mensageria.md.

## Verificação

- **Teste do cenário:** Teste de integração automatizado (JUnit com ExecutorService contra PostgreSQL) que cadastra uma peça com estoque 1 e dispara 100 requisições simultâneas de checkout. Passa se houver exatamente 1 resposta HTTP 201, 99 respostas HTTP 409, estoque final igual a 0 e exatamente 1 pedido gravado. Complementado por teste ArchUnit garantindo que o domínio não importa JPA nem Spring.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
