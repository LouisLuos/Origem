# Requisitos, Projeto de Software e Validação

ADS020_ED · Turma Embarque Digital · 2026.2 · Projeto Integrador "Origem" (CESAR School)

## Relatório de Execução Manual de Testes

Equipe 7 · Origem · unidade 2 · gerado em 10/11/2026 20:21

---

## Squad

**Integrantes**

- Cauã dos Santos Nascimento
- Eduardo Henrique Albuquerque Pessoa de Andrade
- Luiz Henrique Souza da Conceição
- Marcos Antônio Taveira Fraga
- Matheus de Freitas Oliveira
- Pedro Vinicíus Silva de Souza
- Vinicius Gabriel dos Santos Braz

**Responsáveis pela execução**

- Matheus de Freitas Oliveira (4 casos)
- Luiz Henrique Souza da Conceição (4 casos)
- Vinicius Gabriel dos Santos Braz (3 casos)
- Cauã dos Santos Nascimento (3 casos)
- Pedro Vinicíus Silva de Souza (3 casos)
- Eduardo Henrique Albuquerque Pessoa de Andrade (2 casos)

---

## Identificação da rodada

| Campo | Valor |
|---|---|
| **Objeto de teste** | Sistema Origem — Marketplace da Economia Criativa e Artesanato Autoral de Pernambuco |
| **Build / versão testada** | 2.0 (Consolidação Unidade 2 — AV2) |
| **Período de execução** | 11/09/2026 a 10/11/2026 |
| **Ambiente de execução** | Navegador Brave, Notebook, Linux Fedora 44, https://origem-five.vercel.app/ |
| **Base de teste** | `plano-de-testes.md` |

Versão 2. Anteriores: Backlog-Consolidade-Origem.pdf e backlog-priorizado.pdf · Plano de testes - Equipe 7 (Origem).pdf.

---

## Conclusão e recomendação

### Síntese dos resultados

Concluímos que a build atual tem um alto índice de impedimentos com 8 bloqueios, junto de pontos críticos em funcionalidades sensíveis como a reprovação do teste TC01 (bloqueio do login após 5 tentativas), mas que já há uma cobertura de regras de negócios específicos com 6 testes aprovados.

### Riscos residuais

Grande parte do escopo de segurança permanece pendente na build atual, tendo sido implementados apenas os recursos básicos necessários para o funcionamento mínimo do sistema. Esse cenário representa um risco de alta severidade, especialmente diante de um aumento significativo no volume de requisições e na quantidade de usuários. Caso o sistema seja disponibilizado nas condições atuais, há uma elevada probabilidade de aumento na demanda por atendimento e suporte, sobrecarregando a equipe de sustentação.

### Recomendação

**Liberar com restrições**

---

## Execução dos casos de teste

**Casos executados: 19 de 19**

| Aprovados | Reprovados | Bloqueados | Não executados | Defeitos |
|---|---|---|---|---|
| 6 | 5 | 8 | 0 | 0 · 0 em aberto |

**Cobertura do backlog:** 14 das 14 histórias de maior prioridade têm ao menos um caso de teste.

### Detalhamento por caso de teste

#### TC01 · Login bloqueado após 5 tentativas (Força Bruta)

- **Data:** 09/11/2026
- **Executor:** Vinicius Gabriel dos Santos Braz
- **Status:** ❌ Reprovado
- **Observação:** Não há o bloqueio de novas tentativas após inserir a senha inválida 5 vezes para o mesmo email.

#### TC02 · Blindagem de acesso financeiro por Curador (Invariante 5.5)

- **Data:** 10/11/2026
- **Executor:** Cauã dos Santos Nascimento
- **Status:** ⛔ Bloqueado
- **Observação:** O teste encontra-se bloqueado porque o endpoint de atualização de Chave Pix e o papel de usuário "CURADOR" não se encontram implementados no backend nem no serviço de autenticação no deploy atual, fazendo com que qualquer tentativa de envio retorne HTTP 404 antes de alcançar a regra de autorização esperada (HTTP 403).

##### TC02 · Reexecução automatizada (registro complementar)

> Registro adicionado após a rodada original. A execução de 10/11/2026 acima é preservada sem alterações. **Esta validação foi automatizada (teste de integração), não manual**, e não substitui uma reexecução manual oficial pela squad.

- **Data:** 21/11/2026
- **Executor:** Suíte automatizada de integração do backend (`backend/tests/integracao/hu03-governanca.test.ts`)
- **Tipo de execução:** Automatizada, via API HTTP do backend real (sem mocks)
- **Ambiente:** Banco PostgreSQL 17 isolado (container Docker local), com todas as migrations do repositório aplicadas; backend Express com autenticação JWT real (HU-01), RBAC contextual consultando vínculos reais e auditoria persistente. Branch `feat/frontend-next`, alterações locais sobre o commit `0dc6e31`. Não executado no Supabase compartilhado nem no deploy.
- **Comando:** `npm run test:integration` (com `DATABASE_URL` apontando para o banco isolado)
- **Pré-condição construída pelo teste:** usuário titular cadastrado e habilitado como artesão (Chave Pix do tipo e-mail), ateliê cadastrado, e um segundo usuário vinculado pelo titular como curador do ateliê.
- **Status:** ✅ Aprovado (validação automatizada)
- **Observação:** O curador autenticado enviou `PATCH /api/v1/atelies/:atelieId/chave-pix` com uma nova Chave Pix e recebeu **HTTP 403**. A Chave Pix cifrada do titular e sua data de atualização permaneceram **idênticas** às de antes da requisição, ou seja, **nenhuma alteração financeira** foi realizada. Foi **persistido no PostgreSQL** exatamente um evento na tabela `auditoria_seguranca`, localizado pelo identificador de correlação da requisição, com tipo `FINANCIAL_ACCESS_DENIED`, decisão `DENY`, motivo `CURATOR_FINANCIAL_BLOCK`, operação `ALTERAR_CHAVE_PIX`, usuário (curador), ateliê, método `PATCH`, caminho e data/hora. O teste verificou que o registro **não contém dados sensíveis**: nem a nova Chave Pix, nem a Chave Pix do titular, nem o token JWT da sessão, nem a senha. Na mesma suíte também passaram: o bloqueio 403 do curador na consulta financeira e na gestão de curadores (ambos auditados); a imutabilidade da trilha de auditoria (`UPDATE`, `DELETE` e `TRUNCATE` rejeitados); e o acesso financeiro do titular, que vê apenas a chave mascarada. A suíte executou 22 testes de integração (10 da HU-03 e 12 de regressão da HU-05), todos aprovados.

#### TC04 · Validação de Cubagem Física e Peso Mínimo de 50g

- **Data:** 10/11/2026
- **Executor:** Eduardo Henrique Albuquerque Pessoa de Andrade
- **Status:** ❌ Reprovado
- **Observação:** Executado em 09/11/2026 por Eduardo Henrique em ambiente local (backend Express, branch refactor-core, commit 3d036f3, PostgreSQL 16 via Docker com seed), pela rota POST /api/v1/produtos e sem autenticação, pois a API não possui login para simular o artesão autenticado previsto na pré-condição. Os casos 4A (peso 30g) e 4B (altura 0cm) retornaram 201 Created em vez de 422, ou seja, a peça inválida foi aceita, e o caso 4C (50g, 10x10x10cm, frágil) retornou 201 Created conforme esperado, porém sem o status DISPONIVEL na resposta. A causa é que a entidade Product não possui campos de peso, dimensões nem is_fragil, então a API ignora esses dados e não valida a cubagem (Invariante 2 não implementada). Sugere-se adicionar esses campos ao schema e validar no domínio peso mínimo de 50g e dimensões maiores que zero, retornando 422 com mensagem explicativa.

#### TC05 · Desmembramento exato de pedido consolidado multi-origem

- **Data:** 09/11/2026
- **Executor:** Vinicius Gabriel dos Santos Braz
- **Status:** ✅ Aprovado
- **Observação:** Evento de "Pagamento Aprovado" ocorreu e gerou 3 subpedidos independentes no banco.

#### TC07 · Storytelling e Isolamento de Catálogo do Mestre Artesão

- **Data:** 09/11/2026
- **Executor:** Matheus de Freitas Oliveira
- **Status:** ✅ Aprovado
- **Observação:** Validado com sucesso via interface e componente de portfólio. O perfil do artesão apresenta o storytelling cultural completo (biografia, polo regional de Caruaru e tipologia de cerâmica figurativa). O catálogo mantém o isolamento estrito por mestre, exibindo mensagem de ausência de peças quando não há itens vinculados e sem fuga de produtos de outros artesãos.

#### TC08 · Carrinho Multi-Origem e Reserva Concorrente de 15 Minutos

- **Data:** 10/11/2026
- **Executor:** Pedro Vinicíus Silva de Souza
- **Status:** ⛔ Bloqueado
- **Observação:** O ciclo de vida com estado RESERVADA e timestamp de expiração não existe no modelo do banco. Além disso a rotina em background para expirar e devolver a peça após 15 minutos ainda não foi desenvolvida.

#### TC09 · Checkout Unificado e Webhook com Idempotência

- **Data:** 10/11/2026
- **Executor:** Cauã dos Santos Nascimento
- **Status:** ⛔ Bloqueado
- **Observação:** O teste encontra-se bloqueado porque a rota de ingestão de webhooks e o middleware de deduplicação via cabeçalho Idempotency-Key não se encontram implementados na API nem vinculados a uma tabela de transações no deploy atual, impossibilitando a transição do pedido para aprovado e a validação do retorno HTTP 200 de duplicidade tratada.

#### TC10 · Livro de Endereços e Preservação Histórica

- **Data:** 09/11/2026
- **Executor:** Matheus de Freitas Oliveira
- **Status:** ⛔ Bloqueado
- **Observação:** A interface de perfil do comprador (/conta) contempla apenas a edição básica de Nome e E-mail. O livro de múltiplos endereços de entrega e o snapshot imutável em pedidos anteriores (HU-11) não se encontram implementados no deploy atual para permitir a validação do teste.

#### TC11 · Desmembramento Logístico e Trava de Peças Frágeis

- **Data:** 10/11/2026
- **Executor:** Pedro Vinicíus Silva de Souza
- **Status:** ⛔ Bloqueado
- **Observação:** O atributo is_fragil não existe na base de dados para configurar a pré-condição do teste. Além disso o endpoint de emissão de etiqueta e a trava HTTP 428 ainda não foram implementados no sistema.

#### TC12 · Rastreamento, SLA de 7 Dias Úteis e Cancelamento por Atraso

- **Data:** 10/11/2026
- **Executor:** Pedro Vinicíus Silva de Souza
- **Status:** ⛔ Bloqueado
- **Observação:** O status AGUARDANDO_POSTAGEM não existe no ciclo de vida de pedidos da aplicação. Além disso a regra de SLA de 7 dias úteis e o cancelamento com estorno (HU-16) ainda não foram desenvolvidos.

#### TC13 · Custódia Financeira D+7 e Liquidação via Pix

- **Data:** 10/11/2026
- **Executor:** Luiz Henrique Souza da Conceição
- **Status:** ✅ Aprovado
- **Observação:** Rotina de custódia validada: o repasse permaneceu retido até o 7º dia e foi liquidado via Pix com sucesso no 8º dia pós-entrega.

#### TC14 · Registro de Avaria em até 48h e Congelamento de Repasse

- **Data:** 10/11/2026
- **Executor:** Luiz Henrique Souza da Conceição
- **Status:** ✅ Aprovado
- **Observação:** Sinistro registrado dentro do prazo de 48h; subpedido colocado em disputa e o repasse Pix ao artesão foi congelado de imediato.

#### TC15 · Exercício do Direito de Arrependimento em até 7 Dias

- **Data:** 09/11/2026
- **Executor:** Luiz Henrique Souza da Conceição
- **Status:** ✅ Aprovado
- **Observação:** Devolução solicitada com sucesso aos 5 dias de entrega, com congelamento imediato do repasse Pix do artesão e emissão do código reverso dos Correios.

#### TC16 · Recuperação Segura de Senha e Proteção contra Enumeração

- **Data:** 09/11/2026
- **Executor:** Matheus de Freitas Oliveira
- **Status:** ⛔ Bloqueado
- **Observação:** O fluxo de recuperação de palavra-passe (HU-02) e o botão 'Esqueci a minha senha' não se encontram implementados na interface nem integrados a um serviço de envio de tokens por e-mail no deploy atual.

#### TC17 · Tolerância a Falhas na Mensageria Assíncrona BullMQ

- **Data:** 10/11/2026
- **Executor:** Luiz Henrique Souza da Conceição
- **Status:** ❌ Reprovado
- **Observação:** A retentativa da fila bloqueou o loop de eventos síncrono, causando degradação e timeout nas requisições da API durante a instabilidade do gateway.

#### TC18 · Moderação Curatorial e Auditoria Financeira do Fundo de Sinistros

- **Data:** 09/11/2026
- **Executor:** Matheus de Freitas Oliveira
- **Status:** ✅ Aprovado
- **Observação:** Validado com sucesso via interface no Painel Administrativo (/admin). O perfil de administração acedeu à gestão de Catálogo, executou a suspensão/arquivamento da peça irregular e a mesma foi imediatamente ocultada da vitrine pública de compradores.

#### TC-STRESS-01 · Teste de Estresse e Alta Concorrência na Reserva de Peça Única

- **Data:** 09/11/2026
- **Executor:** Vinicius Gabriel dos Santos Braz
- **Status:** ❌ Reprovado
- **Observação:** Uso de FakeAPI para geração de requisições assíncronas concorrentes. Não houve venda duplicada, mas não retornou status de conflitos para as 49 requisições.

#### TC03 · Parametrização Atômica de Ateliê e Endereço de Expedição

- **Data:** 10/11/2026
- **Executor:** Cauã dos Santos Nascimento
- **Status:** ⛔ Bloqueado
- **Observação:** O teste encontra-se bloqueado porque o endpoint de cadastro e a separação relacional 1:1 entre ateliês e endereços físicos não se encontram implementados no roteador da API nem no schema do banco de dados no deploy atual, resultando em HTTP 404 e inviabilizando a checagem da persistência atômica da transação.

#### TC06 · Busca Textual Cultural FTS com Índices GIN e Filtros Regionais

- **Data:** 10/11/2026
- **Executor:** Eduardo Henrique Albuquerque Pessoa de Andrade
- **Status:** ❌ Reprovado
- **Observação:** Executado em 09/11/2026 por Eduardo Henrique em ambiente local (backend Express, branch refactor-core, commit 3d036f3, PostgreSQL 16 via Docker com seed), pela rota POST /api/v1/produtos e sem autenticação, pois a API não possui login para simular o artesão autenticado previsto na pré-condição. Os casos 4A (peso 30g) e 4B (altura 0cm) retornaram 201 Created em vez de 422, ou seja, a peça inválida foi aceita, e o caso 4C (50g, 10x10x10cm, frágil) retornou 201 Created conforme esperado, porém sem o status DISPONIVEL na resposta. A causa é que a entidade Product não possui campos de peso, dimensões nem is_fragil, então a API ignora esses dados e não valida a cubagem (Invariante 2 não implementada). Sugere-se adicionar esses campos ao schema e validar no domínio peso mínimo de 50g e dimensões maiores que zero, retornando 422 com mensagem explicativa.

### Resumo em tabela

| Caso | Data | Executor | Status |
|---|---|---|---|
| TC01 · Login bloqueado após 5 tentativas | 09/11/2026 | Vinicius Gabriel dos Santos Braz | Reprovado |
| TC02 · Blindagem de acesso financeiro por Curador | 10/11/2026 | Cauã dos Santos Nascimento | Bloqueado |
| TC02 · Blindagem de acesso financeiro por Curador (reexecução automatizada, banco isolado) | 21/11/2026 | Suíte automatizada de integração | Aprovado (automatizado) |
| TC04 · Cubagem Física e Peso Mínimo de 50g | 10/11/2026 | Eduardo Henrique Albuquerque Pessoa de Andrade | Reprovado |
| TC05 · Desmembramento de pedido multi-origem | 09/11/2026 | Vinicius Gabriel dos Santos Braz | Aprovado |
| TC07 · Storytelling e Isolamento de Catálogo | 09/11/2026 | Matheus de Freitas Oliveira | Aprovado |
| TC08 · Carrinho Multi-Origem e Reserva de 15 Min | 10/11/2026 | Pedro Vinicíus Silva de Souza | Bloqueado |
| TC09 · Checkout Unificado e Webhook Idempotente | 10/11/2026 | Cauã dos Santos Nascimento | Bloqueado |
| TC10 · Livro de Endereços | 09/11/2026 | Matheus de Freitas Oliveira | Bloqueado |
| TC11 · Desmembramento Logístico e Peças Frágeis | 10/11/2026 | Pedro Vinicíus Silva de Souza | Bloqueado |
| TC12 · Rastreamento, SLA de 7 Dias Úteis | 10/11/2026 | Pedro Vinicíus Silva de Souza | Bloqueado |
| TC13 · Custódia D+7 e Liquidação via Pix | 10/11/2026 | Luiz Henrique Souza da Conceição | Aprovado |
| TC14 · Registro de Avaria em até 48h | 10/11/2026 | Luiz Henrique Souza da Conceição | Aprovado |
| TC15 · Direito de Arrependimento em até 7 Dias | 09/11/2026 | Luiz Henrique Souza da Conceição | Aprovado |
| TC16 · Recuperação Segura de Senha | 09/11/2026 | Matheus de Freitas Oliveira | Bloqueado |
| TC17 · Tolerância a Falhas BullMQ | 10/11/2026 | Luiz Henrique Souza da Conceição | Reprovado |
| TC18 · Moderação Curatorial e Auditoria Financeira | 09/11/2026 | Matheus de Freitas Oliveira | Aprovado |
| TC-STRESS-01 · Estresse e Alta Concorrência | 09/11/2026 | Vinicius Gabriel dos Santos Braz | Reprovado |
| TC03 · Parametrização Atômica de Ateliê | 10/11/2026 | Cauã dos Santos Nascimento | Bloqueado |
| TC06 · Busca Textual FTS com Índices GIN | 10/11/2026 | Eduardo Henrique Albuquerque Pessoa de Andrade | Reprovado |

---

## Registro de defeitos

Nenhum defeito registrado nesta rodada.

---

*Relatório gerado pelo board de execução de testes da disciplina, a partir dos resultados lançados pela squad em sala. Cada linha de execução e cada registro de defeito tem autoria e horário guardados no sistema. Requisitos, Projeto de Software e Validação · CESAR School · 2026.2 · Hayanna Silva Oliveira.*
