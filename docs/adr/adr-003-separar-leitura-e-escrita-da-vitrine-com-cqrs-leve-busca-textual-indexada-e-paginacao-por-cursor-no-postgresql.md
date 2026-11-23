# ADR-003: Separar leitura e escrita da vitrine com CQRS leve, busca textual indexada e paginação por cursor no PostgreSQL

- **Status:** Proposta
- **Data:** 2026-11-23
- **Autor:** EDUARDO HENRIQUE ALBUQUERQUE PESSOA DE ANDRADE (ehapa@cesar.school)
- **Turma:** Embarque (segundas)
- **Projeto:** Origem · marketplace da economia criativa e do artesanato de Pernambuco

## Contexto

O Origem é desenvolvido em um semestre por uma equipe pequena de estudantes, com stack acordada com Desenvolvimento Web (Express, TypeScript e Prisma), modelo de dados acordado com Banco de Dados (PostgreSQL) e hospedagem limitada, sem orçamento de infraestrutura. A vitrine é a porta de entrada do marketplace: visitantes e compradores pesquisam peças por palavras-chave (HU-05) e combinam filtros de polo cultural (HU-06), técnica e preço (HU-07). O RNF-02 exige resposta em até 200 ms no percentil 95 com 10.000 peças e 50 requisições simultâneas. A vitrine é acessada muito mais vezes do que as peças são publicadas ou vendidas, e a maioria das peças é única (estoque igual a 1), então ela não pode mostrar como disponível uma peça já vendida. A branch feat/hu-07-vitrine-busca-fts já implementou a busca textual em português com índice GIN, mas a listagem devolve todos os resultados sem paginação, e o teste atual mede uma única requisição com limite de 400 ms.

## Preocupações

tempo de resposta, crescimento do catálogo, relevância da busca em português, consistência com o estoque, custo de infraestrutura, prazo

## Decisão

Adotar CQRS em versão leve: separar o caminho de leitura da vitrine (buscar e filtrar) do caminho de escrita (publicar, editar e vender peças), com os dois usando o mesmo banco PostgreSQL. O caminho de leitura terá consultas próprias, com busca textual em português indexada (GIN), índices nas colunas de filtro e paginação por cursor com tamanho máximo de página, sem banco separado, réplica ou projeção assíncrona nesta fase.

## Justificativa

Leitura e escrita têm exigências opostas na vitrine: muita gente consultando, que precisa de rapidez, e poucas alterações, que precisam de regras e consistência. Com um caminho de leitura próprio, a vitrine é otimizada sem mexer nas regras do checkout e do ateliê. O índice GIN permite encontrar as peças com os termos pesquisados sem ler a tabela inteira, e entende flexões do português ("bonecos" encontra "boneco"). Os índices dos filtros fazem o mesmo para polo, técnica e preço. A paginação por cursor mantém o custo de cada resposta constante, mesmo com o crescimento do catálogo, o que sustenta os 200 ms no percentil 95 com 10.000 peças e 50 acessos simultâneos. Por usar o mesmo banco, a versão leve evita a consistência eventual do CQRS completo: uma peça vendida deixa de aparecer como disponível na hora. Tudo usa recursos nativos do PostgreSQL, sem custo extra de infraestrutura.

## Consequências

Ganhos: tempo de resposta previsível mesmo com o crescimento do catálogo, busca que entende o português, vitrine sempre coerente com o estoque, nenhum custo de infraestrutura e possibilidade de evoluir depois para réplica de leitura sem alterar a escrita. Perdas: duplicação de modelo, já que dois caminhos passam a representar a mesma peça e precisam ser mantidos coerentes quando um campo ou uma regra de exibição muda; consultas de leitura escritas em SQL próprio, com menos ajuda do ORM e mais necessidade de testes; publicação e edição de peças um pouco mais lentas por causa dos índices; a busca não tolera erros de digitação nem encontra trechos no meio de palavras; a navegação deixa de permitir pular para uma página específica e passa a ser por "carregar mais"; e o contador total de resultados exige uma consulta separada.

## Alternativas consideradas

Orientado a Eventos com índice de busca separado (Elasticsearch ou Meilisearch) atualizado por eventos: descartado pelo custo de manter mais um serviço e porque a atualização eventual poderia exibir como disponível uma peça única já vendida. CQRS completo, com réplica de leitura e projeção assíncrona: descartado nesta fase por exigir outro servidor de banco sem orçamento e trazer a mesma consistência eventual. Somente Camadas, com a vitrine usando as mesmas consultas da escrita: descartado porque não permite otimizar a leitura e o tempo de resposta cresceria junto com o catálogo. Paginação por número de página (OFFSET): descartada porque fica mais lenta nas páginas finais e pode repetir ou pular peças quando o catálogo muda. Cache de resultados no Redis: adiado, porque exigiria invalidar o cache a cada venda, com risco de mostrar peça vendida como disponível.

## Rastreabilidade

**Atributo de qualidade:** Eficiência de desempenho · Comportamento temporal

**Cenário que originou a decisão:**

> Em operação normal, com 10.000 peças publicadas no catálogo, 50 compradores e visitantes ao mesmo tempo pesquisam "maracatu barro" e aplicam os filtros de polo "Tracunhaém" e técnica "Barro/Cerâmica" na vitrine, no serviço de busca e filtros do catálogo e no banco de dados de peças. O sistema devolve a primeira página de resultados, ordenada por relevância e contendo apenas peças que atendem a todos os filtros, em até 200 ms no percentil 95 e até 500 ms no percentil 99, sem leitura completa da tabela de peças.

**Padrão arquitetural adotado:** CQRS

**Táticas empacotadas:** Separar modelo de leitura e de escrita; Indexação do modelo de leitura

HU-05, HU-06, HU-07, RNF-02, RNF-03 e RNF-06. Módulos (branch feat/hu-07-vitrine-busca-fts): backend/prisma/migrations/20261123093000_hu07_vitrine_fts_gin/migration.sql, backend/src/repositories/pecaVitrine.repository.ts, backend/src/services/produto.service.ts e backend/tests/hu07/hu07-vitrine-e-frete.test.ts. Pendências para a equipe: implementar a paginação por cursor e o índice de preço, alinhar o limite do teste atual (400 ms em requisição única) ao RNF-02 (200 ms no P95 com 50 simultâneas) e corrigir a numeração das histórias no código, que chama de HU-07 a busca textual da HU-05.

## Verificação

- **Teste do cenário:** Teste de carga com k6 contra a API da vitrine, com o banco populado por seed de 10.000 peças e 50 usuários virtuais simultâneos durante 60 segundos, executando a busca "maracatu barro" com os filtros de polo "Tracunhaém" e técnica "Barro/Cerâmica". Passa se o tempo de resposta tiver percentil 95 de até 200 ms e percentil 99 de até 500 ms, com 0% de erros. Complementado por EXPLAIN ANALYZE da consulta, que deve mostrar o uso do índice GIN e nenhuma leitura sequencial na tabela de peças, e por um teste de integração que percorre todas as páginas de uma busca ampla e confirma que nenhuma peça se repete ou é omitida.

---

_Gerado pelo estudo dirigido de Arquitetura de Software · ADS020 · 2026.2._
