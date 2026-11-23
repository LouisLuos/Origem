# Checklist Principal de Implementação e Conformidade — Projeto Origem

> **Versão de Referência:** 2.0 (Revisão Normativa e Rastreabilidade Rigorosa)  
> **Branch Ativa:** `feat/frontend-next`  
> **Fontes Normativas:**  
> - `references/projeto-integrador-origem.md` (Critérios acadêmicos, arquitetura esperada e rubrica da AV2)  
> - `references/backlog-priorizado-origem.md` (Histórias de usuário INVEST, critérios BDD e tarefas SMART)  
> - `references/relatorio-execucao-testes-origem.md` (Registro histórico de testes e bloqueios prévios)  
> - `AGENTS.md` (Diretrizes de governança, evidências e preservação do projeto)

---

## 1. Visão Geral e Taxonomia Normativa

Este documento consolida o **plano mestre de conformidade e acompanhamento da implementação** do Projeto Origem para a Avaliação 2. Para assegurar total fidelidade às fontes oficiais e evitar que decisões de projeto sejam confundidas com imposições da disciplina, adota-se a seguinte taxonomia estrita:

### 1.1 Classificação Normativa dos Requisitos
1. **Exigência da Disciplina (Obrigatório):** Critério acadêmico indispensável do regulamento oficial e dos checklists da Avaliação 2 em Desenvolvimento Web. A ausência compromete diretamente a nota.
2. **Regra de Negócio do Backlog (Must Have):** Invariante de domínio ou história de usuário inegociável para a viabilidade operacional e jurídica do marketplace (MoSCoW Must Have).
3. **Melhoria do Backlog (Should Have):** Funcionalidade de alto valor agregado, mas flexível ou negociável para o escopo inicial do MVP (MoSCoW Should Have).
4. **Recomendação Arquitetural:** Padrão de organização de pastas, camadas ou boas práticas sugerido como referência na documentação, adaptável às regras de negócio.
5. **Exemplo na Documentação:** Ilustração prática, tecnologia ou alternativa aceita citada a título exemplificativo na documentação oficial (não impositiva).
6. **Decisão Técnica Proposta / Tarefa Derivada:** Solução de engenharia ou escolha técnica formulada pelo agente/equipe para operacionalizar as exigências, sujeita a aprovação humana.

### 1.2 Classificação do Estado Atual
- **Atendido (Verificado):** Implementado no código e com funcionamento atestado por testes automatizados ou evidências dinâmicas nesta branch.
- **Atendido em Módulo Isolado:** Implementado e validado em módulo autônomo (ex.: testes pytest do recomendador em `ia-recomendador/`), porém sem conexão com a aplicação web integrada.
- **Parcialmente atendido (Inspeção estática):** Componentes visuais, contratos ou trechos parciais existem no código inspecionado, mas carecem de backend, persistência ou integração completa.
- **Não atendido:** Inexistente no código-fonte desta branch.
- **Divergente:** Implementação atual conflita com a regra de negócio ou omite restrições obrigatórias (ex.: peças cadastradas sem cubagem física ou frete fixo sem cálculo por ateliê).
- **Não verificado em integração:** Código existe na inspeção estática, mas seu funcionamento dinâmico com o backend real ainda não foi testado.

---

## 2. Tabela-Resumo de Rastreabilidade

| ID | Requisito | Fonte Normativa | Classificação Normativa | Estado Atual | Ação Necessária |
|---|---|---|---|---|---|
| **REQ-STK-001** | Runtime Node.js | PI — Backend esperado (L329) | Exigência da Disciplina (Obrigatório) | **Atendido** | Módulo `backend/` inicializado com Node.js v22 LTS e `package.json` |
| **REQ-STK-002** | TypeScript Estrito no Backend | PI — Níveis de avaliação (L478) | Exigência da Disciplina (Obrigatório) | **Atendido** | `backend/tsconfig.json` configurado com tipagem rigorosa NodeNext ESM |
| **REQ-STK-003** | Framework Web Express | PI — Backend esperado (L330) | Exigência da Disciplina (Obrigatório) | **Atendido** | Servidor Express 5 configurado com pipeline de middlewares e rotas |
| **REQ-STK-004** | Prisma ORM | PI — Backend esperado (L331) | Exigência da Disciplina (Obrigatório) | **Parcialmente atendido** | Prisma 7 configurado com `prisma.config.ts`, `schema.prisma`, `@prisma/adapter-pg` e client gerado |
| **REQ-STK-005** | Banco PostgreSQL Relacional | PI — Escopo mínimo (L292) | Exigência da Disciplina (Obrigatório) | Não atendido | Conectar banco PostgreSQL e estruturar tabelas normalizadas |
| **REQ-STK-006** | Mecanismo de Cache de Dados | PI — Backend esperado (L335) | Exigência da Disciplina (Obrigatório) | Não atendido | Implementar cache em catálogo/produtos (Redis é recomendado/exemplo) |
| **REQ-STK-007** | Processamento Assíncrono | PI — Backend esperado (L336) | Exigência da Disciplina (Obrigatório) | Não atendido | Implementar fila/worker desacoplado da resposta HTTP |
| **REQ-STK-008** | Variáveis de Ambiente | PI — Checklist AV2 (L446) | Exigência da Disciplina (Obrigatório) | **Atendido** | `backend/.env.example`, `.env` e validação tipada em tempo de execução via Zod em `env.ts` |
| **REQ-ARC-001** | Separação em Camadas | PI — Modelo de organização (L490, L731) | Exigência da Disciplina (Obrigatório) | **Atendido** | Estrutura em camadas `routes/`, `controllers/`, `services/`, `repositories/`, `middlewares/`, etc. |
| **REQ-ARC-002** | Isolamento de Rotas | PI — Responsabilidades (L855) | Recomendação Arquitetural | **Atendido** | Rotas isoladas sob `/api/v1` em `backend/src/routes/` delegando a controllers |
| **REQ-ARC-003** | Controllers Enxutos | PI — Responsabilidades (L856) | Recomendação Arquitetural | **Atendido** | Controllers manipulando apenas I/O HTTP (`HealthController`) |
| **REQ-ARC-004** | Services de Domínio | PI — Responsabilidades (L857) | Recomendação Arquitetural | Não atendido | Encapsular regras de negócio e transações nos services |
| **REQ-ARC-005** | Repositories de Dados | PI — Responsabilidades (L858) | Recomendação Arquitetural | Não atendido | Isolar queries Prisma e locks pessimistas nos repositories |
| **REQ-ARC-006** | Middlewares Centrais | PI — Responsabilidades (L859) | Recomendação Arquitetural | **Parcialmente atendido** | Middlewares `requestLogger` e `errorHandler` criados; pendente auth JWT e RBAC |
| **REQ-ARC-007** | Padronização de Respostas | PI — Regras esperadas (L882) | Recomendação Arquitetural | **Atendido** | Implementada classe `AppError` e envelope JSON `{ "erro": string }` validado |
| **REQ-DAT-001** | Persistência Real de Negócio | PI — Persistência (L983) | Exigência da Disciplina (Obrigatório) | Não atendido | Substituir mocks/localStorage de dados de negócio por PostgreSQL |
| **REQ-DAT-002** | Migrations Versionadas | PI — Checklist AV2 (L422) | Exigência da Disciplina (Obrigatório) | Não atendido | Versionar migrações do banco com Prisma Migrate |
| **REQ-DAT-003** | Entidade Usuario e Papéis | Backlog — HU-01 (L112) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modelar tabela `usuarios` com papéis `COMPRADOR`, `ARTESAO`, etc. |
| **REQ-DAT-004** | Entidade Atelie e Endereço | Backlog — HU-04 (L195) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modelar tabela `atelies` com relação 1:1 estrita com `enderecos` |
| **REQ-DAT-005** | Vínculo AtelieCurador | Backlog — HU-03 (L155) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modelar tabela associativa `atelies_curadores` |
| **REQ-DAT-006** | Peças com Cubagem (Invariante 2) | Backlog — HU-05 (L234) | Regra de Negócio do Backlog (Must Have) | Não atendido | Adicionar peso ($\ge 50$g), dimensões e `is_fragil` na modelagem |
| **REQ-DAT-007** | Galeria de Fotos da Peça | Backlog — HU-05 (L234) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modelar tabela `fotos_peca` vinculada à peça |
| **REQ-DAT-008** | Controle de Lotes e Estoque | Backlog — HU-06 (L275) | Melhoria do Backlog (Should Have) | Não atendido | Modelar coluna `quantidade_estoque` com trava de não-negativo |
| **REQ-DAT-009** | Reservas Temporárias (Invariante 1) | Backlog — HU-09 (L397) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modelar tabela `reservas` com TTL de 15 minutos e trava única |
| **REQ-DAT-010** | Pedidos e Subpedidos | Backlog — HU-12 (L516) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modelar entidades `pedidos`, `subpedidos` e `itens_subpedido` |
| **REQ-DAT-011** | Repasses e Custódia D+7 | Backlog — HU-14 (L603) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modelar tabela `repasses_pix` com status e snapshot de chave |
| **REQ-DAT-012** | Disputas e Sinistros | Backlog — HU-15 (L644) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modelar tabela `disputas` vinculada a subpedidos |
| **REQ-DAT-013** | Livro de Endereços | Backlog — HU-11 (L477) | Melhoria do Backlog (Should Have) | Não atendido | Modelar relação de até 5 endereços por comprador |
| **REQ-DAT-014** | Povoamento com Dados Reais | PI — Evidências (L463, L803) | Decisão Técnica Proposta / Tarefa Derivada | Não atendido | Criar `seed.ts` cultural (o PI exige dados reais demonstráveis) |
| **REQ-SEC-001** | Autenticação JWT | PI — Backend esperado (L333) | Exigência da Disciplina (Obrigatório) | Não atendido | Implementar login e emissão de tokens JWT assinados |
| **REQ-SEC-002** | Hash Seguro de Senhas | Backlog — HU-01 (L113) | Regra de Negócio do Backlog (Must Have) | Não atendido | Aplicar Bcrypt/Argon2id na criação e validação de senhas |
| **REQ-SEC-003** | Autorização RBAC | PI — Autenticação e perfis (L341) | Exigência da Disciplina (Obrigatório) | Não atendido | Middleware validando permissões por papel de acesso |
| **REQ-SEC-004** | Blindagem Financeira de Curador | Backlog — HU-03 (L140) | Regra de Negócio do Backlog (Must Have) | Não atendido | Bloquear com HTTP 403 acesso/edição de Pix por Curadores |
| **REQ-SEC-005** | Proteção Força Bruta (Login) | Backlog — HU-01 (L104) | Regra de Negócio do Backlog (Must Have) | Não atendido | Limitar a 5 erros e bloquear por 15 min com HTTP 429 |
| **REQ-SEC-006** | Recuperação Segura de Senha | Backlog — HU-02 (L705) | Melhoria do Backlog (Should Have) | Não atendido | Implementar fluxo com token descartável de 30 minutos |
| **REQ-SEC-007** | Validação com Schemas Zod | PI — Estrutura (L792) | Decisão Técnica Proposta / Tarefa Derivada | Não atendido | Validar payloads HTTP rejeitando dados inválidos |
| **REQ-DOM-001** | Cadastro e Perfis (HU-01/03) | Backlog — HU-01 e HU-03 | Regra de Negócio do Backlog (Must Have) | Parcialmente atendido | Conectar cadastro ao banco com validação de CPF e Chave Pix |
| **REQ-DOM-002** | Parametrização Ateliê (HU-04) | Backlog — HU-04 (L162) | Regra de Negócio do Backlog (Must Have) | Não atendido | Criar endpoint de ateliê e endereço de expedição com CEP |
| **REQ-DOM-003** | Catalogação com Cubagem (HU-05) | Backlog — HU-05 (L201) | Regra de Negócio do Backlog (Must Have) | Divergente | Atualizar modal e API para peso $\ge 50$g, dimensões e `is_fragil` |
| **REQ-DOM-004** | Lotes e Anti-Overselling (HU-06) | Backlog — HU-06 (L241) | Melhoria do Backlog (Should Have) | Parcialmente atendido | Transação com lock pessimista na baixa de peças em lote |
| **REQ-DOM-005** | Vitrine e Busca Cultural (HU-07) | Backlog — HU-07 (L281) | Regra de Negócio do Backlog (Must Have) | Parcialmente atendido | Conectar vitrine ao backend com filtros e paginação |
| **REQ-DOM-006** | Simulação de Frete na Peça (HU-07)| Backlog — HU-07 (L306) | Regra de Negócio do Backlog (Must Have) | Não atendido | Criar cálculo de frete por CEP/cubagem no detalhe da peça |
| **REQ-DOM-007** | Portfólio do Mestre (HU-08) | Backlog — HU-08 (L322) | Regra de Negócio do Backlog (Must Have) | Parcialmente atendido | Conectar perfil cultural à API e otimizar metadados |
| **REQ-DOM-008** | Reserva Concorrente 15min (HU-09)| Backlog — HU-09 (L361) | Regra de Negócio do Backlog (Must Have) | Não atendido | Endpoint com lock pessimista, reserva de 15 min e retorno 409 |
| **REQ-DOM-009** | Carrinho por Ateliê (HU-09) | Backlog — HU-09 (L375) | Regra de Negócio do Backlog (Must Have) | Divergente | Agrupar visualmente o carrinho em blocos por ateliê |
| **REQ-DOM-010** | Checkout Unificado (HU-10) | Backlog — HU-10 (L404) | Regra de Negócio do Backlog (Must Have) | Não atendido | Exibir QR Code Pix e Copia-e-Cola com tempo de reserva |
| **REQ-DOM-011** | Webhook Idempotente (HU-10) | Backlog — HU-10 (L424) | Regra de Negócio do Backlog (Must Have) | Não atendido | Endpoint de webhook com trava por `Idempotency-Key` |
| **REQ-DOM-012** | Livro de Endereços (HU-11) | Backlog — HU-11 (L445) | Melhoria do Backlog (Should Have) | Não atendido | CRUD de até 5 endereços salvos com recálculo de frete |
| **REQ-DOM-013** | Subpedidos por Ateliê (HU-12) | Backlog — HU-12 (L483) | Regra de Negócio do Backlog (Must Have) | Não atendido | Desmembrar pedido consolidado pago em N subpedidos |
| **REQ-DOM-014** | Guia de Embalagem Frágil (HU-12) | Backlog — HU-12 (L508) | Regra de Negócio do Backlog (Must Have) | Não atendido | Modal bloqueante antes da emissão de etiqueta de cerâmica |
| **REQ-DOM-015** | Rastreio e SLA 7 Dias (HU-13) | Backlog — HU-13 (L523) | Regra de Negócio do Backlog (Must Have) | Não atendido | Código de rastreio, contagem de dias úteis e cancelamento |
| **REQ-DOM-016** | Custódia D+7 e Repasse Pix (HU-14)| Backlog — HU-14 (L564) | Regra de Negócio do Backlog (Must Have) | Não atendido | Retenção D+7 pós-entrega e liquidação Pix automatizada |
| **REQ-DOM-017** | Registro de Avaria em 48h (HU-15) | Backlog — HU-15 (L610) | Regra de Negócio do Backlog (Must Have) | Não atendido | Formulário de sinistro com fotos e laudo no painel admin |
| **REQ-DOM-018** | Arrependimento 7 Dias (HU-16) | Backlog — HU-16 (L651) | Regra de Negócio do Backlog (Must Have) | Não atendido | Devolução tempestiva CDC com logística reversa |
| **REQ-DOM-019** | Painel Admin & Auditoria (HU-18) | Backlog — HU-18 (L772) | Regra de Negócio do Backlog (Must Have) | Parcialmente atendido | Conectar admin à API com métricas contábeis de custódia |
| **REQ-ASY-001** | Desacoplamento Assíncrono | PI — Processamento assíncrono (L384)| Exigência da Disciplina (Obrigatório) | Não atendido | Resposta HTTP imediata com execução delegada a workers |
| **REQ-ASY-002** | Job Expiração de Reservas | Backlog — HU-09 (L388) | Regra de Negócio do Backlog (Must Have) | Não atendido | Rotina em background devolvendo peças reservadas há > 15min |
| **REQ-ASY-003** | Job Fiscalização de SLA | Backlog — HU-13 (L543) | Regra de Negócio do Backlog (Must Have) | Não atendido | Rotina diária de alertas no 3º e 5º dia útil de postagem |
| **REQ-ASY-004** | Job Liquidação D+7 | Backlog — HU-14 (L589) | Regra de Negócio do Backlog (Must Have) | Não atendido | Rotina diária liberando repasses Pix vencidos sem disputa |
| **REQ-ASY-005** | Hub Notificações (HU-17) | Backlog — HU-17 (L732) | Melhoria do Backlog (Should Have) | Não atendido | Envio assíncrono resiliente de e-mails transacionais |
| **REQ-CCH-001** | Cache em Ponto Crítico | PI — Cache (L395) | Exigência da Disciplina (Obrigatório) | Não atendido | Cachear catálogo de produtos (`GET /produtos`) |
| **REQ-CCH-002** | Invalidação de Cache | PI — Qualidade técnica (L898) | Recomendação Arquitetural | Não atendido | Purgar cache nas mutações de criação/edição/estoque |
| **REQ-REC-001** | Recomendação Integrada | PI — Recomendação (L362) | Exigência da Disciplina (Obrigatório) | Não atendido | Consumo da recomendação diretamente pela aplicação web |
| **REQ-REC-002** | Algoritmo Vetorial/Cestas (HU-24) | `ia-recomendador/README.md` | Regra da Trilha de IA / Tarefa Derivada | Atendido em Módulo Isolado | Integrar algoritmo de similaridade por cosseno e co-compra |
| **REQ-REC-003** | Exibição no Frontend | PI — Recomendação (L364) | Exigência da Disciplina (Obrigatório) | Divergente | Conectar `ProductDetail.tsx` ao endpoint de recomendação real |
| **REQ-INT-001** | Conexão dos Services à API | PI — Escopo mínimo (L109) | Exigência da Disciplina (Obrigatório) | Parcialmente atendido | Atualizar `catalogService`, `artisanService`, `orderService` |
| **REQ-INT-002** | Gestão de Sessão com JWT | PI — Autenticação (L333) | Exigência da Disciplina (Obrigatório) | Não atendido | Atualizar `AuthContext` para armazenar token e cabeçalho Bearer |
| **REQ-INT-003** | Atualização de Formulários | Backlog — HUs 01, 03, 05 | Regra de Negócio do Backlog (Must Have) | Divergente | Incluir campos de CPF, Pix, cubagem e fragilidade na UI |
| **REQ-INT-004** | Exibição de Pix Dinâmico | Backlog — HU-10 (L418) | Regra de Negócio do Backlog (Must Have) | Não atendido | Renderizar QR Code Pix e Copia-e-Cola na confirmação |
| **REQ-INT-005** | Tratamento de Estados Visuais | PI — API e services (L973) | Exigência da Disciplina (Obrigatório) | Não verificado em integração | Preservar `LoadingBlock`, `ErrorBlock` em chamadas reais |
| **REQ-DOC-001** | Documentação Completa da API | PI — Entregáveis (L460) | Exigência da Disciplina (Obrigatório) | Não atendido | Documentar API (Swagger é recomendação/exemplo preferencial) |
| **REQ-DOC-002** | README Geral do Projeto | PI — Entregáveis (L461) | Exigência da Disciplina (Obrigatório) | Parcialmente atendido | Atualizar README com arquitetura full stack e comandos |
| **REQ-DOC-003** | Arquivo `.env.example` | PI — Entregáveis (L462) | Exigência da Disciplina (Obrigatório) | Parcialmente atendido | Fornecer `.env.example` completo sem segredos reais |
| **REQ-DOC-004** | Declaração de Uso de IA | PI — Declaração de IA (L1078) | Exigência da Disciplina (Obrigatório) | Não atendido | Criar e preencher `docs/uso-de-ia.md` |
| **REQ-DOC-005** | Testes no Core Domain ($\ge 85\%$)| Backlog — DoD (L819) | Exigência da Disciplina (Obrigatório) | Não atendido | Testes automatizados para reservas, cubagem e estoque |
| **REQ-DOC-006** | Deploy Público Integrado | PI — Entregáveis (L458) | Exigência da Disciplina (Obrigatório) | Não atendido | Deploy da aplicação completa (Vercel + Render/Railway) |

---

## 3. Detalhamento dos Requisitos Técnicos por Área

### 3.1 Stack Tecnológica e Ambiente

#### REQ-STK-001 — Runtime Node.js
- **Fonte:** Projeto Integrador Origem — *Backend esperado na Avaliação 2* (L329)
- **Exigência Original:** Uso de Node.js como runtime oficial do backend na stack de referência da disciplina.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)** para o uso de Node.js. A restrição de versão `v20+` (LTS) decorre do ambiente do frontend (`frontend/package.json` L34: `"node": ">=20.9.0"`), sendo uma restrição de compatibilidade do repositório, não uma imposição do texto do PI.
- **Estado atual:** **Atendido**
- **Evidência:** Módulo `backend/` criado com `package.json` (Node.js v22 LTS) e scripts de execução (`dev`, `build`, `start`, `typecheck`).
- **Ação necessária:** Manter dependências atualizadas e scripts funcionais.
- **Módulo:** `backend/`
- **Critério de conclusão:** Node.js configurado e operacional no backend com scripts de execução validados.
- **Dependências:** Nenhuma.
- [x] Implementar
- [x] Validar
- [x] Documentar

#### REQ-STK-002 — TypeScript Estrito no Backend
- **Fonte:** Projeto Integrador Origem — *Níveis de avaliação* (L478) e *TypeScript* (L935-L950)
- **Exigência Original:** Tipagem estrita de entidades, props, DTOs e retornos; o não uso de TypeScript acarreta conceito "Não entregue" (nota zero no critério).
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** **Atendido**
- **Evidência:** `backend/tsconfig.json` configurado com `strict: true`, `noImplicitAny: true`, resolução `NodeNext` ESM, compilando com 0 erros via `npm run typecheck` (`tsc --noEmit`).
- **Ação necessária:** Manter tipagem estrita em novos módulos e services.
- **Módulo:** `backend/`
- **Critério de conclusão:** Compilação com `tsc --noEmit` sem erros de tipagem estrita.
- **Dependências:** REQ-STK-001.
- [x] Implementar
- [x] Validar
- [x] Documentar

#### REQ-STK-003 — Framework Web Express
- **Fonte:** Projeto Integrador Origem — *Backend esperado na Avaliação 2* (L330)
- **Exigência Original:** Express como framework web HTTP de referência da disciplina.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** **Atendido**
- **Evidência:** Servidor Express 5 configurado em `backend/src/app.ts` e `backend/src/server.ts`, com CORS, JSON parser, logger e rotas sob `/api/v1`. Validado respondendo HTTP 200 em `GET /api/v1/health` e 404 padronizado em rotas inexistentes.
- **Ação necessária:** Mapear rotas de negócio adicionais conforme os domínios forem implementados.
- **Módulo:** `backend/`
- **Critério de conclusão:** Servidor Express respondendo requisições HTTP na porta configurada com tratamento de CORS e JSON parser.
- **Dependências:** REQ-STK-001, REQ-STK-002.
- [x] Implementar
- [x] Validar
- [x] Documentar

#### REQ-STK-004 — Prisma ORM
- **Fonte:** Projeto Integrador Origem — *Backend esperado na Avaliação 2* (L331)
- **Exigência Original:** Prisma ORM como ferramenta de mapeamento objeto-relacional e migrações na stack de referência da disciplina.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** **Parcialmente atendido**
- **Evidência:** Prisma 7 configurado com `prisma.config.ts`, `backend/prisma/schema.prisma` com gerador `provider = "prisma-client"` e output em `src/generated/prisma/`, driver adapter `@prisma/adapter-pg` com pool PostgreSQL em `backend/src/config/database.ts`, gerado com sucesso via `npm run prisma:generate`. Pendente modelagem das entidades de negócio e execução de migrations.
- **Ação necessária:** Modelar os modelos de dados no schema e executar `prisma migrate dev`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Prisma Client gerado e integrado às camadas de repositories.
- **Dependências:** REQ-STK-005.
- [x] Implementar
- [x] Validar
- [ ] Documentar

#### REQ-STK-005 — Banco de Dados Relacional PostgreSQL
- **Fonte:** Projeto Integrador Origem — *Escopo mínimo* (L292) e Backlog Priorizado (L31)
- **Exigência Original:** Persistência em banco relacional PostgreSQL com suporte a transações ACID, integridade referencial estrita e locks de linha.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** Não há conexão com banco de dados configurada nesta branch.
- **Ação necessária:** Configurar string de conexão com instância PostgreSQL e parametrizar datasource no Prisma.
- **Módulo:** `backend/`
- **Critério de conclusão:** Conexão bem-sucedida ao PostgreSQL via Prisma com execução de queries de teste.
- **Dependências:** Nenhuma.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-STK-006 — Mecanismo de Cache de Dados
- **Fonte:** Projeto Integrador Origem — *Backend esperado* (L335) e *Processamento assíncrono e cache* (L395-L405)
- **Exigência Original:** "Cache em pelo menos um ponto relevante (ex: produto, lista de produtos)" (L304, L428). O documento aponta: "Redis ou tecnologia equivalente, quando fizer sentido" (L335).
- **Classificação Normativa:** A presença do cache é **Exigência da Disciplina (Obrigatório)**; a escolha específica do Redis é **Recomendação Arquitetural / Exemplo na Documentação**, sendo aceita tecnologia equivalente justificada.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de camada de cache no frontend ou no backend.
- **Ação necessária:** Implementar módulo de cache em `backend/src/cache/` (Redis ou cache em memória com TTL e invalidação).
- **Módulo:** `backend/`
- **Critério de conclusão:** Requisições subsequentes ao catálogo/produtos respondidas pelo cache com tempo de resposta comprovadamente inferior.
- **Dependências:** REQ-STK-003. Decisão Pendente 02.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-STK-007 — Processamento Assíncrono / Mensageria
- **Fonte:** Projeto Integrador Origem — *Backend esperado* (L336) e *Processamento assíncrono e cache* (L382-L394)
- **Exigência Original:** "Fila, notificação, processamento de imagem ou fluxo equivalente" (L303, L427). O documento indica: "Filas ou processamento assíncrono, quando fizer sentido" (L336).
- **Classificação Normativa:** A presença de processamento assíncrono conectado a necessidade real é **Exigência da Disciplina (Obrigatório)**; o uso de BullMQ/Redis é **Recomendação Arquitetural / Exemplo na Documentação**, sendo válida fila transacional no banco.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de filas ou workers em segundo plano nesta branch.
- **Ação necessária:** Implementar worker/fila assíncrono desacoplado do ciclo de resposta HTTP.
- **Módulo:** `backend/`
- **Critério de conclusão:** Requisição HTTP responde imediatamente enquanto tarefa executa em segundo plano com log de conclusão.
- **Dependências:** REQ-STK-003, REQ-STK-005. Decisão Pendente 02.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-STK-008 — Variáveis de Ambiente e Configuração
- **Fonte:** Projeto Integrador Origem — *Checklist AV2* (L446) e *Entregáveis* (L462)
- **Exigência Original:** Centralização de credenciais e parâmetros em arquivo `.env.example` documentado, sem segredos reais expostos no repositório.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** **Atendido**
- **Evidência:** `backend/.env.example` e `backend/.env` criados com parâmetros documentados (`PORT`, `NODE_ENV`, `DATABASE_URL`, `CORS_ORIGIN`, `JWT_SECRET`, `IA_RECOMENDADOR_URL`), com validação tipada em tempo de execução via Zod em `backend/src/config/env.ts`.
- **Ação necessária:** Expandir variáveis conforme novos serviços ou credenciais forem adicionados.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Aplicação valida variáveis de ambiente no startup e aborta com mensagem clara caso alguma variável obrigatória falte.
- **Dependências:** REQ-STK-001.
- [x] Implementar
- [x] Validar
- [x] Documentar

---

### 3.2 Arquitetura e Organização de Camadas do Backend

#### REQ-ARC-001 — Separação em Camadas e Responsabilidades
- **Fonte:** Projeto Integrador Origem — *Organização do código* (L484-L491) e *Modelo de organização do backend* (L730-L737)
- **Exigência Original:** O documento exige: "A equipe deverá manter o projeto organizado, com separação clara entre responsabilidades... entre frontend, backend, documentação, serviços, tipos, regras de negócio e camadas de acesso a dados" (L486-L491). Declara expressamente: "A estrutura abaixo é uma referência recomendada. A equipe poderá adaptá-la de acordo com as regras de negócios escolhida" (L490).
- **Classificação Normativa:** A separação em camadas com responsabilidades claras é **Exigência da Disciplina (Obrigatório)**; a árvore de pastas exata (`routes`, `controllers`, `services`, `repositories`, `database`, `cache`, etc.) é **Recomendação Arquitetural**.
- **Estado atual:** **Atendido**
- **Evidência:** Estrutura de diretórios criada e operacional em `backend/src/` com separação rigorosa: `routes/`, `controllers/`, `services/`, `repositories/`, `middlewares/`, `config/`, `utils/`, `prisma/`.
- **Ação necessária:** Manter o isolamento entre camadas nos próximos desenvolvimentos de domínios.
- **Módulo:** `backend/`
- **Critério de conclusão:** Camadas com responsabilidades isoladas e respeitadas rigorosamente em todos os módulos da API.
- **Dependências:** REQ-STK-001.
- [x] Implementar
- [x] Validar
- [x] Documentar

#### REQ-ARC-002 — Isolamento de Rotas (`routes/`)
- **Fonte:** Projeto Integrador Origem — *Responsabilidade das principais pastas* (L855) e *Regras esperadas* (L878)
- **Exigência Original:** Definição das rotas e ligação com controllers; proibido concentrar regra de negócio diretamente nas rotas.
- **Classificação Normativa:** **Recomendação Arquitetural**.
- **Estado atual:** **Atendido**
- **Evidência:** Rotas montadas sob o prefixo `/api/v1` em `backend/src/routes/` (`index.ts` e `health.routes.ts`) delegando exclusivamente a controllers e middlewares.
- **Ação necessária:** Mapear rotas REST por recurso conforme as entidades forem modeladas.
- **Módulo:** `backend/`
- **Critério de conclusão:** Rotas simples delegando exclusivamente a controllers e middlewares.
- **Dependências:** REQ-ARC-001.
- [x] Implementar
- [x] Validar
- [x] Documentar

#### REQ-ARC-003 — Controllers Enxutos (`controllers/`)
- **Fonte:** Projeto Integrador Origem — *Responsabilidade das principais pastas* (L856) e *Regras esperadas* (L879, L890)
- **Exigência Original:** Entrada das requisições; controllers recebem dados, chamam services e devolvem respostas, sem acesso direto ao banco de dados.
- **Classificação Normativa:** **Recomendação Arquitetural**.
- **Estado atual:** **Atendido**
- **Evidência:** `HealthController` em `backend/src/controllers/health.controller.ts` manipulando exclusivamente I/O HTTP sem chamadas de persistência ou regras acopladas.
- **Ação necessária:** Preservar a natureza enxuta nos controllers de catálogo, pedidos e autenticação.
- **Módulo:** `backend/`
- **Critério de conclusão:** Zero queries Prisma dentro dos controllers.
- **Dependências:** REQ-ARC-001.
- [x] Implementar
- [x] Validar
- [x] Documentar

#### REQ-ARC-004 — Services de Domínio (`services/`)
- **Fonte:** Projeto Integrador Origem — *Responsabilidade das principais pastas* (L857) e *Exemplo de fluxo* (L914, L929)
- **Exigência Original:** Services concentrando as regras de negócio da aplicação (ex.: verificar estoque, calcular total, criar pedido).
- **Classificação Normativa:** **Recomendação Arquitetural**.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de services de backend na branch.
- **Ação necessária:** Implementar services por domínio isolados de objetos HTTP (`req`, `res`).
- **Módulo:** `backend/`
- **Critério de conclusão:** Services testáveis unitariamente sem dependência de Express.
- **Dependências:** REQ-ARC-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-ARC-005 — Repositories de Acesso a Dados (`repositories/`)
- **Fonte:** Projeto Integrador Origem — *Responsabilidade das principais pastas* (L858) e *Exemplo de fluxo* (L917, L930)
- **Exigência Original:** Repositories concentrando consultas e alterações no banco de dados por meio do ORM.
- **Classificação Normativa:** **Recomendação Arquitetural**.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de repositories na branch.
- **Ação necessária:** Implementar repositórios encapsulando métodos do Prisma Client e queries de lock transacional.
- **Módulo:** `backend/`
- **Critério de conclusão:** Operações de banco isoladas dos services.
- **Dependências:** REQ-STK-004, REQ-ARC-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-ARC-006 — Middlewares Centrais
- **Fonte:** Projeto Integrador Origem — *Responsabilidade das principais pastas* (L859) e *Regras esperadas* (L893)
- **Exigência Original:** Lógicas intermediárias para autenticação, autorização, validação e tratamento global de erros.
- **Classificação Normativa:** **Recomendação Arquitetural**.
- **Estado atual:** **Parcialmente atendido**
- **Evidência:** `requestLogger.ts` e `errorHandler.ts` criados e integrados ao pipeline global do Express em `backend/src/app.ts`. Pendente autenticação JWT (`authMiddleware`) e papéis RBAC (`roleMiddleware`).
- **Ação necessária:** Implementar `authMiddleware` e `roleMiddleware` na etapa de Autenticação.
- **Módulo:** `backend/`
- **Critério de conclusão:** Falhas tratadas globalmente retornando payloads de erro consistentes.
- **Dependências:** REQ-ARC-001.
- [x] Implementar
- [x] Validar
- [ ] Documentar

#### REQ-ARC-007 — Padronização de Respostas e Tratamento de Exceções
- **Fonte:** Projeto Integrador Origem — *Regras esperadas* (L882, L883) e *Contratos da API* (`contratos-api.md`)
- **Exigência Original:** Respostas padronizadas da API: coleções em `{ dados: [...], meta: {...} }` e erros de negócio em `{ erro: "mensagem" }` via classe customizada `AppError`.
- **Classificação Normativa:** **Recomendação Arquitetural**.
- **Estado atual:** **Atendido**
- **Evidência:** Classe `AppError` em `backend/src/utils/AppError.ts` e middleware `errorHandler.ts` formatando retornos no envelope `{ "erro": string }`, validado em testes de rotas inexistentes (404) e 100% compatível com a linha 23 de `frontend/src/services/api.ts`.
- **Ação necessária:** Utilizar `AppError` para todas as validações de regra de negócio dos services futuros.
- **Módulo:** `backend/`
- **Critério de conclusão:** 100% dos retornos da API aderentes ao contrato consumido pelos services do frontend.
- **Dependências:** REQ-ARC-001.
- [x] Implementar
- [x] Validar
- [x] Documentar

---

### 3.3 Banco de Dados, Modelagem e Persistência

#### REQ-DAT-001 — Persistência Real de Negócio e Eliminação de Mocks
- **Fonte:** Projeto Integrador Origem — *Banco de dados e persistência* (L983-L989) e *Relação AV1 e AV2* (L1030)
- **Exigência Original:** "Na versão final, os dados principais da aplicação devem ser persistidos em banco de dados. A equipe deverá garantir que os dados do sistema não dependam de arrays locais, arquivos mockados ou informações temporárias" (L985-L988).
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.  
  *Esclarecimento de Governança:* É plenamente legítimo e esperado que o frontend mantenha **estado local transitório de interface** (filtros ativos na tela, busca digitada, formulário em edição, carrinho não autenticado pré-checkout ou mensagens temporárias). O que a norma proíbe taxativamente é usar `localStorage` ou arrays estáticos para simular persistência definitiva de dados de negócio (catálogo público, usuários cadastrados, pedidos fechados, saldo de estoque).
- **Estado atual:** Não atendido
- **Evidência:** Dados de negócio ainda dependem de `localStorage` (`authService.ts`, `orderService.ts`, `cartService.ts`).
- **Ação necessária:** Persistir entidades de negócio no PostgreSQL via backend.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Dados de negócio mantidos após reinicialização do backend e recarga do navegador em modo anônimo.
- **Dependências:** REQ-STK-004, REQ-STK-005.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-002 — Migrations Versionadas
- **Fonte:** Projeto Integrador Origem — *Checklist AV2* (L422) e Backlog Priorizado — *DoD* (L819)
- **Exigência Original:** Todo o esquema relacional do banco de dados deve ser gerenciado através de migrações SQL versionadas e reversíveis via Prisma Migrate.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência da pasta `prisma/migrations` na branch.
- **Ação necessária:** Executar migrações iniciais via Prisma Migrate versionando o histórico.
- **Módulo:** `backend/`
- **Critério de conclusão:** Banco recriável a partir de comandos automatizados de migração em ambiente limpo.
- **Dependências:** REQ-STK-004.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-003 — Modelagem da Entidade `Usuario` e Papéis de Acesso
- **Fonte:** Backlog Priorizado — HU-01 (L112) e Tarefa T-CAD-01
- **Exigência Original:** Tabela `usuarios` com identificador UUID, nome, e-mail único, hash de senha seguro, CPF/CNPJ único, telefone WhatsApp, papel (`role`: `COMPRADOR`, `ARTESAO`, `CURADOR`, `ADMIN`) e data de criação.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Entidade inexistente no banco desta branch.
- **Ação necessária:** Declarar modelo `Usuario` no `schema.prisma` com índices de unicidade em email e cpf_cnpj.
- **Módulo:** `backend/`
- **Critério de conclusão:** Tabela criada no PostgreSQL impedindo duplicidade civil e cadastral.
- **História de Usuário:** HU-01.
- **Dependências:** REQ-DAT-002.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-004 — Modelagem de `Atelie` e `Endereco` Físico de Origem
- **Fonte:** Backlog Priorizado — HU-04 (L195) e Tarefa T-ATE-01
- **Exigência Original:** Tabela `atelies` vinculada ao artesão titular com relação 1:1 estrita com `enderecos`, garantindo o CEP físico de expedição para cálculo de frete.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de modelos de ateliê e endereço no banco.
- **Ação necessária:** Declarar modelos `Atelie` e `Endereco` no `schema.prisma` com relação 1:1.
- **Módulo:** `backend/`
- **Critério de conclusão:** Registro atômico de ateliê e endereço de expedição com validação de CEP.
- **História de Usuário:** HU-04.
- **Dependências:** REQ-DAT-003.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-005 — Modelagem de Curadoria Delegada (`AtelieCurador`)
- **Fonte:** Backlog Priorizado — HU-03 (L155) e Tarefa T-ART-01
- **Exigência Original:** Tabela associativa `atelies_curadores` vinculando um usuário com papel `CURADOR` a um `Atelie`, permitindo administração operacional com isolamento de dados bancários.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de entidade de curadores na branch.
- **Ação necessária:** Declarar modelo `AtelieCurador` com chaves estrangeiras compostas.
- **Módulo:** `backend/`
- **Critério de conclusão:** Curador vinculado operacionalmente ao ateliê com isolamento de chave Pix.
- **História de Usuário:** HU-03.
- **Dependências:** REQ-DAT-004.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-006 — Modelagem de Peças com Cubagem Obrigatória e Fragilidade (Invariante 2)
- **Fonte:** Backlog Priorizado — HU-05 (L234) e Tarefa T-PEC-01
- **Exigência Original:** Tabela `pecas` com restrição no banco garantindo `peso_gramas >= 50`, dimensões físicas positivas (`altura_cm > 0`, `largura_cm > 0`, `comprimento_cm > 0`), indicador booleano `is_fragil` para seguro de carga e status (`DISPONIVEL`, `RESERVADA`, `VENDIDA`, `ARQUIVADA`).
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Produtos no frontend não contemplam peso, dimensões nem flag `is_fragil`.
- **Ação necessária:** Declarar modelo `Peca` no `schema.prisma` com constraints de validação física.
- **Módulo:** `backend/`
- **Critério de conclusão:** Inserção rejeitada caso peso seja menor que 50g ou dimensões inválidas.
- **História de Usuário:** HU-05.
- **Dependências:** REQ-DAT-004.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-007 — Modelagem da Galeria de Fotos da Peça (`FotoPeca`)
- **Fonte:** Backlog Priorizado — HU-05 (L234) e Tarefa T-PEC-01
- **Exigência Original:** Tabela associativa `fotos_peca` vinculada à peça, com URL da imagem, texto alternativo acessível e ordem de exibição na galeria (capa e detalhes).
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Produtos possuem apenas uma string `imageUrl` única no frontend.
- **Ação necessária:** Declarar modelo `FotoPeca` com relação 1:N com `Peca`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Peça persistida com suporte a múltiplas fotos em ordem definida.
- **História de Usuário:** HU-05.
- **Dependências:** REQ-DAT-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-008 — Modelagem de Controle de Lotes e Estoque
- **Fonte:** Backlog Priorizado — HU-06 (L275) e Tarefa T-LOT-01
- **Exigência Original:** Campo `quantidade_estoque` na tabela `pecas` com restrição `CHECK (quantidade_estoque >= 0)`, impedindo saldo negativo a nível de banco de dados.
- **Classificação Normativa:** **Melhoria do Backlog (Should Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Controle de estoque ocorre apenas no estado React (`CartContext.tsx`).
- **Ação necessária:** Adicionar constraint de não-negatividade na coluna de estoque do modelo `Peca`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Tentativa de débito além do saldo disponível rejeitada por constraint do banco.
- **História de Usuário:** HU-06.
- **Dependências:** REQ-DAT-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-009 — Modelagem de Reservas Temporárias (Invariante 1)
- **Fonte:** Backlog Priorizado — HU-09 (L397) e Tarefa T-RES-01
- **Exigência Original:** Tabela `reservas` registrando `peca_id`, `usuario_id`, `expiracao_em` (TTL 15 min), `status` (`ATIVA`, `EXPIRADA`, `CONVERTIDA`) e índice de unicidade garantindo que uma peça única possua no máximo uma reserva ativa simultânea.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de tabela e ciclo de vida de reservas na branch.
- **Ação necessária:** Modelar tabela `reservas` com lock pessimista na criação e índices para expiração.
- **Módulo:** `backend/`
- **Critério de conclusão:** Conflito de reserva concorrente tratado com HTTP 409 sem duplicação de reserva.
- **História de Usuário:** HU-09.
- **Dependências:** REQ-DAT-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-010 — Modelagem de Pedidos Consolidados e Subpedidos Multi-Origem
- **Fonte:** Backlog Priorizado — HU-10 (L438) e HU-12 (L516)
- **Exigência Original:** Tabela `pedidos` (consolidado, total, comprador, status pagamento, `idempotency_key`) e tabela `subpedidos` (fracionado por ateliê, status logístico, prazo SLA, frete do polo e código de rastreamento) com itens congelando preços históricos.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Pedidos salvos como array estático no `localStorage` sem subpedidos.
- **Ação necessária:** Modelar entidades `Pedido`, `Subpedido` e `ItemSubpedido` no Prisma.
- **Módulo:** `backend/`
- **Critério de conclusão:** Pedido consolidado desmembrado automaticamente em subpedidos por ateliê com snapshot de preços.
- **História de Usuário:** HU-10, HU-12.
- **Dependências:** REQ-DAT-004, REQ-DAT-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-011 — Modelagem de Repasses Financeiros e Custódia D+7
- **Fonte:** Backlog Priorizado — HU-14 (L603) e Tarefa T-CUS-01
- **Exigência Original:** Tabela `repasses_pix` vinculada ao subpedido com valor líquido do artesão, taxa da plataforma, status (`RETIDO_EM_CUSTODIA`, `LIQUIDADO_PIX`, `CONGELADO_POR_DISPUTA`), snapshot imutável da Chave Pix e data prevista de liberação.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de entidades financeiras nesta branch.
- **Ação necessária:** Modelar tabela `repasses_pix` com relacionamentos e constraints no Prisma.
- **Módulo:** `backend/`
- **Critério de conclusão:** Repasse gerado com cálculo exato de comissão e retenção D+7 pós-entrega.
- **História de Usuário:** HU-14.
- **Dependências:** REQ-DAT-010.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-012 — Modelagem de Disputas, Avarias e Arrependimento Legal
- **Fonte:** Backlog Priorizado — HU-15 (L644) e HU-16 (L685)
- **Exigência Original:** Tabela `disputas` registrando tipo (`AVARIA_48H`, `ARREPENDIMENTO_7D`), status (`ABERTA`, `DEFERIDA`, `INDEFERIDA`), evidências fotográficas, código de logística reversa e parecer arbitral administrativo.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de gestão de disputas no banco.
- **Ação necessária:** Declarar modelo `Disputa` vinculado ao `Subpedido` no Prisma.
- **Módulo:** `backend/`
- **Critério de conclusão:** Abertura de disputa aciona congelamento do repasse financeiro do artesão.
- **História de Usuário:** HU-15, HU-16.
- **Dependências:** REQ-DAT-011.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-013 — Modelagem do Livro de Endereços do Comprador
- **Fonte:** Backlog Priorizado — HU-11 (L477) e Tarefa T-END-01
- **Exigência Original:** Relação 1:N entre `Usuario` e `Endereco`, com limite máximo de 5 endereços salvos e preservação imutável dos dados históricos em pedidos já concluídos.
- **Classificação Normativa:** **Melhoria do Backlog (Should Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Endereço do comprador é volátil e digitado a cada checkout.
- **Ação necessária:** Modelar relacionamento de múltiplos endereços de entrega por usuário.
- **Módulo:** `backend/`
- **Critério de conclusão:** Comprador salva endereços e seleciona no checkout sem redigitação.
- **História de Usuário:** HU-11.
- **Dependências:** REQ-DAT-003.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DAT-014 — Povoamento com Dados Reais de Pernambuco
- **Fonte:** Projeto Integrador Origem — *Estrutura recomendada* (L803) e *Evidências* (L463)
- **Exigência Original:** O documento do PI exige obrigatoriamente: "Evidência de banco de dados: Demonstrar persistência real dos dados" (L463). Na estrutura recomendada (L803), inclui `seed.ts`.
- **Classificação Normativa:** A presença e persistência de dados reais no banco é **Exigência da Disciplina (Obrigatório)**; a implementação específica via script `seed.ts` é **Decisão Técnica Proposta / Tarefa Derivada** para viabilizar a carga reprodutível de polos, técnicas e mestres de referência.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de script de seed no repositório desta branch.
- **Ação necessária:** Criar `backend/src/database/seed.ts` configurando comando `npx prisma db seed`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Banco populado automaticamente com catálogo cultural para testes e avaliação.
- **Dependências:** REQ-DAT-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

---

### 3.4 Autenticação, Autorização e Segurança

#### REQ-SEC-001 — Autenticação Baseada em Tokens JWT
- **Fonte:** Projeto Integrador Origem — *Backend esperado* (L333) e *Checklist AV2* (L424)
- **Exigência Original:** Fluxo completo de autenticação funcional com emissão de token JWT e rotas protegidas.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** Autenticação atual baseia-se em objeto plano no `localStorage`.
- **Ação necessária:** Implementar rotas `POST /api/v1/auth/login` e `POST /api/v1/auth/register` emitindo JWT.
- **Módulo:** `backend/`
- **Critério de conclusão:** Usuário autenticado recebe token JWT válido que é validado nas requisições subsequentes.
- **História de Usuário:** HU-01.
- **Dependências:** REQ-DAT-003.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-SEC-002 — Hash Seguro de Senhas
- **Fonte:** Backlog Priorizado — HU-01 (L113) e Tarefa T-CAD-02
- **Exigência Original:** Armazenamento de senhas no banco protegido obrigatoriamente por algoritmo com salting (Bcrypt ou Argon2id). Senhas em texto puro estritamente proibidas.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Senhas salvas em texto puro no `localStorage` (`authService.ts`).
- **Ação necessária:** Aplicar hash criptográfico no service de autenticação antes de persistir no banco.
- **Módulo:** `backend/`
- **Critério de conclusão:** Senha inacessível no banco e validação comparativa segura no login.
- **História de Usuário:** HU-01.
- **Dependências:** REQ-DAT-003.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-SEC-003 — Controle de Acesso Baseado em Papéis (RBAC)
- **Fonte:** Projeto Integrador Origem — *Autenticação e perfis* (L341-L359) e *Checklist AV2* (L425)
- **Exigência Original:** Sistema com papéis de acesso (`COMPRADOR`, `ARTESAO`, `ADMIN`) respeitando as permissões de cada perfil.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** Rotas protegidas no frontend são checadas apenas por `if (user.role !== 'admin')` na renderização.
- **Ação necessária:** Criar middleware `role.middleware.ts` para proteção no nível da API.
- **Módulo:** `backend/`
- **Critério de conclusão:** Requisições a endpoints restritos sem o papel correspondente rejeitadas com HTTP 403.
- **História de Usuário:** HU-01, HU-03, HU-18.
- **Dependências:** REQ-SEC-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-SEC-004 — Blindagem Financeira de Curador contra Dados Bancários (Invariante 5.5)
- **Fonte:** Backlog Priorizado — HU-03 (L140-L145, L157) e Tarefa T-ART-03
- **Exigência Original:** Usuários com papel exclusivo de `CURADOR` devem ser bloqueados de visualizar ou atualizar a Chave Pix do ateliê com HTTP 403 Forbidden e gravação de log de auditoria.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Papel "CURADOR" inexistente no código atual.
- **Ação necessária:** Middleware e service bloqueando rotas financeiras do ateliê para curadores operacionais.
- **Módulo:** `backend/`
- **Critério de conclusão:** Tentativa de alteração de Chave Pix por Curador rejeitada com HTTP 403 e log gerado.
- **História de Usuário:** HU-03.
- **Dependências:** REQ-SEC-003, REQ-DAT-005.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-SEC-005 — Proteção Contra Força Bruta no Login (RNF-04)
- **Fonte:** Backlog Priorizado — HU-01 (L104-L108) e Relatório de Testes — TC01 (L76-L82)
- **Exigência Original:** Bloqueio de novas tentativas de login por 15 minutos com HTTP 429 Too Many Requests após 5 erros consecutivos de senha para a mesma conta.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC01 reprovado historicamente; código atual não possui contador de tentativas.
- **Ação necessária:** Implementar controle de tentativas por e-mail no service de autenticação.
- **Módulo:** `backend/`
- **Critério de conclusão:** Sexta tentativa incorreta bloqueada com HTTP 429 e desbloqueio aos 15 minutos.
- **História de Usuário:** HU-01.
- **Dependências:** REQ-SEC-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-SEC-006 — Recuperação Segura de Senha
- **Fonte:** Backlog Priorizado — HU-02 (L705-L722) e Relatório de Testes — TC16 (L168-L173)
- **Exigência Original:** Rota de solicitação de recuperação de senha gerando token descartável com validade de 30 minutos enviado por e-mail, com proteção contra enumeração de contas (HTTP 200 genérico).
- **Classificação Normativa:** **Melhoria do Backlog (Should Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC16 bloqueado historicamente; funcionalidade inexistente no frontend e backend.
- **Ação necessária:** Implementar rotas `POST /api/v1/auth/esqueci-senha` e `POST /api/v1/auth/redefinir-senha`.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Redefinição bem-sucedida invalida sessões ativas e token anterior.
- **História de Usuário:** HU-02.
- **Dependências:** REQ-SEC-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-SEC-007 — Validação Estrita de Schemas de Entrada (Zod)
- **Fonte:** Projeto Integrador Origem — *Responsabilidade das principais pastas* (L860) e Backlog Priorizado (L72)
- **Exigência Original:** O documento prevê a pasta `validators/` para schemas de validação.
- **Classificação Normativa:** **Decisão Técnica Proposta / Tarefa Derivada** (o PI exige que dados sejam validados; a adoção da biblioteca Zod é a escolha técnica recomendada).
- **Estado atual:** Não atendido
- **Evidência:** Ausência de schemas Zod de backend nesta branch.
- **Ação necessária:** Implementar schemas de validação para produtos, ateliês, pedidos e auth em `backend/src/validators/`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Requisições com dados faltantes ou inválidos rejeitadas automaticamente com HTTP 400 e mensagens em português.
- **Dependências:** REQ-ARC-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

---

### 3.5 Funcionalidades Centrais e Regras de Negócio do Domínio

#### REQ-DOM-001 — Cadastro e Especialização de Usuários e Artesãos
- **Fonte:** Backlog Priorizado — HU-01 (L76) e HU-03 (L119)
- **Exigência Original:** Cadastro unificado de usuários com atribuição do papel `COMPRADOR`, permitindo especialização em `ARTESAO` mediante biografia cultural e Chave Pix válida no formato BACEN.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Parcialmente atendido (Inspeção estática)
- **Evidência:** Interface de cadastro existe em `Login.tsx`, mas salva em `localStorage` e não solicita Chave Pix.
- **Ação necessária:** Conectar `Login.tsx` à API real e incluir campo de Chave Pix para artesãos.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Artesão cadastrado com perfil público e Chave Pix persistidos no PostgreSQL.
- **História de Usuário:** HU-01, HU-03.
- **Dependências:** REQ-SEC-001, REQ-DAT-003.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-002 — Parametrização do Ateliê e Endereço de Origem
- **Fonte:** Backlog Priorizado — HU-04 (L162-L198) e Relatório de Testes — TC03
- **Exigência Original:** Cadastro de nome comercial, polo cultural pernambucano e endereço físico de expedição com autopreenchimento por CEP em menos de 1 segundo e restrição de unicidade (1 ateliê ativo por artesão).
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC03 bloqueado historicamente; inexiste formulário de ateliê para o artesão na branch.
- **Ação necessária:** Criar rota `POST /api/v1/atelies` e formulário de parametrização no `ArtisanPanel.tsx`.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Ateliê e endereço de expedição cadastrados atomicamente em transação única.
- **História de Usuário:** HU-04.
- **Dependências:** REQ-DAT-004.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-003 — Catalogação de Peças com Cubagem Obrigatória (Invariante 2)
- **Fonte:** Backlog Priorizado — HU-05 (L201-L238) e Relatório de Testes — TC04
- **Exigência Original:** Publicação de peças exigindo obrigatoriamente: título, técnica, preço, peso embalado ($\ge 50$g), dimensões positivas (altura, largura, profundidade), indicador `is_fragil` e fotos. Rejeitar peso < 50g com HTTP 422.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Divergente
- **Evidência:** TC04 reprovado historicamente. Modal de cadastro em `ArtisanPanel.tsx` aceita peças sem peso nem medidas.
- **Ação necessária:** Adicionar campos de cubagem no frontend (`ArtisanPanel.tsx`) e validação estrita no backend (`POST /api/v1/produtos`).
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Peça cadastrada com peso $\ge 50$g assume status `DISPONIVEL`; peso < 50g retorna HTTP 422.
- **História de Usuário:** HU-05.
- **Dependências:** REQ-DAT-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-004 — Gestão de Lotes Limitados e Prevenção de Overselling
- **Fonte:** Backlog Priorizado — HU-06 (L241-L278)
- **Exigência Original:** Cadastro de peças em lote com estoque múltiplo ($> 1$), decremento atômico no checkout e prevenção absoluta de saldo negativo em compras concorrentes (HTTP 409 em caso de esgotamento).
- **Classificação Normativa:** **Melhoria do Backlog (Should Have)**.
- **Estado atual:** Parcialmente atendido (Inspeção estática)
- **Evidência:** Frontend aceita estoque múltiplo, mas baixa concorrente transacional no banco inexiste.
- **Ação necessária:** Implementar transação com lock pessimista na baixa de estoque em lote.
- **Módulo:** `backend/`
- **Critério de conclusão:** 100% das vendas confirmadas cobertas por estoque, sem overselling.
- **História de Usuário:** HU-06.
- **Dependências:** REQ-DAT-008.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-005 — Vitrine Cultural com Busca e Filtros Combinados
- **Fonte:** Backlog Priorizado — HU-07 (L281-L305) e Projeto Integrador (L293)
- **Exigência Original:** Vitrine pública consumindo produtos do backend com filtragem combinada por polo cultural e técnica artesanal e busca textual por termos culturais.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Parcialmente atendido (Inspeção estática)
- **Evidência:** Frontend filtra em memória sobre lista estática pré-carregada.
- **Ação necessária:** Conectar `FeaturedShowcase.tsx` e `ProductFilterContext.tsx` aos parâmetros de query da API (`/produtos?hub=...&technique=...&q=...`).
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Resultados filtrados pelo banco retornados em tempo inferior a 400ms.
- **História de Usuário:** HU-07.
- **Dependências:** REQ-DAT-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-006 — Simulação de Frete na Página do Produto
- **Fonte:** Backlog Priorizado — HU-07 (L306-L311) e Tarefa T-VIT-03
- **Exigência Original:** Campo de entrada de CEP na página de detalhes do produto (`ProductDetail.tsx`) calculando prazo e frete com base no CEP de saída do ateliê e na cubagem da peça.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Página de produto possui apenas texto estático sem input de CEP.
- **Ação necessária:** Criar rota de cotação de frete `POST /api/v1/frete/simular` e componente de cálculo no frontend.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Comprador informa CEP e recebe valor e prazo estimado de entrega em menos de 1.800ms.
- **História de Usuário:** HU-07.
- **Dependências:** REQ-DOM-002, REQ-DOM-003. Decisão Pendente 04.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-007 — Portfólio Dedicado e Storytelling do Mestre Artesão
- **Fonte:** Backlog Priorizado — HU-08 (L322-L358) e Relatório de Testes — TC07
- **Exigência Original:** Página do mestre (`/artesaos/:id`) exibindo biografia cultural, polo de procedência, foto e galeria isolada exclusiva de suas obras ativas para venda.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Parcialmente atendido (Inspeção estática)
- **Evidência:** TC07 aprovado para interface; código estático em `ArtisanProfile.tsx` filtra em memória, mas não foi verificado com o backend real.
- **Ação necessária:** Conectar rota `/artesaos/:id` à API `GET /api/v1/artesaos/:id/portfolio`.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Catálogo do mestre exibido com isolamento estrito sem fuga de peças de outros autores.
- **História de Usuário:** HU-08.
- **Dependências:** REQ-DAT-004, REQ-DAT-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-008 — Reserva Concorrente de Peça Única por 15 Minutos (Invariante 1)
- **Fonte:** Backlog Priorizado — HU-09 (L361-L400) e Relatório de Testes — TC08 e TC-STRESS-01
- **Exigência Original:** Ao avançar para pagamento de peça única (`estoque = 1`), a peça é reservada atomicamente no banco por 15 minutos com lock pessimista (`SELECT ... FOR UPDATE`). Outros compradores recebem HTTP 409 Conflict.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC08 bloqueado e TC-STRESS-01 reprovado historicamente. Ausência de endpoint e modelo de reserva.
- **Ação necessária:** Implementar endpoint `POST /api/v1/estoque/reservas` com lock pessimista e expiração TTL 15 min.
- **Módulo:** `backend/`
- **Critério de conclusão:** Em concorrência simultânea de 50 requisições, exatamente 1 obtém reserva (201) e 49 recebem 409 sem overselling.
- **História de Usuário:** HU-09.
- **Dependências:** REQ-DAT-009.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-009 — Agrupamento Visual de Carrinho Multi-Origem
- **Fonte:** Backlog Priorizado — HU-09 (L375-L380) e Tarefa T-RES-04
- **Exigência Original:** Carrinho de compras agrupando os itens em blocos visuais separados por ateliê de origem, com fretes individualizados por ateliê e total consolidado da compra.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Divergente
- **Evidência:** `Cart.tsx` exibe lista plana contínua com frete único consolidado (flat R$ 24,90).
- **Ação necessária:** Ajustar visualização do carrinho para agrupar por ateliê mantendo o design system existente.
- **Módulo:** `frontend/`
- **Critério de conclusão:** Itens de diferentes ateliês exibidos em seções distintas com subtotais e fretes por origem.
- **História de Usuário:** HU-09.
- **Dependências:** REQ-DOM-002.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-010 — Checkout Unificado com Pagamento Pix e Cartão
- **Fonte:** Backlog Priorizado — HU-10 (L404-L442)
- **Exigência Original:** Pagamento consolidado de todas as origens em transação única. Em caso de Pix, gerar QR Code dinâmico com tempo de expiração casado ao tempo restante da reserva de 15 minutos e código Copia-e-Cola.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Checkout atual não gera QR Code Pix nem código Copia-e-Cola real.
- **Ação necessária:** Criar rota `POST /api/v1/pedidos/checkout` e renderizar modal de Pix dinâmico no frontend.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** QR Code Pix exibido com cronômetro regressivo e código Copia-e-Cola funcional.
- **História de Usuário:** HU-10.
- **Dependências:** REQ-DOM-008, REQ-DAT-010. Decisão Pendente 04.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-011 — Webhook de Pagamento com Deduplicação e Idempotência (RNF-06)
- **Fonte:** Backlog Priorizado — HU-10 (L424-L429) e Relatório de Testes — TC09
- **Exigência Original:** Endpoint de recepção de webhooks de pagamento com chave de idempotência (`Idempotency-Key`), garantindo que disparos duplicados não gerem múltiplos subpedidos nem cobranças repetidas.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC09 bloqueado historicamente; rota de webhook inexistente.
- **Ação necessária:** Implementar `POST /api/v1/pagamentos/webhook` com tabela de idempotência e transição de status para `APROVADO`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Webhook repetido responde HTTP 200 de sucesso sem duplicar eventos de negócio.
- **História de Usuário:** HU-10.
- **Dependências:** REQ-DAT-010.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-012 — Livro de Endereços do Comprador (Address Book)
- **Fonte:** Backlog Priorizado — HU-11 (L445-L480) e Relatório de Testes — TC10
- **Exigência Original:** Gerenciamento de múltiplos endereços de entrega na conta do comprador (máximo de 5) com recálculo automático de frete ao alternar o endereço selecionado no checkout.
- **Classificação Normativa:** **Melhoria do Backlog (Should Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC10 bloqueado historicamente; tela `/conta` só edita nome.
- **Ação necessária:** Criar seção de endereços em `Account.tsx` e cards seletores em `Checkout.tsx`.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Endereço alternado no checkout recalcula fretes de todos os ateliês antes do pagamento.
- **História de Usuário:** HU-11.
- **Dependências:** REQ-DAT-013.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-013 — Desmembramento Automático em Subpedidos por Ateliê
- **Fonte:** Backlog Priorizado — HU-12 (L483-L520) e Relatório de Testes — TC05
- **Exigência Original:** Ao aprovar o pagamento de um pedido consolidado, o sistema deve desmembrar automaticamente em $N$ subpedidos independentes por ateliê produtor, congelando preços históricos pagos.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** O código atual desta branch salva apenas um registro único no `localStorage`.
- **Ação necessária:** Implementar lógica de desmembramento no service de pedidos disparada pelo evento de pagamento aprovado.
- **Módulo:** `backend/`
- **Critério de conclusão:** Pedido com peças de 3 ateliês gera exatamente 3 subpedidos com seus itens e fretes respectivos.
- **História de Usuário:** HU-12.
- **Dependências:** REQ-DOM-011, REQ-DAT-010.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-014 — Emissão de Etiquetas com Seguro e Guia de Embalagem para Cerâmica
- **Fonte:** Backlog Priorizado — HU-12 (L508-L512) e Relatório de Testes — TC11
- **Exigência Original:** Liberação de etiqueta de envio com seguro rodoviário pelo ateliê. Para peças com `is_fragil = true`, exibição obrigatória do modal "Guia de Embalagem Segura para Peças Frágeis" antes de liberar o PDF da etiqueta (trava HTTP 428).
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC11 bloqueado historicamente. Ausência de emissão de etiquetas no painel do artesão.
- **Ação necessária:** Criar endpoint `POST /api/v1/subpedidos/:id/etiqueta` com trava de leitura do guia e modal correspondente em `ArtisanPanel.tsx`.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Download da etiqueta de peça frágil bloqueado até confirmação explícita de leitura do guia.
- **História de Usuário:** HU-12.
- **Dependências:** REQ-DOM-013.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-015 — Rastreamento, SLA de 7 Dias Úteis e Cancelamento por Atraso
- **Fonte:** Backlog Priorizado — HU-13 (L523-L561) e Relatório de Testes — TC12
- **Exigência Original:** Ateliê registra código de rastreamento dentro do prazo de 7 dias úteis (status `POSTADO`). Esgotado o prazo sem envio, o comprador ganha o botão "Cancelar por Atraso" com estorno integral de 100%.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC12 bloqueado historicamente; sem status logísticos ou cancelamento no frontend.
- **Ação necessária:** Implementar rotas de registro de rastreio e cancelamento por atraso com cálculo de dias úteis.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Cancelamento por atraso habilitado exclusivamente após o 7º dia útil sem postagem.
- **História de Usuário:** HU-13.
- **Dependências:** REQ-DOM-013.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-016 — Custódia Pós-Entrega (D + 7) e Liquidação Automatizada via Pix
- **Fonte:** Backlog Priorizado — HU-14 (L564-L607) e Relatório de Testes — TC13
- **Exigência Original:** Retenção do valor líquido do artesão em custódia preventiva por 7 dias corridos após confirmação de entrega física. Vencido o prazo sem disputa, liquidação automática via Pix.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de regras e jobs financeiros nesta branch.
- **Ação necessária:** Implementar rotina de custódia e extrato financeiro no `ArtisanPanel.tsx`.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Repasse liquidado automaticamente via Pix no 8º dia pós-entrega na ausência de disputa aberta.
- **História de Usuário:** HU-14.
- **Dependências:** REQ-DAT-011.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-017 — Registro de Avaria em até 48h e Arbitragem de Sinistro
- **Fonte:** Backlog Priorizado — HU-15 (L610-L649) e Relatório de Testes — TC14
- **Exigência Original:** Comprador pode registrar sinistro de peça danificada anexando fotos em até 48 horas da entrega, congelando o repasse Pix correspondente no mesmo instante para arbitragem no painel administrativo.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de formulário de sinistro e tela de arbitragem.
- **Ação necessária:** Criar formulário de sinistro em `Account.tsx` e tela de avaliação arbitral em `AdminPanel.tsx`.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Submissão de fotos de avaria congela repasse Pix e abre disputa administrativa.
- **História de Usuário:** HU-15.
- **Dependências:** REQ-DAT-012, REQ-DOM-016.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-018 — Exercício do Direito de Arrependimento em 7 Dias (CDC Art. 49)
- **Fonte:** Backlog Priorizado — HU-16 (L651-L689) e Relatório de Testes — TC15
- **Exigência Original:** Botão de desistência imotivada em até 7 dias corridos pós-entrega, gerando código de postagem reversa gratuito, congelando o repasse e estornando o comprador após devolução.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Inexistência de fluxo de devolução legal no frontend.
- **Ação necessária:** Criar botão "Devolver por Desistência" com validação de 7 dias e emissão de código reverso.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Solicitação tempestiva congela repasse e fornece código reverso com botão de cópia.
- **História de Usuário:** HU-16.
- **Dependências:** REQ-DAT-012, REQ-DOM-016.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOM-019 — Painel Administrativo de Moderação, Auditoria e Fundo de Sinistros
- **Fonte:** Backlog Priorizado — HU-18 (L772-L809) e Relatório de Testes — TC18
- **Exigência Original:** Painel restrito a `ADMIN` para suspensão curatorial de peças irregulares (ocultando da vitrine), suspensão de ateliês infratores e auditoria financeira consolidada de taxas, custódias retidas e sinistros.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Parcialmente atendido (Inspeção estática)
- **Evidência:** TC18 aprovado para catálogo; falta conectar à API real e exibir métricas contábeis de custódia e sinistros.
- **Ação necessária:** Conectar `AdminPanel.tsx` à API administrativa com indicadores contábeis agregados.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Administrador suspende peças irregulares e visualiza saldos de custódia e comissões da plataforma.
- **História de Usuário:** HU-18.
- **Dependências:** REQ-SEC-003, REQ-DAT-011.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

---

### 3.6 Processamento Assíncrono, Filas e Tarefas Agendadas

#### REQ-ASY-001 — Desacoplamento da Resposta HTTP para Tarefas Pesadas
- **Fonte:** Projeto Integrador Origem — *Processamento assíncrono e cache* (L384-L394) e *Checklist AV2* (L427)
- **Exigência Original:** Endpoints que disparam notificações ou processos pesados não devem reter a resposta ao usuário; o retorno 200/201 deve ser liberado imediatamente.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de processamento assíncrono nesta branch.
- **Ação necessária:** Implementar despachante assíncrono para eventos pós-checkout.
- **Módulo:** `backend/`
- **Critério de conclusão:** Tempo de resposta do checkout inferior a 500ms independente do envio de notificações.
- **Dependências:** REQ-STK-007.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-ASY-002 — Rotina Agendada de Expiração de Reservas de 15 Minutos
- **Fonte:** Backlog Priorizado — HU-09 (L388-L393) e Tarefa T-RES-03
- **Exigência Original:** Processo em segundo plano executado periodicamente (a cada minuto) para cancelar reservas ativas cujo tempo de expiração ultrapassou 15 minutos, restaurando a peça para `DISPONIVEL`.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de job agendado de reservas.
- **Ação necessária:** Desenvolver worker de expiração de reservas em `backend/src/jobs/expireReservations.job.ts`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Peça reservada sem pagamento tem reserva expirada e retorna à vitrine automaticamente após 15 minutos.
- **História de Usuário:** HU-09.
- **Dependências:** REQ-DAT-009, REQ-STK-007.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-ASY-003 — Rotina Agendada de Fiscalização de SLA de Postagem
- **Fonte:** Backlog Priorizado — HU-13 (L543-L547, L559) e Tarefa T-SLA-03
- **Exigência Original:** Cron job diário que verifica subpedidos aguardando postagem e dispara alertas preventivos ao artesão no 3º e no 5º dia útil após a compra.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de rotina periódica de SLA na branch.
- **Ação necessária:** Desenvolver worker de SLA em `backend/src/jobs/checkPostageSla.job.ts`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Registro de alertas preventivos gerados automaticamente nos prazos úteis definidos.
- **História de Usuário:** HU-13.
- **Dependências:** REQ-DAT-010, REQ-STK-007.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-ASY-004 — Rotina Agendada de Liquidação de Custódia D+7
- **Fonte:** Backlog Priorizado — HU-14 (L589-L594, L605) e Tarefa T-CUS-03
- **Exigência Original:** Processo diário que audita repasses com status `RETIDO_EM_CUSTODIA` cuja data prevista venceu (data da entrega + 7 dias corridos) e executa a liquidação via Pix na ausência de disputa aberta.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de rotina de liquidação na branch.
- **Ação necessária:** Desenvolver worker financeiro em `backend/src/jobs/settleCustody.job.ts`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Repasses com prazo cumprido transitam para `LIQUIDADO_PIX` com registro do código BACEN.
- **História de Usuário:** HU-14.
- **Dependências:** REQ-DAT-011, REQ-STK-007.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-ASY-005 — Hub de Notificações Transacionais Multicanal
- **Fonte:** Backlog Priorizado — HU-17 (L732-L769) e Relatório de Testes — TC17
- **Exigência Original:** Fila assíncrona tolerante a falhas com retentativas e backoff exponencial para envio de comprovantes de pagamento e alertas de envio por e-mail sem degradar o loop de eventos síncrono.
- **Classificação Normativa:** **Melhoria do Backlog (Should Have)**.
- **Estado atual:** Não atendido
- **Evidência:** TC17 reprovado historicamente por travar o loop de eventos; ausência de mensageria na branch.
- **Ação necessária:** Implementar fila assíncrona desacoplada em `backend/src/queues/notification.queue.ts`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Falhas transitórias no envio de e-mails são retentadas sem bloquear a API principal.
- **História de Usuário:** HU-17.
- **Dependências:** REQ-STK-007.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

---

### 3.7 Camada de Cache e Desempenho

#### REQ-CCH-001 — Cache em Ponto Crítico da Aplicação
- **Fonte:** Projeto Integrador Origem — *Processamento assíncrono e cache* (L395-L404) e *Checklist AV2* (L428)
- **Exigência Original:** Implementação de cache de dados com TTL configurado para o catálogo de produtos (`GET /api/v1/produtos`) ou detalhes de peça.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de interceptador de cache no backend.
- **Ação necessária:** Criar middleware ou service de cache em `backend/src/cache/catalog.cache.ts`.
- **Módulo:** `backend/`
- **Critério de conclusão:** Requisições repetidas ao catálogo retornadas sem consultar o PostgreSQL enquanto o cache estiver válido.
- **Dependências:** REQ-STK-006.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-CCH-002 — Invalidação de Cache em Mutações
- **Fonte:** Projeto Integrador Origem — *Qualidade técnica esperada* (L898)
- **Exigência Original:** Mecanismo de invalidação do cache quando ocorrer criação de produto, alteração de dados, pausa curatorial ou baixa de estoque.
- **Classificação Normativa:** **Recomendação Arquitetural**.
- **Estado atual:** Não atendido
- **Evidência:** Ausência de controle de invalidação na branch.
- **Ação necessária:** Disparar método `cache.invalidate()` nos services de produto e reserva após qualquer mutação.
- **Módulo:** `backend/`
- **Critério de conclusão:** Alteração de preço ou estoque de uma peça reflete imediatamente na requisição seguinte sem dados defasados.
- **Dependências:** REQ-CCH-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

---

### 3.8 Módulo de Inteligência Artificial e Recomendação

#### REQ-REC-001 — Módulo de Recomendação Integrado à Aplicação Web
- **Fonte:** Projeto Integrador Origem — *Recomendação integrada* (L362-L379) e *Checklist AV2* (L426)
- **Exigência Original:** O módulo de recomendação não pode ficar isolado em script externo ou demonstração avulsa; deve ser consumido diretamente pelo backend ou frontend da aplicação web via API integrada. O documento lista exemplos possíveis: produtos populares, por técnica, por região, semelhantes, etc. (L370-L378).
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** Microsserviço Python BentoML existe em `ia-recomendador/`, mas nenhuma chamada é feita pelo frontend ou backend.
- **Ação necessária:** Integrar o serviço de recomendação à aplicação através do backend Express.
- **Módulo:** `backend/`, `ia-recomendador/`
- **Critério de conclusão:** Endpoint da aplicação web retorna recomendações calculadas a partir de dados reais ou do catálogo ativo.
- **Dependências:** REQ-STK-003. Decisão Pendente 03.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-REC-002 — Algoritmo Vetorial e Co-ocorrência em Cestas (HU-24)
- **Fonte:** `ia-recomendador/README.md` (L20-L34) e Backlog Priorizado (HU-24)
- **Exigência Original:** Algoritmo ponderando técnica (peso 1,0), polo (0,8), categoria (0,4) e faixa de preço (0,3), mesclando $60\%$ de similaridade de cosseno com $40\%$ de co-ocorrência em compras conjuntas.
- **Classificação Normativa:** **Regra da Trilha de IA / Tarefa Derivada**.  
  *Esclarecimento:* A disciplina de Desenvolvimento Web exige que a recomendação esteja integrada (REQ-REC-001), aceitando qualquer uma das modalidades exemplificativas da L370. No entanto, para cumprir a especificação da disciplina parceira (ES & IA) e a HU-24 do backlog, adota-se esta regra específica.
- **Estado atual:** Atendido em Módulo Isolado
- **Evidência:** Algoritmo implementado em Python (`ia-recomendador/recomendador.py`) com 4 testes unitários passando em pytest, porém com dataset sintético desacoplado do PostgreSQL.
- **Ação necessária:** Conectar a lógica do algoritmo aos dados reais do marketplace.
- **Módulo:** `backend/` ou `ia-recomendador/`
- **Critério de conclusão:** Peças afins recomendadas com justificativa explicável (`mesma_tecnica`, `mesmo_polo`, `comprados_juntos`).
- **Dependências:** Decisão Pendente 03.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-REC-003 — Exibição de Peças Recomendadas no Frontend
- **Fonte:** Projeto Integrador Origem — *Recomendação integrada* (L368) e *Checklist AV2* (L426)
- **Exigência Original:** A tela de detalhes do produto (`ProductDetail.tsx`) deve consumir o endpoint de recomendação real em substituição ao filtro em memória por técnica.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Divergente
- **Evidência:** `ProductDetail.tsx` (L96-L98) filtra produtos relacionados através de um simples `.filter(item => item.technique === product.technique)` em memória.
- **Ação necessária:** Ajustar `ProductDetail.tsx` para consumir o service de recomendação via API assíncrona.
- **Módulo:** `frontend/`
- **Critério de conclusão:** Seção "Peças que combinam" renderizando as recomendações retornadas pelo algoritmo.
- **Dependências:** REQ-REC-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

---

### 3.9 Integração Frontend / Backend

#### REQ-INT-001 — Conexão dos Services à API Real
- **Fonte:** Projeto Integrador Origem — *Escopo mínimo* (L109), *Relação AV1 e AV2* (L1029) e `contratos-api.md`
- **Exigência Original:** Conectar integralmente os services do frontend (`catalogService`, `artisanService`, `orderService`, `authService`, `reviewService`) aos endpoints reais do backend Express.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Parcialmente atendido (Inspeção estática)
- **Evidência:** `catalogService` e `artisanService` já usam `fetch`, mas apontam para ambiente local inativo; os demais usam `localStorage`.
- **Ação necessária:** Substituir chamadas mockadas e `localStorage` por requisições HTTP REST padronizadas no frontend.
- **Módulo:** `frontend/`
- **Critério de conclusão:** Todas as telas carregando e persistindo dados via backend conectado ao PostgreSQL.
- **Dependências:** REQ-STK-003, REQ-DAT-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-INT-002 — Gestão de Sessão com JWT no Frontend
- **Fonte:** Projeto Integrador Origem — *Autenticação e perfis* (L341-L359) e *Backend esperado* (L333-L334)
- **Exigência Original:** O `AuthContext.tsx` deve armazenar o token JWT recebido no login e injetá-lo automaticamente no cabeçalho `Authorization: Bearer <token>` em todas as requisições autenticadas da camada de API.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** `AuthContext.tsx` armazena o objeto de usuário sem token em `localStorage`.
- **Ação necessária:** Atualizar `api.ts` e `AuthContext.tsx` para gerenciar tokens JWT com expiração e logout automático em caso de 401.
- **Módulo:** `frontend/`
- **Critério de conclusão:** Rotas protegidas acessíveis exclusivamente mediante envio de token JWT válido.
- **História de Usuário:** HU-01.
- **Dependências:** REQ-SEC-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-INT-003 — Atualização dos Formulários do Frontend para Novos Campos
- **Fonte:** Backlog Priorizado — HU-01, HU-03 e HU-05
- **Exigência Original:** Adicionar campos obrigatórios nos formulários existentes sem quebrar o design: CPF/CNPJ e telefone no cadastro (`Login.tsx`); Chave Pix no cadastro de artesão (`Login.tsx`); peso (g), dimensões e flag `is_fragil` no cadastro de peças (`ArtisanPanel.tsx`).
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Divergente
- **Evidência:** Formulários atuais omitem os dados fundamentais das regras de negócio.
- **Ação necessária:** Adicionar inputs com máscaras e validações nos componentes de formulário do frontend.
- **Módulo:** `frontend/`
- **Critério de conclusão:** Formulários enviando todos os campos requeridos pelos schemas de validação da API.
- **Dependências:** REQ-DOM-001, REQ-DOM-003.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-INT-004 — Exibição de Pix Dinâmico e Tempo Restante de Reserva
- **Fonte:** Backlog Priorizado — HU-10 (L418-L423) e Tarefa T-PAG-04
- **Exigência Original:** Interface do checkout e confirmação de pedido renderizando imagem do QR Code Pix, código Copia-e-Cola com botão de cópia rápida e cronômetro regressivo dos 15 minutos da reserva.
- **Classificação Normativa:** **Regra de Negócio do Backlog (Must Have)**.
- **Estado atual:** Não atendido
- **Evidência:** Confirmação de pedido apenas exibe o ID estático sem código Pix.
- **Ação necessária:** Criar modal/card de pagamento Pix dinâmico em `OrderConfirmation.tsx` e `Checkout.tsx`.
- **Módulo:** `frontend/`
- **Critério de conclusão:** Comprador visualiza QR Code Pix com contagem regressiva sincronizada à expiração da reserva.
- **História de Usuário:** HU-10.
- **Dependências:** REQ-DOM-010.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-INT-005 — Preservação de Estados Visuais e Tratamento de Respostas
- **Fonte:** Projeto Integrador Origem — *API e services* (L973-L980) e *Checklist AV1/AV2*
- **Exigência Original:** O frontend deve tratar adequadamente loading, erros, estados vazios e respostas inesperadas da API.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não verificado em integração
- **Evidência:** Os componentes `LoadingBlock`, `ErrorBlock` e `EmptyBlock` existem e foram validados com mocks na AV1, mas seu comportamento em conjunto com o backend real sob falhas de rede e timeouts ainda não foi testado em execução nesta branch.
- **Ação necessária:** Validar o disparo correto dos blocos visuais frente aos status HTTP reais retornados pela nova API.
- **Módulo:** `frontend/`
- **Critério de conclusão:** Nenhuma tela apresenta quebra de layout durante carregamento ou erros de conexão com a API real.
- **Dependências:** REQ-INT-001.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

---

### 3.10 Documentação, Qualidade, Testes e Deploy

#### REQ-DOC-001 — Documentação Completa da API
- **Fonte:** Projeto Integrador Origem — *Entregáveis* (L460) e *Qualidade técnica* (L1006)
- **Exigência Original:** "Documentação completa da API: Sim [Obrigatório]. Deve estar atualizada e coerente com o backend entregue. De preferência no Swagger, ou outra ferramenta semelhante" (L460). "A documentação da API poderá ser feita com Swagger, OpenAPI, Postman, Insomnia ou equivalente" (L1006).
- **Classificação Normativa:** A documentação completa e atualizada da API é **Exigência da Disciplina (Obrigatório)**; o uso do Swagger/OpenAPI especificamente é **Recomendação Arquitetural / Exemplo na Documentação** (a disciplina aceita formalmente alternativas como Postman ou Insomnia).
- **Estado atual:** Não atendido
- **Evidência:** Existe apenas o documento estático em Markdown `contratos-api.md`.
- **Ação necessária:** Configurar documentação da API integrada ao Express (preferencialmente Swagger UI em `/api/v1/docs`).
- **Módulo:** `backend/`
- **Critério de conclusão:** Documentação interativa ou coleção estruturada cobrindo 100% dos endpoints, parâmetros e códigos de resposta.
- **Dependências:** REQ-ARC-002.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOC-002 — README Geral do Projeto com Instruções de Execução Local
- **Fonte:** Projeto Integrador Origem — *Entregáveis* (L461) e *Modelo de README* (L1038-L1075)
- **Exigência Original:** README principal do repositório contendo sumário, apresentação do projeto, arquitetura full stack, instruções passo a passo para execução local do frontend e backend e mapeamento de rotas.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Parcialmente atendido (Inspeção estática)
- **Evidência:** README atual reflete predominantemente a fase anterior (AV1) e contém referências legadas ao Maven.
- **Ação necessária:** Atualizar `README.md` da raiz com as instruções completas da Avaliação 2.
- **Módulo:** Raiz do repositório
- **Critério de conclusão:** Desenvolvedor executa o projeto localmente do zero seguindo estritamente as instruções do README.
- **Dependências:** REQ-STK-001, REQ-STK-005.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOC-003 — Arquivo `.env.example` Completo e Sem Segredos
- **Fonte:** Projeto Integrador Origem — *Entregáveis* (L462) e *Checklist AV2* (L446)
- **Exigência Original:** Disponibilização de arquivos `.env.example` no frontend e no backend contendo todas as variáveis necessárias com valores de exemplo sem credenciais reais.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Parcialmente atendido (Inspeção estática)
- **Evidência:** Existe `frontend/.env.example`, mas inexiste `backend/.env.example`.
- **Ação necessária:** Criar `backend/.env.example` com todas as chaves comentadas e tipadas.
- **Módulo:** `backend/`
- **Critério de conclusão:** Arquivo versionado e testado em ambiente limpo sem falhas de inicialização.
- **Dependências:** REQ-STK-008.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOC-004 — Declaração Formal de Uso de IA (`docs/uso-de-ia.md`)
- **Fonte:** Projeto Integrador Origem — *Declaração de uso de IA* (L1078-L1355)
- **Exigência Original:** Criação e manutenção obrigatória do arquivo `docs/uso-de-ia.md` discriminando ferramentas de IA utilizadas, etapas apoiadas, limitações encontradas e validações humanas realizadas pela equipe.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** Arquivo `docs/uso-de-ia.md` inexistente no repositório desta branch.
- **Ação necessária:** Criar e preencher `docs/uso-de-ia.md` seguindo o modelo exigido pela disciplina.
- **Módulo:** `docs/`
- **Critério de conclusão:** Documento completo, preenchido e assinado pela equipe no repositório.
- **Dependências:** Nenhuma.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOC-005 — Suíte de Testes Automatizados no Core Domain ($\ge 85\%$ de Cobertura)
- **Fonte:** Backlog Priorizado — *Definition of Done* (L819) e Projeto Integrador — *Qualidade*
- **Exigência Original:** Testes automatizados unitários e de integração cobrindo regras críticas do domínio (reserva concorrente de 15 min, cálculo de cubagem $\ge 50$g, baixa atômica de estoque e blindagem de curador) com cobertura $\ge 85\%$.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)** / DoD do Backlog.
- **Estado atual:** Não atendido
- **Evidência:** Frontend não tem suíte de testes automatizados; backend ainda não existe na branch.
- **Ação necessária:** Configurar Jest/Vitest no backend e escrever testes para os services e controllers do core domain.
- **Módulo:** `backend/`
- **Critério de conclusão:** Suíte de testes executa no pipeline com 100% de aprovação e relatório de cobertura $\ge 85\%$.
- **Dependências:** REQ-DOM-003, REQ-DOM-008.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

#### REQ-DOC-006 — Deploy Público Integrado e Funcional
- **Fonte:** Projeto Integrador Origem — *Entregáveis* (L458) e *Checklist AV2* (L437)
- **Exigência Original:** Aplicação full stack publicada em ambiente público acessível via URL (ex.: Vercel para frontend e Render/Railway para backend e PostgreSQL), demonstrando fluxo completo de ponta a ponta.
- **Classificação Normativa:** **Exigência da Disciplina (Obrigatório)**.
- **Estado atual:** Não atendido
- **Evidência:** O deploy na Vercel roda apenas o frontend consumindo a Fake API antiga da Render.
- **Ação necessária:** Realizar deploy do backend e banco de dados integrado ao frontend da Vercel.
- **Módulo:** `backend/`, `frontend/`
- **Critério de conclusão:** Fluxo de compra executado com sucesso no ambiente público com chamadas registradas no network do navegador.
- **Dependências:** REQ-INT-001, REQ-DOC-003.
- [ ] Implementar
- [ ] Validar
- [ ] Documentar

---

## 4. Seção de Decisões Técnicas Pendentes de Aprovação

As decisões técnicas abaixo representam alternativas de engenharia formuladas para cumprir os requisitos normativos. **Nenhuma delas está aprovada automaticamente** e nenhuma implementação deve ser iniciada antes do consentimento explícito do desenvolvedor:

### Decisão 01: Modelo de Repositório (Monorepo) e Limpeza de Artefatos Legados
- **Contexto:** A branch `feat/frontend-next` possui a pasta `frontend/`, mas a raiz continha arquivos legados do Maven (`pom.xml`, `mvnw`, `mvnw.cmd`) e binários em `target/` com relatórios de FCCPD.
- **Proposta Técnica:** Adotar a estrutura monorepo permitida pela disciplina (`frontend/` e `backend/`), salvaguardando previamente os 28 relatórios acadêmicos do Surefire em `docs/03-computacao-concorrente-distribuida/surefire-reports/`, criando a pasta `backend/` e removendo com segurança os artefatos legados Java/Maven.
- **Status Atual:** **Aprovada e Executada** (Fundação do backend concluída em 14/11/2026).

### Decisão 02: Arquitetura de Cache e Filas Assíncronas
- **Contexto:** O PI exige cache e processamento assíncrono. O documento cita Redis e BullMQ a título exemplificativo, permitindo expressamente tecnologias equivalentes que façam sentido (`projeto-integrador-origem.md` L335-L336).
- **Opções:**
  - *Opção A:* Utilizar Redis e BullMQ. Exige provisionar e custear uma instância externa de Redis em produção.
  - *Opção B (Proposta do Agente):* Utilizar cache em memória com TTL (`node-cache` ou `lru-cache`) e fila assíncrona gerenciada via tabela relacional transacional no próprio PostgreSQL com worker agendado (padrão Transactional Outbox / Fila no Banco). Elimina dependências externas, reduz custos de deploy e cumpre 100% dos requisitos acadêmicos da rubrica.
- **Status Atual:** **Pendente de Decisão / Não Aprovado**

### Decisão 03: Estratégia de Integração do Módulo de IA (Recomendador)
- **Contexto:** Existe o microsserviço BentoML em Python em `ia-recomendador/` com dataset sintético próprio. O PI exige que a recomendação seja consumida pela aplicação web (`projeto-integrador-origem.md` L368).
- **Opções:**
  - *Opção A:* Manter o BentoML em Python como microsserviço em execução na porta 3001 e fazer o backend Express atuar como proxy HTTP. Exige manter dois runtimes distintos no deploy (Python e Node.js).
  - *Opção B (Proposta do Agente):* Reimplementar o algoritmo de similaridade por cosseno com pesos e co-ocorrência da HU-24 diretamente como um serviço TypeScript dentro do backend Express (`services/recomendacao.service.ts`), consultando diretamente os dados reais do PostgreSQL. Unifica o backend em um único runtime Node.js e garante recomendações sobre o acervo real.
- **Status Atual:** **Pendente de Decisão / Não Aprovado**

### Decisão 04: Estratégia de Cotação de Frete e Gateway Pix
- **Contexto:** A HU-07 exige cálculo de frete baseado na cubagem física e nos CEPs de ateliê e comprador. A HU-10 exige geração de Pix dinâmico e webhook idempotente.
- **Opções:**
  - *Opção A:* Integrar com APIs reais em sandbox de transportadoras (Melhor Envio / Correios) e gateway de pagamentos (Mercado Pago / Asaas / EFI). Exige chaves de API externas que podem expirar ou sofrer indisponibilidade em bancas de apresentação.
  - *Opção B (Proposta do Agente):* Implementar provedores determinísticos no backend: (1) cálculo de frete por faixas de CEP e cubagem com regras precisas de Pernambuco; (2) gerador de payloads Pix dinâmicos em formato oficial com código Copia-e-Cola e simulador de webhook com cabeçalho `Idempotency-Key`. Garante funcionamento autônomo, previsível e sem dependência de credenciais externas.
- **Status Atual:** **Pendente de Decisão / Não Aprovado**

---

## 5. Resumo Estatístico dos Requisitos Auditados

- **Total Geral de Requisitos:** **76**

### Distribuição por Classificação Normativa Rigorosa:
| Categoria Normativa | Quantidade | Percentual |
|---|---|---|
| **Exigência da Disciplina (Obrigatório)** | 24 | 31,6% |
| **Regra de Negócio do Backlog (Must Have)** | 28 | 36,8% |
| **Melhoria do Backlog (Should Have)** | 6 | 7,9% |
| **Recomendação Arquitetural** | 12 | 15,8% |
| **Regra da Trilha de IA / Tarefa Derivada** | 2 | 2,6% |
| **Decisão Técnica Proposta / Tarefa Derivada** | 4 | 5,3% |
| **TOTAL** | **76** | **100%** |

### Distribuição por Estado Atual na Branch `feat/frontend-next`:
| Estado Atual | Quantidade | Percentual | Observação |
|---|---|---|---|
| **Não atendido** | 58 | 76,3% | Ausência de backend, persistência e migrations nesta branch |
| **Parcialmente atendido (Inspeção estática)** | 9 | 11,8% | Telas ou contratos parciais que usam localStorage ou aguardam dados reais |
| **Divergente** | 5 | 6,6% | Implementações atuais que omitem regras obrigatórias (ex.: cubagem, carrinho por ateliê) |
| **Atendido em Módulo Isolado** | 1 | 1,3% | Algoritmo Python em `ia-recomendador/` testado em pytest, mas desconectado da web |
| **Não verificado em integração** | 3 | 3,9% | Código estático pronto (ex.: blocos de erro/loading, vitrine), pendente de teste dinâmico com API |
| **Atendido (Verificado em Execução Integrada)** | 0 | 0,0% | Nenhuma funcionalidade ponta a ponta conectada ao backend real existe nesta branch |
| **TOTAL** | **76** | **100%** | Auditoria 100% concluída |

---

*Checklist revisado e corrigido em conformidade estrita com o `AGENTS.md` e as fontes normativas oficiais. Nenhuma decisão pendente foi dada como aprovada e nenhum código foi alterado nesta etapa.*
