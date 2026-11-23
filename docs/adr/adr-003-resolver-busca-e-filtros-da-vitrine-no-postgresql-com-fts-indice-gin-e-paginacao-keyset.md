# ADR-003: Resolver busca e filtros da vitrine no PostgreSQL com Full-Text Search, índice GIN e paginação por cursor

- **Status:** Proposta
- **Data:** 2026-11-23
- **Autor:** EDUARDO HENRIQUE ALBUQUERQUE (ehapa@cesar.school)
- **Turma:** ADS Embarque · 4º período
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

A vitrine é a porta de entrada do Origem: visitantes e compradores procuram peças por palavras-chave (HU-05) e combinam filtros de polo cultural (HU-06), técnica e faixa de preço (HU-07). O RNF-02 exige que essas consultas respondam em até 200 ms no percentil 95 e 500 ms no percentil 99, com uma base de 10.000 peças e 50 requisições concorrentes.

A stack já está definida: Express com TypeScript e Prisma no backend, PostgreSQL como banco (acordado com Banco de Dados) e Redis já em uso para a fila de notificações (ADR-002). A equipe é pequena, tem um semestre de prazo e não tem orçamento para infraestrutura adicional. Os textos das peças estão em português e misturam termos culturais ("maracatu", "renda renascença", "xilogravura") com flexões comuns ("bonecos", "boneco").

A branch `feat/hu-07-vitrine-busca-fts` já implementou parte da solução: índice GIN de Full-Text Search em português sobre título e descrição, índices B-Tree em `pecas(status, tipologia)` e `atelies(polo_cultural)`, e uma consulta que ordena por relevância (`ts_rank`). Porém a listagem devolve todas as peças que atendem ao filtro, sem limite de página, e o teste atual mede uma única requisição com limite de 400 ms, e não a carga exigida pelo RNF-02.

## Preocupações

tempo de resposta sob concorrência, crescimento do catálogo, relevância da busca em português, custo de infraestrutura, consistência entre catálogo e estoque exibido, prazo e complexidade operacional

## Decisão

Resolver a busca textual e os filtros da vitrine dentro do próprio PostgreSQL, atrás da porta `FontePecasVitrine`, com três medidas combinadas:

1. **Full-Text Search em português com índice GIN** sobre título e descrição da peça, usando exatamente a mesma expressão `to_tsvector('portuguese', ...)` no índice e na consulta, para que o planejador use o índice. A ordenação é feita por `ts_rank`, com peso maior para o título.
2. **Índices B-Tree** nas colunas de filtro (`status`, `tipologia`, `polo_cultural` e, a acrescentar, `preco`), para que os filtros combinados não exijam varredura completa da tabela.
3. **Paginação por cursor (keyset)** com tamanho de página fixo e limite máximo no servidor, no lugar de devolver a lista completa ou usar `OFFSET`. O cursor é composto pela chave de ordenação (relevância ou data de criação) mais o `id` da peça, para desempate estável.

Não será adotado motor de busca externo nem cache de resultados nesta fase.

## Justificativa

O índice GIN permite localizar as peças que contêm os termos pesquisados sem ler a tabela inteira, e o dicionário `portuguese` reduz as palavras ao radical, de modo que "bonecos" encontra "boneco". Os índices B-Tree fazem o mesmo para os filtros de polo, técnica e status. A paginação por cursor é o que limita o custo de cada requisição: sem ela, o tempo de resposta e o tamanho do JSON crescem junto com o catálogo, e com 10.000 peças uma busca ampla ("barro") devolveria centenas de registros com fotos e dados do artesão. Com uma página fixa, o trabalho de montar a resposta fica constante, e o cursor evita que o banco precise percorrer e descartar as linhas das páginas anteriores, como acontece com `OFFSET`.

Tudo isso usa recursos nativos do PostgreSQL que a equipe já opera, sem novo serviço para hospedar, sincronizar ou monitorar. A porta `FontePecasVitrine` mantém o mecanismo de busca isolado: se o catálogo crescer além do que o PostgreSQL atende, o adaptador pode ser trocado por um motor dedicado sem alterar o controller nem o frontend.

## Consequências

**Ganhos:** latência previsível mesmo com crescimento do catálogo; busca que entende flexões do português; resultados sempre consistentes com o estoque e o status atuais, porque vêm da mesma base transacional do checkout; nenhum custo de infraestrutura adicional; mecanismo de busca substituível atrás da porta.

**Perdas e riscos:**

- O índice GIN deixa a escrita um pouco mais lenta (publicação e edição de peças), o que é aceitável porque a vitrine tem muito mais leituras do que escritas.
- O FTS não tolera erros de digitação ("maracatú" com acento errado ou "xilogavura") e não encontra trechos no meio de palavras. Se isso se mostrar um problema de usabilidade, a extensão `pg_trgm` (prevista no RNF-02) pode ser acrescentada como complemento.
- O índice cobre apenas título e descrição. A HU-05 pede busca também por nome do artesão e região; isso exige estender a expressão indexada ou combinar com os filtros já indexados, e precisa ser decidido pela equipe.
- A paginação por cursor não permite pular direto para "página 7"; a interface passa a usar "carregar mais" ou rolagem contínua. O contador de resultados da HU-06 ("o contador deve refletir a quantidade exata") passa a exigir uma consulta `COUNT` separada, com custo próprio.
- A consulta de FTS usa SQL bruto (`$queryRaw`), que fica fora da verificação de tipos do Prisma; os parâmetros continuam passados como valores vinculados, sem concatenação de texto, o que mantém a proteção contra SQL Injection exigida pelo RNF-06.

## Alternativas consideradas

- **Motor de busca dedicado (Elasticsearch, OpenSearch ou Meilisearch):** oferece tolerância a erros de digitação e relevância mais refinada, mas exige um serviço extra para hospedar, sincronizar com o PostgreSQL e manter consistente com o estoque. Descartado pelo custo de infraestrutura, pelo prazo e porque a escala do RNF-02 (10.000 peças) está dentro do que o PostgreSQL atende.
- **`ILIKE '%termo%'` sem índice:** é a solução mais simples, mas obriga o banco a ler todas as linhas em cada busca, e o tempo cresce linearmente com o catálogo. Também não entende flexões do português. Descartado por não atender ao RNF-02.
- **Busca e filtros em memória no Node.js:** carregar o catálogo na aplicação e filtrar em JavaScript ocupa o event loop, disputa memória com a API e fica desatualizado em relação ao estoque. Descartado.
- **Cache de resultados no Redis:** o Redis já existe no projeto, e um cache reduziria a latência de buscas repetidas. Adiado, e não descartado: exigiria invalidar o cache a cada venda, reserva ou edição de peça, com risco de exibir como disponível uma peça já vendida. Só será considerado se as medições mostrarem que os índices e a paginação não bastam.
- **Paginação por `OFFSET`:** é mais simples de implementar e permite números de página, mas o custo cresce com a profundidade da página e os resultados podem pular ou repetir peças quando o catálogo muda entre requisições. Descartado em favor do cursor, conforme o mecanismo técnico já previsto no RNF-02.

## Rastreabilidade

**Atributo de qualidade:** Eficiência de desempenho · Comportamento temporal (latência sob concorrência)

**Cenário que originou a decisão:**

> Em operação normal, com 10.000 peças publicadas, 50 visitantes simultâneos pesquisam na vitrine o termo "maracatu barro" combinado com o filtro de polo "Tracunhaém" e técnica "Barro/Cerâmica". A API da vitrine devolve a primeira página de resultados, ordenada por relevância e contendo apenas peças que atendem a todos os critérios, em até 200 ms no percentil 95 e até 500 ms no percentil 99, sem varredura sequencial na tabela de peças.

**Padrão arquitetural adotado:** Portas e Adaptadores (o mecanismo de busca fica no adaptador da porta `FontePecasVitrine`), mantendo o processamento da consulta no banco de dados.

**Táticas empacotadas:** Aumentar a eficiência dos recursos (índices GIN e B-Tree); Limitar o tamanho da resposta (página fixa com limite no servidor); Reduzir a sobrecarga computacional (cursor no lugar de `OFFSET`); Encapsular a dependência externa (porta `FontePecasVitrine`).

**Requisitos relacionados:** RNF-02 (Latência de Consulta), RNF-03 (Tempo de Resposta da API), RNF-04 (Desacoplamento), RNF-06 (Proteção contra SQL Injection), HU-05 (Busca Textual), HU-06 (Filtro por Região), HU-07 (Filtro por Técnica).

**Módulos e artefatos (branch `feat/hu-07-vitrine-busca-fts`):** `backend/prisma/migrations/20261123093000_hu07_vitrine_fts_gin/migration.sql`, `backend/src/repositories/pecaVitrine.repository.ts`, `backend/src/services/produto.service.ts`, `backend/src/controllers/produto.controller.ts`, `backend/tests/hu07/hu07-vitrine-e-frete.test.ts`. Documento de origem: `docs/01-requisitos-e-arquitetura/06-requisitos-nao-funcionais-e-arquitetura.md`.

**Estado atual em relação à decisão:**

| Item da decisão | Situação na branch `feat/hu-07-vitrine-busca-fts` |
| :--- | :--- |
| Índice GIN de FTS em português | Implementado |
| Índices B-Tree de status, tipologia e polo | Implementados |
| Índice em `preco` para faixa de preço | Pendente (a faixa de preço também não aparece no filtro atual) |
| Paginação por cursor com limite de página | Pendente (a listagem devolve todos os resultados) |
| Teste de carga do RNF-02 | Pendente (o teste atual mede 1 requisição com limite de 400 ms) |

**Pontos para a discussão da equipe:**

- A numeração das histórias no código não coincide com o backlog consolidado: a branch chama de HU-07 a busca textual com FTS, enquanto no backlog a busca textual é a HU-05 e a HU-07 é o filtro por técnica.
- O teste atual aceita 400 ms por requisição isolada, e o RNF-02 exige 200 ms no P95 sob 50 requisições concorrentes. É preciso confirmar qual meta vale.
- O tamanho da página (sugestão: 24 peças) e o formato do cursor na API precisam ser acordados com o frontend.

## Verificação

- **Teste de carga do cenário:** script k6 contra a API, com banco populado por seed de 10.000 peças, 50 usuários virtuais simultâneos durante 60 segundos, alternando buscas textuais e filtros combinados. Passa se `http_req_duration` tiver P95 ≤ 200 ms e P99 ≤ 500 ms, com 0% de erros. O relatório de percentis é salvo como artefato de teste.
- **Plano de execução:** `EXPLAIN ANALYZE` da consulta do cenário deve mostrar uso do índice `pecas_fts_titulo_descricao_gin_idx` (Bitmap Index Scan) e nenhum `Seq Scan` na tabela `pecas`.
- **Teste de paginação:** teste de integração que percorre todas as páginas de uma busca ampla e confirma que nenhuma peça aparece repetida ou é omitida, que cada página respeita o limite máximo e que um `limit` acima do máximo é reduzido pelo servidor.
- **Teste de relevância:** o teste existente do Cenário 2 (busca "maracatu barro" ordenada por relevância) continua passando.
