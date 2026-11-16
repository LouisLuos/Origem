# Mapeamento de Code Smells — Projeto Origem

> **Branch analisada:** `feat/frontend-next` (commit `6de103f`)
> **Data:** 16/11/2026
> **Escopo:** `backend/src` (exceto `generated/`), `frontend/src`, `ia-recomendador/`
> **Natureza:** análise estática e registro da refatoração de CS-02.

Este mapeamento complementa o [README.md](README.md) (catálogo CS-01 a CS-04). Os IDs já existentes foram mantidos e reconferidos no código; os novos candidatos começam em **CS-05**.

---

## 1. Critérios de classificação

Cada smell recebe quatro classificações:

**a) Nome canônico** — catálogo de Fowler & Beck (*Refactoring*, 2ª ed.).

**b) Categoria** — taxonomia de Mäntylä et al. (2003):

| Categoria | Significado |
| :--- | :--- |
| **Bloaters** | Código que cresceu além do que consegue ser compreendido (Long Method, Large Class, Primitive Obsession, Data Clumps) |
| **Change Preventers** | Uma mudança exige editar vários lugares (Shotgun Surgery, Divergent Change) |
| **Dispensables** | Código que poderia não existir (Duplicated Code, Dead Code, Speculative Generality, Comments) |
| **Couplers** | Acoplamento excessivo entre módulos (Feature Envy, Inappropriate Intimacy) |
| **OO Abusers** | Uso inadequado de abstrações (Switch Statements, Alternative Classes with Different Interfaces) |

**c) Severidade**

| Nível | Critério |
| :--- | :--- |
| **Alta** | Já causa (ou causará na próxima evolução prevista) comportamento divergente entre camadas ou erro visível ao usuário |
| **Média** | Não quebra nada hoje, mas toda mudança na área custa mais ou corre risco de esquecimento |
| **Baixa** | Afeta legibilidade/estilo; custo de manter é pequeno |

**d) Recomendação** — **Refatorar**, **Não refatorar (justificável)** ou **Depende** (decisão de projeto pendente). A atividade valoriza as duas decisões; a coluna indica qual delas é mais fácil de *defender* tecnicamente.

---

## 2. Tabela-resumo

| ID | Smell (canônico) | Categoria | Camada | Severidade | Recomendação |
| :-: | :--- | :--- | :-: | :-: | :--- |
| CS-01 | Duplicated Code | Dispensables | Backend | Média | ✅ **Já refatorado** (resíduo em CS-15) |
| CS-02 | Divergent Change | Change Preventers | Frontend | Média | ✅ Refatorado |
| CS-03 | Feature Envy / Shotgun Surgery (mock Picsum) | Couplers | Frontend | Média | Refatorar *ou* não refatorar |
| CS-04 | Primitive Obsession (técnica/polo) | Bloaters | Full stack | Média | Depende de CS-05 |
| **CS-05** | **Duplicated Knowledge divergente (taxonomia)** | Change Preventers | Full stack + IA | **Alta** | Refatorar (com decisão do grupo) |
| CS-06 | Duplicated Code (paginação e filtros) | Dispensables | Backend | Média | Refatorar |
| CS-07 | Duplicated Code (parsing de query nos controllers) | Dispensables | Backend | Baixa | Refatorar |
| CS-08 | Speculative Generality (Prisma, JWT, IA_URL) | Dispensables | Backend | Baixa | **Não refatorar** |
| CS-09 | Large Class / Long Method (`Header`) | Bloaters | Frontend | Média | Refatorar com cautela |
| CS-10 | Large Class / Long Method (`ArtisanPanel`) | Bloaters | Frontend | Média | Refatorar com cautela |
| CS-11 | Long Method + Data Clumps (`Login.handleSubmit`) | Bloaters | Frontend | Média | Refatorar |
| CS-12 | Duplicated Code (bloco de carregamento/erro) | Dispensables | Frontend | Baixa | Refatorar |
| CS-13 | Duplicated Code (subtotal, regex de e-mail, faixas de preço) | Dispensables | Frontend + IA | Média | Refatorar |
| CS-14 | Inappropriate Intimacy (tipo de domínio no Design System) | Couplers | Frontend | Média | Refatorar |
| CS-15 | Dead Code (re-export de `slugify`) | Dispensables | Backend | Baixa | Refatorar (trivial) |
| CS-16 | Comments desatualizados | Dispensables | Frontend | Baixa | Refatorar (trivial) |
| CS-17 | Primitive Obsession (identificação do artesão por nome) | Bloaters / Couplers | Frontend | Média | Refatorar |
| CS-18 | Boilerplate repetido nos Contexts (`useX` + `throw`) | Dispensables | Frontend | Baixa | **Não refatorar** |
| CS-19 | Error Code em vez de exceção (`recomendar`) | OO Abusers | IA | Baixa | **Não refatorar** |

**Distribuição:** 4 Bloaters · 9 Dispensables · 3 Couplers · 2 Change Preventers · 1 OO Abuser.
**Por camada:** 6 backend · 10 frontend · 1 IA · 2 transversais.

---

## 3. Reconferência dos candidatos já catalogados (CS-01 a CS-04)

### CS-01 — Duplicated Code nos repositórios ✅
**Estado atual:** refatoração confirmada. [catalogLoader.ts](../../../backend/src/repositories/catalogLoader.ts), [taxonomy.ts](../../../backend/src/constants/taxonomy.ts) e [string.util.ts](../../../backend/src/utils/string.util.ts) existem e são usados pelos dois repositórios.
**Resíduo:** o re-export "para compatibilidade" em [artesao.repository.ts:5-6](../../../backend/src/repositories/artesao.repository.ts#L5-L6) não tem consumidores → ver **CS-15**.

### CS-02 — `catalogService` com responsabilidades misturadas
**Diagnóstico:** confirmado em `frontend/src/services/catalogService.ts`: o mesmo objeto reunia consultas públicas, mutações de catálogo e operações de estoque. Com apenas 83 linhas, não era uma *Large Class*; o smell era *Divergent Change*. Severidade **Média**.

**Refatoração aplicada:** separação por responsabilidade, mantendo contratos, rotas e payloads:

- `catalogService.ts`: consultas públicas `list` e `get`.
- `artisanCatalogService.ts`: `create`, `update` e `remove`.
- `stockService.ts`: `adjustStock` e `reserveStock`.
- `catalogTypes.ts` e `catalogRequest.ts`: tipos e chamada HTTP compartilhados, sem duplicação do wrapper de API.
- Consumidores atualizados em `CatalogContext.tsx` e `orderService.ts`.

**Validação de integração:** o backend em `backend/src/routes/produto.routes.ts` implementa apenas `GET /produtos` e `GET /produtos/:id`. Os métodos de escrita continuam apontando para rotas ainda não implementadas; essa refatoração não cria endpoints nem altera esse comportamento preexistente.

**Limitação conhecida:** `adjustStock` mantém o fluxo cliente de leitura e escrita, sujeito a condição de corrida. A atomicidade da reserva depende da implementação do backend. Ambos os pontos ficam fora do escopo desta refatoração frontend e precisam ser tratados junto às rotas de escrita.

### CS-03 — Regex do Picsum dentro de `ProductDetail`
**Estado atual:** confirmado em [ProductDetail.tsx:18-23](../../../frontend/src/views/ProductDetail.tsx#L18-L23). O conhecimento sobre o Picsum está espalhado em **5 arquivos**, o que caracteriza também *Shotgun Surgery*:

| Arquivo | Uso |
| :--- | :--- |
| [views/ProductDetail.tsx:19](../../../frontend/src/views/ProductDetail.tsx#L19) | regex para gerar galeria |
| [utils/avatar.ts:6](../../../frontend/src/utils/avatar.ts#L6) | regex para gerar avatar quadrado |
| [views/ArtisanPanel.tsx:117](../../../frontend/src/views/ArtisanPanel.tsx#L117) | URL de fallback da peça |
| [views/Login.tsx:64-66](../../../frontend/src/views/Login.tsx#L64-L66) | URLs de foto e capa do artesão |
| [components/CategoryShowcase.tsx:10-15](../../../frontend/src/components/CategoryShowcase.tsx#L10-L15) | imagens fixas das categorias |

**Fato relevante:** o backend devolve `imageUrl: ''` e `photoUrl: ''` ([produto.repository.ts:38](../../../backend/src/repositories/produto.repository.ts#L38), [artesao.repository.ts:43](../../../backend/src/repositories/artesao.repository.ts#L43)). Com dados reais, as regexes nunca casam. Isso reforça os dois lados: extrair agora é barato, mas o código será descartado quando o armazenamento de mídia existir.

### CS-04 — Primitive Obsession em técnica/polo
**Estado atual:** confirmado. O problema é maior do que o catalogado: as listas de valores **já divergem** entre camadas (ver CS-05). Tipar com união literal sem antes unificar a fonte de verdade apenas congelaria a divergência. **Depende de CS-05.**

---

## 4. Novos candidatos

### CS-05 — Conhecimento de domínio duplicado e divergente (taxonomia) 🔴
- **Canônico:** Duplicated Code (*knowledge duplication*) → Shotgun Surgery
- **Categoria:** Change Preventers · **Severidade:** Alta · **Camada:** Frontend + Backend + IA

**Localização e evidência**

| Fonte | Técnicas | Polos |
| :--- | :--- | :--- |
| `ia-recomendador/dados/catalogo.json` (dados reais) | ceramica, couro, xilogravura, papel_mache, renda_renascenca, bordado | Alto do Moura, Bezerros, Passira, Pesqueira, Tracunhaém |
| [backend/src/constants/taxonomy.ts:5-12](../../../backend/src/constants/taxonomy.ts#L5-L12) | mapeia as 6 acima | — |
| [frontend/src/design-system/tokens.ts:28-44](../../../frontend/src/design-system/tokens.ts#L28-L44) | Cerâmica Figurativa, Renda Renascença, Xilogravura, **Marcenaria**, **Cordel**, Bordado | **Caruaru**, Alto do Moura, **Nazaré da Mata**, Tracunhaém, Bezerros, **Garanhuns** |

**Consequências observáveis:** os filtros ([ProductFilters.tsx](../../../frontend/src/components/ProductFilters.tsx)) e o [CategoryShowcase.tsx](../../../frontend/src/components/CategoryShowcase.tsx) leem a lista do frontend. Peças de **Couro** e **Papel Machê** e os polos **Passira** e **Pesqueira** existem na API, mas não podem ser filtrados. Marcenaria, Cordel, Caruaru, Nazaré da Mata e Garanhuns aparecem como filtros que sempre retornam vazio. A mesma lista alimenta os `<select>` de cadastro em [ArtisanPanel.tsx:8](../../../frontend/src/views/ArtisanPanel.tsx#L8) e [Login.tsx:9](../../../frontend/src/views/Login.tsx#L9).

**Impactos:** coesão (o vocabulário do domínio fica dentro de `design-system/tokens`, que deveria guardar só tokens visuais), manutenibilidade (três fontes para atualizar) e corretude percebida pelo usuário.

**Recomendação:** refatorar. Técnicas: *Move Field* (tirar a taxonomia de `tokens.ts`) e *Replace Magic Literal* / fonte única, por exemplo com um endpoint `GET /taxonomia` ou derivando as opções dos produtos carregados.
⚠️ **Exige decisão do grupo:** qual lista é a oficial? O backlog (RF-CAT-02) deve ser consultado. Não escolher silenciosamente.

---

### CS-06 — Paginação e filtros duplicados nos services do backend
- **Canônico:** Duplicated Code · **Categoria:** Dispensables · **Severidade:** Média · **Camada:** Backend

**Localização:** [produto.service.ts:11-51](../../../backend/src/services/produto.service.ts#L11-L51) e [artesao.service.ts:12-63](../../../backend/src/services/artesao.service.ts#L12-L63).

O cálculo de `page`/`limit`/`totalPaginas`/`slice` e o tipo `meta` são cópias quase literais. As cópias **já divergiram**:
- `artesao.service` aplica `.trim()` nos filtros e `produto.service` não. `?hub=Bezerros%20` filtra artesãos, mas não produtos.
- O limite padrão é 20 em um e 10 no outro, sem justificativa documentada.

**Impactos:** a próxima entidade paginada (pedidos, avaliações) vai copiar o bloco pela terceira vez.
**Recomendação:** refatorar com *Extract Function* (`paginate<T>(items, page, limit)`) e *Extract Interface* (`PaginatedResult<T>`). Risco baixo; validar comparando as respostas JSON antes e depois, como foi feito no CS-01.
⚠️ Unificar o `.trim()` **muda comportamento** de `/produtos`. Documentar se for feito.

---

### CS-07 — Parsing de query string duplicado nos controllers
- **Canônico:** Duplicated Code · **Categoria:** Dispensables · **Severidade:** Baixa · **Camada:** Backend

**Localização:** [produto.controller.ts:8-11](../../../backend/src/controllers/produto.controller.ts#L8-L11), [artesao.controller.ts:8-12](../../../backend/src/controllers/artesao.controller.ts#L8-L12) e as linhas 22-27 de ambos (extração de `id`).

O padrão `typeof req.query.x === 'string' ? req.query.x : undefined` se repete. `Number('abc')` gera `NaN`, que só é corrigido mais adiante no service. O projeto já tem **Zod** como dependência e o `errorHandler` já trata `ZodError` ([errorHandler.ts:19-25](../../../backend/src/middlewares/errorHandler.ts#L19-L25)), mas o Zod não é usado na entrada HTTP.
**Recomendação:** refatorar com *Replace Inline Code with Function Call* usando um schema Zod por rota. Benefício: a validação fica num lugar só e o caminho de erro existente passa a ser usado.

---

### CS-08 — Infraestrutura especulativa no backend
- **Canônico:** Speculative Generality · **Categoria:** Dispensables · **Severidade:** Baixa · **Camada:** Backend

**Localização:**
- [config/database.ts](../../../backend/src/config/database.ts): cria um `PrismaClient` que nenhum módulo importa.
- [config/env.ts:9](../../../backend/src/config/env.ts#L9): `DATABASE_URL` é **obrigatória** e o servidor encerra sem ela, embora nenhum código use banco.
- [config/env.ts:11-13](../../../backend/src/config/env.ts#L11-L13): `JWT_SECRET` (com valor padrão fixo no código), `JWT_EXPIRES_IN` e `IA_RECOMENDADOR_URL` não têm consumidores.

**Recomendação: não refatorar.** É o melhor candidato para a justificativa dissertativa. O documento do PI exige PostgreSQL, autenticação e integração com a IA, que são as próximas etapas do projeto. Remover agora e recriar depois gera retrabalho sem ganho. Pontos para a defesa: o custo de manter é apenas a exigência de `DATABASE_URL`; o risco do segredo JWT padrão só existe quando houver JWT, e deve ser tratado nesse momento (sem valor padrão em produção).

---

### CS-09 — `Header` como componente-deus
- **Canônico:** Large Class + Long Method · **Categoria:** Bloaters · **Severidade:** Média · **Camada:** Frontend

**Localização:** [components/Header.tsx](../../../frontend/src/components/Header.tsx), com 444 linhas, 5 `useState`, 6 contexts e 5 `useEffect`.

Concentra navegação, menu mobile, busca com sugestões de produtos e artesãos, minicarrinho com subtotal, contador animado, detecção de scroll e fechamento por Esc ou clique fora. Os efeitos de "fechar com Esc" das linhas 81-106 estão duplicados entre busca e carrinho.
**Impactos:** qualquer re-render de carrinho, favoritos, catálogo ou artesãos re-renderiza o cabeçalho inteiro, e cada responsabilidade é difícil de testar isoladamente.
**Recomendação:** *Extract Component* (`SearchOverlay`, `MiniCart`) e *Extract Hook* (`useDismiss(ref, onClose)`). Refatorar **com cautela**: o AGENTS.md proíbe alterar o design, e a extração deve manter o HTML e as classes idênticos.

---

### CS-10 — `ArtisanPanel` acumula formulário, validação, métricas e listagem
- **Canônico:** Large Class + Long Method · **Categoria:** Bloaters · **Severidade:** Média · **Camada:** Frontend

**Localização:** [views/ArtisanPanel.tsx](../../../frontend/src/views/ArtisanPanel.tsx), com 379 linhas. Inclui as métricas (69-73), o mapeamento item→formulário (75-91), a validação e montagem do payload em `handleSubmit` (101-142), o formulário (174-271) e a lista com controle de estoque (290-370).
**Recomendação:** *Extract Function* para `validateProductForm` (função pura e testável) e *Extract Component* para `ProductForm` e `StockStepper`. O stepper de quantidade também se repete com classes quase idênticas em [ProductDetail.tsx:199-221](../../../frontend/src/views/ProductDetail.tsx#L199-L221).

---

### CS-11 — `Login.handleSubmit` longo e com aglomerado de dados
- **Canônico:** Long Method + Data Clumps · **Categoria:** Bloaters · **Severidade:** Média · **Camada:** Frontend

**Localização:** [views/Login.tsx:39-76](../../../frontend/src/views/Login.tsx#L39-L76) e os estados das linhas 25-35 (10 `useState`, 4 deles só para o perfil de artesão).
O método valida, autentica, cadastra a conta, monta o perfil público com URLs do Picsum e chama `artisanService.create` (rota inexistente no backend). Login e cadastro de artesão são dois fluxos com motivos de mudança diferentes.
**Recomendação:** *Extract Function* (`validateCredentials`, `buildArtisanProfile`) e *Introduce Parameter Object* para o perfil de artesão (`ArtisanProfileDraft`).

---

### CS-12 — Bloco de "carregando / erro" repetido nas views
- **Canônico:** Duplicated Code · **Categoria:** Dispensables · **Severidade:** Baixa · **Camada:** Frontend

**Localização:** [ProductDetail.tsx:63-71](../../../frontend/src/views/ProductDetail.tsx#L63-L71), [ArtisanPanel.tsx:59-67](../../../frontend/src/views/ArtisanPanel.tsx#L59-L67), [Checkout.tsx:146-158](../../../frontend/src/views/Checkout.tsx#L146-L158) e [AdminPanel.tsx:69-94](../../../frontend/src/views/AdminPanel.tsx#L69-L94). Todos repetem `<main id="main-content" className="pb-16 pt-24 …"><Container>{status === 'error' ? <ErrorBlock/> : <LoadingBlock/>}</Container></main>`.
**Recomendação:** *Extract Component* (`<ResourceGate status error onRetry label>`) em [AsyncState.tsx](../../../frontend/src/components/AsyncState.tsx). É uma refatoração pequena, de risco baixo e fácil de comparar antes e depois, o que a torna **boa para a apresentação**.

---

### CS-13 — Regras de negócio pequenas duplicadas
- **Canônico:** Duplicated Code · **Categoria:** Dispensables · **Severidade:** Média · **Camada:** Frontend + IA

| Regra | Ocorrências |
| :--- | :--- |
| Subtotal do carrinho | [Header.tsx:54](../../../frontend/src/components/Header.tsx#L54), [Cart.tsx:15](../../../frontend/src/views/Cart.tsx#L15), [Checkout.tsx:163](../../../frontend/src/views/Checkout.tsx#L163) |
| Regex de e-mail | [Checkout.tsx:80](../../../frontend/src/views/Checkout.tsx#L80), [Login.tsx:45](../../../frontend/src/views/Login.tsx#L45) |
| Faixas de preço | [ProductFilterContext.tsx:14-18](../../../frontend/src/context/ProductFilterContext.tsx#L14-L18) usa ≤100 / 100–300 / >300; [recomendador.py:25-30](../../../ia-recomendador/recomendador.py#L25-L30) usa ≤100 / 100–200 / >200 |

**Recomendação:** *Extract Function* (`cartSubtotal(lines)` no `CartContext` e `isValidEmail` em `utils/`). As faixas de preço têm propósitos diferentes (filtro de UI e feature do modelo), então a divergência **pode ser intencional**: registrar a decisão em vez de unificar.

---

### CS-14 — Tipo de domínio `Product` definido dentro do Design System
- **Canônico:** Inappropriate Intimacy (violação de camadas) · **Categoria:** Couplers · **Severidade:** Média · **Camada:** Frontend

**Localização:** `Product` está declarado em [design-system/components/ProductCard.tsx:9-23](../../../frontend/src/design-system/components/ProductCard.tsx#L9-L23) e é importado pela camada de serviço ([catalogService.ts:1](../../../frontend/src/services/catalogService.ts#L1)) e pelo estado global ([ProductFilterContext.tsx:5](../../../frontend/src/context/ProductFilterContext.tsx#L5)).
A dependência está invertida: o serviço HTTP depende de um componente visual. Mudar o card (por exemplo, renomear um campo de exibição) altera o contrato da API no frontend.
**Recomendação:** *Move Type* para `frontend/src/types/product.ts`, com o card recebendo o tipo por importação. Mudança apenas de tipos, sem efeito em runtime; validar com `tsc`/`next build`.

---

### CS-15 — Re-export sem consumidores (resíduo do CS-01)
- **Canônico:** Dead Code · **Categoria:** Dispensables · **Severidade:** Baixa · **Camada:** Backend

**Localização:** [artesao.repository.ts:5-6](../../../backend/src/repositories/artesao.repository.ts#L5-L6). `grep -rn slugify backend/src` não encontra nenhum importador via repositório.
**Recomendação:** *Remove Dead Code*. É trivial; serve como complemento do CS-01, mas é fraco como intervenção individual isolada.

---

### CS-16 — Comentários e textos desatualizados
- **Canônico:** Comments (comentário que mente) · **Categoria:** Dispensables · **Severidade:** Baixa · **Camada:** Frontend

**Localização:**
- [artisanService.ts:21](../../../frontend/src/services/artisanService.ts#L21): "consumidos pela Fake API", mas já consome o backend real.
- [ArtisanPanel.tsx:373-375](../../../frontend/src/views/ArtisanPanel.tsx#L373-L375): texto visível ao usuário "os dados ficam salvos apenas neste navegador", mas o catálogo agora vem da API.
- [storage.ts:1-4](../../../frontend/src/services/storage.ts#L1-L4): descreve todos os services como localStorage, o que hoje vale só para auth, pedidos, carrinho e favoritos.

**Recomendação:** corrigir os comentários. O texto do painel é UI, então alterá-lo exige autorização (AGENTS.md §5).

---

### CS-17 — Artesão identificado pelo nome em vez do id
- **Canônico:** Primitive Obsession + Duplicated Code divergente · **Categoria:** Bloaters / Couplers · **Severidade:** Média · **Camada:** Frontend

**Localização:** [ProductDetail.tsx:95](../../../frontend/src/views/ProductDetail.tsx#L95) busca `artisans.find(a => a.name === product.artisan)`, enquanto [ArtisanProfile.tsx:64](../../../frontend/src/views/ArtisanProfile.tsx#L64) usa `artisanId`, com o nome só como fallback. O backend já fornece `artisanId` estável ([produto.repository.ts:32](../../../backend/src/repositories/produto.repository.ts#L32)).
Dois artesãos com o mesmo nome, ou uma diferença de espaço ou acento, quebram o link "Ver perfil completo".
**Recomendação:** *Extract Function* `findArtisanOf(product, artisans)`, usada nas duas telas e priorizando `artisanId`. Refatoração pequena com ganho de corretude.

---

### CS-18 — Boilerplate `createContext` + `useX` + `throw` em 7 contexts
- **Canônico:** Duplicated Code (estrutural) · **Categoria:** Dispensables · **Severidade:** Baixa · **Camada:** Frontend

**Localização:** os 7 arquivos em [frontend/src/context/](../../../frontend/src/context/), cada um com o mesmo `useX()` de 6 linhas.
**Recomendação: não refatorar.** É o idioma documentado do React. Uma fábrica genérica (`createSafeContext<T>(name)`) economizaria cerca de 30 linhas, mas pioraria a legibilidade para quem conhece React, deixaria as mensagens de erro e a inferência de tipos menos óbvias e não reduziria nenhum risco real, porque o código repetido não carrega regra de negócio. É um bom exemplo para a defesa de que **"duplicação estrutural ≠ duplicação de conhecimento"**.

---

### CS-19 — `recomendar` sinaliza erro com dicionário em vez de exceção
- **Canônico:** Error Code (Fowler: *Replace Error Code with Exception*) · **Categoria:** OO Abusers · **Severidade:** Baixa · **Camada:** IA

**Localização:** [recomendador.py:89-90](../../../ia-recomendador/recomendador.py#L89-L90) devolve `{"erro": ...}`, e [service.py:33-34](../../../ia-recomendador/service.py#L33-L34) testa `if "erro" in resposta`.
**Recomendação: não refatorar.** O módulo foi desenhado de propósito sem dependência do BentoML para ser testável isoladamente (docstring da linha 1), e o contrato de dicionário é verificado pelos testes em `tests/test_recomendador.py`. Trocar por exceção exige alterar testes e serviço sem ganho funcional. O risco fica contido porque há um único chamador.

---

## 5. Achados fora do escopo de code smells

Estes pontos **não são smells**. São defeitos ou pendências de integração e não devem ser apresentados como refatoração, porque corrigi-los muda comportamento:

1. **Painel do artesão sempre vazio com a API real.** [ArtisanPanel.tsx:69](../../../frontend/src/views/ArtisanPanel.tsx#L69) filtra por `ownerEmail`, mas o backend nunca preenche esse campo ([produto.repository.ts:26-41](../../../backend/src/repositories/produto.repository.ts#L26-L41)).
2. **Escritas sem endpoint.** `POST/PATCH/DELETE /produtos`, `POST /estoque/reservas` e `POST /artesaos` retornam 404; o checkout falha em `reserveStock`.
3. **Condição de corrida em `adjustStock`** (leitura e escrita feitas no cliente).
4. **`frontend/dist/` versionado no Git**, um artefato de build que não corresponde ao Next.js atual (aparentemente de uma versão anterior com Vite).
5. **Backend relê `catalogo.json` do disco a cada requisição** (`readFileSync` em `findAll`). É aceitável para o MVP e deixa de existir com o Prisma.

---

## 6. Sugestão de distribuição para a equipe

Cada candidato abaixo é independente e tem antes/depois demonstrável:

| Perfil da intervenção | Candidatos |
| :--- | :--- |
| Refatoração no frontend já concluída | CS-02 |
| Refatoração no backend, validável por comparação de JSON | CS-06, CS-07 |
| Refatoração no frontend, validável por `next build` + navegação | CS-12, CS-14, CS-17, CS-13 |
| Refatoração maior (exige cuidado com o design) | CS-09, CS-10, CS-11 |
| Justificativa de **não refatorar** (dissertativa) | CS-08, CS-18, CS-19 |
| Exige decisão do grupo antes de começar | CS-05 (+ CS-04) |

**Validação disponível hoje:** não há suíte de testes no backend nem no frontend (nenhum script `test` em `package.json`). O único teste automatizado é `ia-recomendador/tests/test_recomendador.py` (pytest). Para CS-02, `npm run build` e ESLint focado nos arquivos alterados passaram; o lint global ainda encontra 214 erros nos arquivos gerados em `frontend/dist`, e não foi feita navegação manual. Para outras refatorações, usar `npm run typecheck` (backend), `npm run build` + `npm run lint` (frontend) e comparação de respostas HTTP antes e depois, como no CS-01.
