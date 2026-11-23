# Relatório Individual: Code Smell e Refatoração
## Projeto Integrador Origem — Atividade de Qualidade de Software

> **Intervenção Individual:** CS-07 — Parsing e Validação de Query String e Parâmetros Duplicados nos Controllers (*Duplicated Code*)  
> **Status:** Refatoração Aplicada e Validada (Zero Regressão nos Contratos Válidos)  
> **Branch:** `feat/frontend-next`  

---

## 1. Identificação do Integrante

- **Nome Completo:** Luiz Henrique
- **Matrícula / E-mail Institucional:** `luiz.contato.1000@gmail.com` *(completar matrícula se exigido)*
- **Papel no Projeto:** Desenvolvedor Full Stack
- **Branch de Trabalho:** `feat/frontend-next`
- **Data da Conclusão:** 16/11/2026

---

## 2. Code Smell Selecionado

- **Identificador no Catálogo:** `CS-07`
- **Nome Canônico:** Código Duplicado (*Duplicated Code*)
- **Classificação Teórica:** Martin Fowler & Kent Beck (*Refactoring*, 2ª ed. — *Dispensables*) / Mäntylä et al. (2003) / Robert C. Martin (*Clean Code* — DRY)
- **Camada Afetada:** Backend — Camada de Controllers HTTP (`backend/src/controllers/`) e Validadores (`backend/src/validators/`)

---

## 3. Localização e Código Original

- **Arquivo(s) de Origem:**
  - `backend/src/controllers/produto.controller.ts` (linhas 8–13 e 22–26)
  - `backend/src/controllers/artesao.controller.ts` (linhas 8–14 e 23–27)

### Trecho do Código Original

```typescript
// backend/src/controllers/produto.controller.ts (linhas 8-13 e 22-26)
const page = req.query.page ? Number(req.query.page) : undefined;
const limit = req.query.limit ? Number(req.query.limit) : undefined;
const technique = typeof req.query.technique === 'string' ? req.query.technique : undefined;
const hub = typeof req.query.hub === 'string' ? req.query.hub : undefined;

const resultado = await produtoService.listar({ page, limit, technique, hub });
// ...
const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
if (!id) {
  throw new AppError('Identificador do produto é obrigatório.', 400);
}

// backend/src/controllers/artesao.controller.ts (linhas 8-14 e 23-27)
const page = req.query.page ? Number(req.query.page) : undefined;
const limit = req.query.limit ? Number(req.query.limit) : undefined;
const q = typeof req.query.q === 'string' ? req.query.q : typeof req.query.nome === 'string' ? req.query.nome : undefined;
const hub = typeof req.query.hub === 'string' ? req.query.hub : undefined;
const technique = typeof req.query.technique === 'string' ? req.query.technique : undefined;

const resultado = await artesaoService.listar({ page, limit, q, hub, technique });
// ...
const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
if (!id) {
  throw new AppError('Identificador do artesão é obrigatório.', 400);
}
```

---

## 4. Diagnóstico e Impactos na Qualidade

Embora o catálogo inicial (`MAPEAMENTO.md`) tenha classificado o CS-07 com severidade **Baixa** apenas pela repetição sintática entre os dois controllers, a análise conjunta com a camada de serviço (`produto.service.ts` e `artesao.service.ts`) e de erros (`errorHandler.ts`) revelou impactos concretos de manutenção e **bugs reais silenciosos**:

- **Legibilidade:** Ambos os controllers misturam o fluxo de orquestração HTTP com verificações manuais repetitivas de `typeof ... === 'string'`, coerção manual com `Number(...)` e normalização `Array.isArray(req.params.id)` imposta pela tipagem do Express 5.
- **Coesão:** Viola o Princípio da Responsabilidade Única (SRP) e o padrão GRASP *Controller*: em vez de delegar a validação de entrada para uma fronteira declarativa e entregar um DTO confiável ao serviço, o controller repassa valores não validados (incluindo `NaN`, decimais e strings compostas apenas por espaços) para a camada de serviço tentar compensar.
- **Acoplamento:** Existe acoplamento frágil entre o parsing de `req.query` nos controllers e a implementação interna da paginação nos services. No código original, enviar `?limit=abc` ou `?limit=1&limit=2` fazia `Number(...)` resultar em `NaN` no controller; no service (`options.limit !== undefined ? Math.max(1, Number(options.limit)) : 10`), como `NaN !== undefined` é `true` e `Math.max(1, NaN)` retorna `NaN`, a API respondia **`200 OK` com `dados: []` e `meta.itensPorPagina: null`**, escondendo todo o catálogo sem erro algum. Além disso, em `artesao.controller.ts`, `?q=&nome=Severino` fazia `q` assumir `""` e ignorar o alias `nome`.
- **Manutenibilidade:** O projeto já possuía **Zod** nas dependências e um tratamento pronto para `ZodError` em `backend/src/middlewares/errorHandler.ts` (linhas 19–25) retornando HTTP `400` no padrão `{ erro: "Dados inválidos: ..." }`, mas nenhum endpoint o utilizava. Manter o parsing manual replicado dificultaria a padronização de erros na API.
- **Extensibilidade:** Conforme `docs/05-desenvolvimento-web/contratos-api.md`, o backend ainda evoluirá com rotas de produtos (escrita), reservas de estoque, pedidos, avaliações e autenticação. Sem uma camada centralizada de validação por schema, cada novo controller tenderia a copiar o mesmo padrão manual e seus bugs de borda (como ausência de limite máximo de `limit` em consultas futuras ao PostgreSQL).

---

## 5. Alternativas Consideradas

1. **Abordagem A — Extração de Validadores Reutilizáveis com Zod (`Extract Function / Replace Inline Code with Function Call`) — Escolhida:**
   - *Descrição:* Criar `backend/src/validators/request.validator.ts` (primitivas reutilizáveis de query inteira positiva, texto opcional, campos de paginação e extração de `:id`) e `backend/src/validators/catalog.validator.ts` (schemas específicos `listarProdutosQuerySchema`, `listarArtesaosQuerySchema`, `produtoIdParamSchema`, `artesaoIdParamSchema`), acionando o tratamento de `ZodError` já existente no `errorHandler.ts`.
   - *Vantagens:* Elimina a duplicação entre os controllers, corrige o bug silencioso de `NaN` em `?limit=abc` e `?limit=1&limit=2`, impõe teto seguro (`limit <= 100`, preservando o `limit=100` consumido pelo frontend), preserva `q ?? nome` mesmo quando `q=` vem vazio e aproveita a infraestrutura de `Zod` + `errorHandler` já presente no projeto.
   - *Desvantagens:* Muda a resposta HTTP exclusivamente para **entradas malformadas** (ex.: `?limit=abc`, `?page=0`, `?limit=2.5`), que antes retornavam `200 OK` errático/silencioso e agora retornam `400 Bad Request`.
2. **Abordagem B — Helper puro sem `ZodError` (com fallback silencioso):**
   - *Descrição:* Extrair apenas uma função `parsePaginationQuery(req.query)` que descartasse valores inválidos (`NaN` -> `undefined`) retornando `200 OK` com valores padrão.
   - *Vantagens:* Mantém `200 OK` até para query strings inválidas.
   - *Desvantagens:* Mascara erros de clientes/consumidores da API, mantém código morto no `errorHandler.ts` (`instanceof ZodError`) e desperdiça a biblioteca Zod já instalada no projeto.
3. **Abordagem C — Manutenção do Status Quo (Não Refatorar):**
   - *Descrição:* Manter os blocos nos dois controllers por existirem apenas 4 rotas `GET` implementadas hoje e o frontend atual enviar apenas `?limit=100`.
   - *Vantagens:* Nenhuma alteração imediata no código.
   - *Desvantagens:* Deixa ativo o bug de `NaN` em `?limit=abc`, mantém inconsistência no fallback `q=&nome=...` e consolida o parsing manual antes da criação das rotas da Avaliação 2.

---

## 6. Decisão Fundamentada

- **Decisão Final:** `[X] Refatorar o código imediatamente` | `[ ] Manter a implementação atual justificadamente`
- **Justificativa da Decisão:**  
  A refatoração é a decisão tecnicamente mais sólida porque o problema transcende a duplicação cosmética: a coerção manual nos controllers interage mal com o cálculo de paginação nos services e desencadeia falhas reais (`dados: []` e `itensPorPagina: null` com HTTP `200` ao enviar `?limit=abc` ou `?limit=1&limit=2`), além de permitir paginação sem teto máximo e ignorar o fallback `nome` quando `q=""`. Como o projeto já depende do **Zod** e o `errorHandler.ts` já possui o fluxo pronto para `ZodError`, o custo da extração é baixo, o risco para os contratos válidos é nulo (validado por comparação direta antes/depois) e o backend ganha uma base reutilizável (*Protected Variations* / *Fail Fast*) para os próximos endpoints da Avaliação 2.

---

## 7. Intervenção Realizada

- **Técnica de Refatoração Aplicada:** *Extract Function*, *Extract Module* e *Replace Inline Code with Function Call* (Fowler, *Refactoring*), integrando validação declarativa por schema Zod na borda HTTP.
- **Arquivos Criados ou Modificados:**
  - `backend/src/validators/request.validator.ts` (**criado**): centraliza `MAX_PAGE_LIMIT` (`100`), `optionalPositiveIntQuery()`, `optionalTextQuery()`, `paginationQueryFields` e `createIdParamSchema()`.
  - `backend/src/validators/catalog.validator.ts` (**criado**): define `listarProdutosQuerySchema`, `listarArtesaosQuerySchema` (preservando alias `q ?? nome`), `produtoIdParamSchema` e `artesaoIdParamSchema`.
  - `backend/src/controllers/produto.controller.ts` (**modificado**): substitui parsing inline de `req.query` e `Array.isArray(req.params.id)` por `listarProdutosQuerySchema.parse(req.query)` e `produtoIdParamSchema.parse(req.params)`.
  - `backend/src/controllers/artesao.controller.ts` (**modificado**): substitui parsing inline de `req.query` e `Array.isArray(req.params.id)` por `listarArtesaosQuerySchema.parse(req.query)` e `artesaoIdParamSchema.parse(req.params)`.
- **Passo a Passo da Intervenção:**
  1. Registro da linha de base HTTP pré-refatoração em 20 cenários válidos e 12 cenários de borda/inválidos, confirmando o bug de `limit=abc` (`200 OK`, `dados: []`, `itensPorPagina: null`).
  2. Extração das regras genéricas de query string e parâmetro `:id` para `request.validator.ts`, tratando strings vazias (`?page=&limit=`) como `undefined` e rejeitando arrays, decimais, zero/negativos e `limit > 100` com `ZodError`.
  3. Definição dos schemas de catálogo em `catalog.validator.ts` e simplificação dos métodos `listar` e `detalhar` nos dois controllers, mantendo intactas as mensagens `404` e sem alterar os services (mantendo o CS-06 isolado).
  4. Execução de `npm run typecheck` e nova bateria HTTP comparando 100% das respostas válidas com a linha de base e conferindo as respostas `400` nos cenários inválidos.

---

## 8. Comparação Antes vs. Depois

### Antes da Refatoração (`produto.controller.ts` — 39 linhas)
```typescript
async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const technique = typeof req.query.technique === 'string' ? req.query.technique : undefined;
    const hub = typeof req.query.hub === 'string' ? req.query.hub : undefined;

    const resultado = await produtoService.listar({ page, limit, technique, hub });
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
},

async detalhar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) {
      throw new AppError('Identificador do produto é obrigatório.', 400);
    }

    const produto = await produtoService.buscarPorId(id);
    // ...
```

### Depois da Refatoração (`produto.controller.ts` — 34 linhas)
```typescript
async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listarProdutosQuerySchema.parse(req.query);
    const resultado = await produtoService.listar(query);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
},

async detalhar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = produtoIdParamSchema.parse(req.params);
    const produto = await produtoService.buscarPorId(id);
    // ...
```

- **Métricas Observadas:**
  - *Linhas em `produto.controller.ts`:* Antes: 39 → Depois: 34 linhas.
  - *Linhas em `artesao.controller.ts`:* Antes: 40 → Depois: 34 linhas.
  - *Parsing manual inline nos controllers:* Antes: 9 parâmetros de query + 2 extrações manuais de `:id` duplicadas → Depois: **0** (centralizado em schemas declarativos reutilizáveis).

---

## 9. Testes e Evidências de Validação

Não há script `test` configurado em `backend/package.json`. A validação foi conduzida por verificação de tipos (`tsc --noEmit`) e comparação automatizada antes/depois contra a aplicação Express (`app.ts`) em memória:

- **Comandos Executados:**
  ```powershell
  cd backend
  npm run typecheck
  # Execução do script comparativo HTTP (linha de base vs. pós-refatoração)
  $env:DATABASE_URL="postgresql://local:local@localhost:5432/origem"
  .\node_modules\.bin\tsx.cmd "<caminho-do-script-de-verificacao>" post
  ```
- **Resultado do `npm run typecheck`:**
  ```text
  src/config/database.ts(1,16): error TS2307: Cannot find module 'pg' or its corresponding type declarations.
  src/config/database.ts(2,26): error TS2307: Cannot find module '@prisma/adapter-pg' or its corresponding type declarations.
  ```
  *(Observação: zero erros nos arquivos alterados/criados e em todo o restante de `backend/src/`; os 2 erros acima em `src/config/database.ts` são pré-existentes no ambiente local porque `pg` e `@prisma/adapter-pg` não estão instalados em `backend/node_modules`.)*

- **Evidências de Preservação dos Endpoints Válidos (20/20 cenários idênticos — `Total diffs on valid endpoints: 0`):**
  ```text
  MATCH 200 /health
  MATCH 200 /produtos
  MATCH 200 /produtos?page=1&limit=5
  MATCH 200 /produtos?page=2&limit=5
  MATCH 200 /produtos?limit=100
  MATCH 200 /produtos?technique=Cer%C3%A2mica%20Figurativa
  MATCH 200 /produtos?technique=Couro
  MATCH 200 /produtos?hub=Alto%20do%20Moura
  MATCH 200 /produtos?page=&limit=
  MATCH 200 /produtos/p01
  MATCH 404 /produtos/p999
  MATCH 200 /artesaos
  MATCH 200 /artesaos?limit=3
  MATCH 200 /artesaos?limit=100
  MATCH 200 /artesaos?q=Severino
  MATCH 200 /artesaos?nome=Severino
  MATCH 200 /artesaos?hub=Bezerros
  MATCH 200 /artesaos?technique=Xilogravura
  MATCH 200 /artesaos/art-mestre-severino
  MATCH 404 /artesaos/art-inexistente
  ```

- **Evidências de Correção nos Casos de Borda e Entradas Inválidas:**
  - `GET /api/v1/produtos?limit=abc`:
    - *Antes:* `200` `{"dados":[],"meta":{"totalItens":14,"paginaAtual":1,"totalPaginas":1,"itensPorPagina":null}}`
    - *Depois:* `400` `{"erro":"Dados inválidos: O parâmetro 'limit' deve ser um número inteiro entre 1 e 100."}`
  - `GET /api/v1/produtos?limit=1&limit=2`:
    - *Antes:* `200` `{"dados":[],"meta":{"totalItens":14,"paginaAtual":1,"totalPaginas":1,"itensPorPagina":null}}`
    - *Depois:* `400` `{"erro":"Dados inválidos: O parâmetro 'limit' deve ser um número inteiro entre 1 e 100."}`
  - `GET /api/v1/produtos?page=abc`, `?page=1&page=2`, `?page=0`: `400` `{"erro":"Dados inválidos: O parâmetro 'page' deve ser um número inteiro maior ou igual a 1."}`
  - `GET /api/v1/produtos?limit=2.5`, `?limit=0`, `?limit=101`: `400` `{"erro":"Dados inválidos: O parâmetro 'limit' deve ser um número inteiro entre 1 e 100."}`
  - `GET /api/v1/produtos?technique=a&technique=b`: `400` `{"erro":"Dados inválidos: O parâmetro 'technique' deve ser um texto único."}`
  - `GET /api/v1/artesaos?q=&nome=Severino`: passou a aplicar o fallback `nome=Severino` corretamente (`200`, 1 item: Mestre Severino).
  - `GET /api/v1/produtos/%20%20` e `GET /api/v1/artesaos/%20%20`: `400` com mensagem obrigatória padronizada via `ZodError`.
- **Comportamento Visual / Telas:** Não aplicável (alteração restrita à camada HTTP de entrada no backend; contratos consumidos pelo frontend em `limit=100` e detalhe por `:id` permanecem 100% compatíveis).

---

## 10. Benefícios Alcançados, Riscos e Limitações

- **Benefícios Concretos:**
  - Elimina o bug silencioso do `NaN` em `limit` (`dados: []` e `itensPorPagina: null` com status `200`).
  - Ativa o tratamento de `ZodError` que já existia ocioso em `errorHandler.ts`, padronizando respostas `400`.
  - Protege a paginação futura no banco de dados com limite máximo explícito (`MAX_PAGE_LIMIT = 100`), sem quebrar os consumidores atuais (`limit=100`).
  - Controllers ficaram curtos, coesos e livres de parsing imperativo repetido.
- **Riscos Remanescentes:**
  - Qualquer cliente externo que antes dependesse de a API ignorar parâmetros malformados (ex.: `?page=abc` caindo para página 1 com `200 OK`) agora receberá `400 Bad Request`. Nenhum consumidor atual do frontend faz isso.
  - Em `backend/package.json` consta `"zod": "^4.6.7"`, enquanto `backend/node_modules` local tinha `zod@3.25.76` instalado; os validadores foram escritos evitando APIs exclusivas de uma única versão (`z.unknown().transform(...)` com `code: 'custom'`) para manter compatibilidade ao rodar `npm install` com Zod 4. Ainda assim, recomenda-se revalidar `npm run typecheck` após sincronizar `node_modules`.
- **Limitações da Abordagem:**
  - A lógica duplicada de paginação e a assimetria de `.trim()` entre `produto.service.ts` e `artesao.service.ts` pertencem ao **CS-06** e foram intencionalmente preservadas fora desta intervenção para manter o escopo isolado.
  - O `npm run build` completo do backend ainda exige a instalação das dependências de banco (`pg`, `@prisma/adapter-pg`) referenciadas em `database.ts`.

---

## 11. Rastreabilidade Git

- **Hash do Commit Individual:** `*[Pendente — preencher após realizar o commit individual]*`
- **Mensagem do Commit Sugerida:** `refactor(backend): centraliza parsing e validacao de query e params com Zod nos controllers (CS-07)`
- **Branch:** `feat/frontend-next`
- **Autor do Commit:** `Luiz Henrique <luiz.contato.1000@gmail.com>`

---

## 12. Roteiro Sintético para Apresentação em Sala

1. **O Problema (30 seg):**  
   *"Identifiquei o Code Smell **CS-07 (Duplicated Code)** nos controllers `produto.controller.ts` e `artesao.controller.ts`, onde ambos repetiam parsing manual de `req.query` (`Number(...)`, `typeof === 'string'`) e extração de `req.params.id`."*
2. **A Avaliação Crítica (45 seg):**  
   *"Ao analisar o fluxo até o service, descobri que não era só código repetido: enviar `?limit=abc` gerava `NaN` no controller e fazia `Math.max(1, NaN)` no service devolver `200 OK` com `dados: []` e `itensPorPagina: null`. Ao mesmo tempo, o projeto já tinha Zod instalado e `errorHandler.ts` pronto para `ZodError` sem uso. Por isso decidi refatorar."*
3. **A Ação e Resultados (45 seg):**  
   *"Extraí schemas e helpers reutilizáveis com Zod para `backend/src/validators/request.validator.ts` e `catalog.validator.ts`. Validei 20 chamadas válidas comparando antes e depois com zero divergência, e comprovei que entradas inválidas como `?limit=abc`, `?limit=2.5` ou `?limit=101` agora retornam `400 Bad Request` padronizado."*
4. **Lição Aprendida (30 seg):**  
   *"Validar dados na borda HTTP protege as camadas internas de regras de negócio, evita bugs silenciosos por coerção fraca do JavaScript e aproveita melhor os mecanismos de erro já previstos na arquitetura."*
