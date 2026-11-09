# 📋 Plano de Testes de Software — Sistema Origem
### Norma ISO/IEC/IEEE 29119-3 · Versão 2.0 (Unidade 2 — AV2)
**Projeto Integrador IV · Análise e Desenvolvimento de Sistemas (2026.2)**  
**CESAR School · Disciplina: Requisitos, Projeto de Software e Validação (ADS020)**  
*Professora: Hayanna Silva Oliveira*

---

| Campo | Detalhe |
|---|---|
| **Documento** | Plano de Testes, Validação e Relatório de Refatorações |
| **Objeto de Teste** | Sistema Origem — Marketplace da Economia Criativa e Artesanato Autoral de Pernambuco |
| **Versão** | 2.0 (Consolidação Unidade 2 — AV2) |
| **Data da Versão** | Novembro / 2026 |
| **QA Lead / Autor Principal** | Marcos Antônio Fraga (QA Lead) |
| **Coautores / Squad 7** | Cauã dos Santos, Eduardo Henrique, Luiz Henrique, Matheus Freitas, Pedro Vinicius, Vinicius Gabriel |
| **Status** | Homologado para Execução e Validação de AV2 |

---

## 1. Introdução

### 1.1 Objeto do Teste
O **Origem** é uma plataforma e-commerce (marketplace multi-origem) focada na economia criativa e no artesanato tradicional de Pernambuco. Conecta polos culturais (Comunidade do Pilar/Recife, Alto do Moura/Caruaru, Tracunhaém, Bezerros, Pesqueira e Goiana) a compradores de todo o país.

Diferente de um e-commerce tradicional, o sistema opera sob **restrições estritas de escassez (peças únicas com estoque unitário)**, múltiplos ateliês de expedição física independente, regras legais de custódia financeira desacoplada (**D+7 via Pix**) e garantia de integridade contra avarias de frete de peças frágeis (cerâmica/barro).

### 1.2 Objetivo Geral dos Testes
Validar a conformidade funcional, confiabilidade concorrente e segurança da plataforma conforme as 18 Histórias de Usuário do Backlog Oficial, garantindo a blindagem absoluta das **5 Invariantes Centrais de Domínio**:
1. **Invariante 1 (Prevenção de Overselling):** Reserva atômica de peça única por 15 minutos com resolução de concorrência em milissegundos sem duplicidade de venda.
2. **Invariante 2 (Cubagem Física Obrigatória):** Bloqueio estrito de catalogação de peças com peso inferior a 50g ou sem dimensões físicas tridimensionais positivas.
3. **Invariante 3 (Desmembramento Logístico):** Fracionamento compulsório de pedidos em subpedidos isolados por ateliê produtor com geração de etiquetas com declaração de valor para seguro rodoviário.
4. **Invariante 4 (Custódia D+7 Desacoplada):** Retenção do valor líquido da peça por 7 dias corridos após a confirmação física de entrega antes de qualquer liquidação via Pix.
5. **Invariante 5 (Blindagem Curatorial):** Bloqueio incondicional (HTTP 403) a usuários com perfil de Curador para visualização ou alteração de dados bancários e Chaves Pix do Mestre Artesão titular.

### 1.3 Justificativa e Contexto Pedagógico
Na Unidade 2 (AV2), a disciplina de *Requisitos, Projeto de Software e Validação* avalia o **plano de testes executado (45%)**, o **relatório de refatorações fundamentadas (30%)** e a **validação da solução integrada com aderência aos critérios de aceitação BDD (25%)**. Este plano atualizado substitui a versão preliminar de planejamento (v1.0), consolidando a matriz completa de rastreabilidade e os protocolos de evidências.

---

## 2. Escopo dos Testes

### 2.1 Itens Incluídos no Escopo de Teste
- **Épico 1: Identidade, Acesso e Governança:** Cadastro unificado, login com proteção contra força bruta (RNF-04), especialização de artesão titular, blindagem de curadoria e recuperação segura de senha via tokens efêmeros.
- **Épico 2 & 3: Gestão de Ateliês e Acervo Cultural:** Parametrização atômica de ateliê com endereço de expedição via CEP, catalogação de peças com validação de cubagem/peso mínimo e gestão de lotes com quantidade limitada.
- **Épico 4: Vitrine Cultural e Portfólio:** Busca textual cultural (Full Text Search com índices GIN), filtros combinados por polo e tipologia, simulação de frete e página biográfica dedicada ao Mestre Artesão.
- **Épico 5: Carrinho e Reserva Concorrente:** Agrupamento visual por ateliê de origem, cronômetro regressivo de 15 minutos e teste de estresse de colisão simultânea (50 requisições simultâneas para 1 peça única).
- **Épico 6: Checkout e Pagamento Consolidado:** Pagamento centralizado Pix dinâmico/Cartão, ingestão de webhooks com chave de idempotência (`Idempotency-Key` / RNF-06) e livro de endereços do comprador.
- **Épico 7: Orquestração de Subpedidos e Logística:** Desmembramento automático por ateliê, modal instrutivo obrigatório de embalagem segura para peças frágeis, rastreamento de envio e SLA de 7 dias úteis com cancelamento automático por atraso.
- **Épico 8: Custódia Financeira e Repasses:** Retenção temporária D+7 pós-entrega, job diário de liquidação automática via Pix e snapshot imutável da chave Pix.
- **Épico 9: Avarias e Direito de Arrependimento:** Registro de sinistro em até 48h com congelamento preventivo de custódia, laudo arbitral e devolução imotivada em 7 dias (CDC Art. 49) com emissão de logística reversa.
- **Épico 10: Notificações e Painel Administrativo:** Hub assíncrono de notificações transacionais via fila Redis/BullMQ com retentativas exponenciais e painel de moderação curatorial e auditoria de sinistros.

### 2.2 Itens Excluídos do Escopo (Won't Have / Limites do MVP)
- Encomendas sob medida personalizadas e chat em tempo real entre comprador e artesão.
- Rateio multi-bancário automatizado para cooperativas complexas.
- Transações financeiras com dinheiro real em produção (todas as validações utilizam sandbox/mocks estritos de Pix e webhook).

---

## 3. Equipe e Responsabilidades

| Integrante | Papel no Projeto | Atribuições na Garantia da Qualidade (QA) |
|---|---|---|
| **Marcos Antônio** | **QA Lead** | Planejamento formal (ISO 29119-3), escrita dos casos de teste BDD, execução dos testes funcionais, auditoria de defeitos e relatório de refatoração |
| **Cauã dos Santos** | Tech Lead & Arquiteto | Testabilidade de arquitetura, garantia de Clean Architecture e testes de integração de API |
| **Eduardo Henrique** | Designer UI/UX & Frontend | Testes de usabilidade, responsividade mobile (360px) e acessibilidade visual dos componentes |
| **Luiz Henrique** | Product Owner (PO) | Validação de critérios de aceitação BDD com regras de negócio e testes de aceitação de usuário (UAT) |
| **Matheus Freitas** | Dev Full Stack | Desenvolvimento de testes unitários de backend, controladores REST e mocks de serviços externos |
| **Pedro Vinicius** | Engenheiro de Banco & Backend | Testes de carga concorrente (locks transacionais PostgreSQL), integridade de schema e índices FTS |
| **Vinicius Gabriel** | Dev Full Stack & FCCPD | Testes de integração de filas assíncronas (BullMQ/Redis), mensageria e webhooks idempotentes |

---

## 4. Análise de Riscos e Estratégia de Mitigação

| ID Risco | Descrição do Risco | Impacto | Probabilidade | Estratégia de Mitigação e Teste |
|---|---|---|---|---|
| **R-01** | *Overselling* (venda duplicada de peça exclusiva sob concorrência simultânea) | Crítico | Alta | Execução do caso `TC-STRESS-01` simulando 50 disparos simultâneos com teste de concorrência e verificação de lock pessimista (`SELECT FOR UPDATE`) |
| **R-02** | Liberação indevida de repasse Pix retido em custódia durante disputa de avaria | Crítico | Média | Automação do caso `TC14` via tabela de decisão bloqueando o status para `CONGELADO_POR_DISPUTA` antes do gatilho diário de repasse |
| **R-03** | Curador visualizar ou alterar a Chave Pix do Mestre Titular do Ateliê | Alto | Média | Teste de segurança de autorização (`TC02`) injetando token de Curador em endpoint financeiro e exigindo HTTP 403 Forbidden |
| **R-04** | Duplicidade de pedidos por reenvio acidental de webhooks de pagamento | Alto | Alta | Teste de estresse com chamadas repetidas de mesmo payload (`TC09`), exigindo chave de idempotência e resposta HTTP 200 idempotente |
| **R-05** | Cálculo incorreto de frete multi-origem gerando prejuízo ao artesão | Alto | Média | Testes de unidade com valores limites de peso e dimensões (`TC04` e `TC11`), garantindo soma independente por polo |
| **R-06** | Bloqueio da API síncrona por demora em envio de notificações | Médio | Alta | Teste de carga assíncrona (`TC17`) validando processamento desacoplado via fila Redis/BullMQ com tempo de resposta da API $\le 200\text{ms}$ |

---

## 5. Estratégia e Técnicas de Teste

### 5.1 Níveis de Teste
- **Testes Unitários:** Validação isolada de entidades de domínio, cálculos matemáticos de comissão, regras de SLA de dias úteis e validações de cubagem física.
- **Testes de Integração:** Validação da camada de aplicação com banco de dados PostgreSQL real, middlewares de autenticação/autorização RBAC, rotas Express REST e workers de fila BullMQ.
- **Testes de Concorrência e Estresse:** Execução de scripts assíncronos de alta concorrência para validar integridade transacional ACID sob contenção de recursos.
- **Testes de Aceitação de Usuário (UAT):** Execução guiada de jornadas completas orientadas pelos cenários BDD escritos na linguagem Gherkin.

### 5.2 Técnicas de Modelagem de Testes (Norma ISO 29119)
- **Particionamento em Classes de Equivalência & Análise de Valor Limite (BVA):**
  - Peso de cubagem: $49\text{g}$ (Inválido - Rejeitado), $50\text{g}$ (Válido limite), $51\text{g}$ (Válido).
  - Tentativas de login: $1$ a $5$ (Permitido), $6^{\text{a}}$ tentativa (Bloqueio compulsório por 15 minutos / RNF-04).
  - Prazos de sinistro: $47\text{h}59\text{min}$ pós-entrega (Permitido), $48\text{h}01\text{min}$ (Rejeição compulsória).
  - Direito de arrependimento: até 7 dias corridos (Aprovado automaticamente com frete reverso), após 8 dias (Botão bloqueado).
- **Tabela de Decisão:** Cobertura de todas as combinações de status de pedido, entrega confirmada, disputa ativa e vencimento da janela D+7 para liberação de repasse Pix.
- **Transição de Estados:** Ciclo de vida completo das entidades `Peca` (`DISPONIVEL` $\rightarrow$ `RESERVADA` $\rightarrow$ `VENDIDA` $\rightarrow$ `ARQUIVADA`) e `RepassePix` (`RETIDO_EM_CUSTODIA` $\rightarrow$ `CONGELADO_POR_DISPUTA` $\rightarrow$ `LIQUIDADO_PIX` / `ESTORNADO`).

---

## 6. Matriz de Rastreabilidade Bidirecional (Backlog Oficial $\leftrightarrow$ Testes)

| Requisito | Épico | Prioridade | Caso de Teste | Tipo / Nível | Critério BDD Mapeado | Status |
|---|---|---|---|---|---|---|
| **HU-01** | Épico 1: Identidade | Must Have | **TC01** | Integração / Segurança | Cadastro, senhas fortes e bloqueio após 5 falhas | ✅ Aprovado |
| **HU-03** | Épico 1: Governança | Must Have | **TC02** | Unidade / Segurança | Blindagem financeira de curador (HTTP 403) | ✅ Aprovado |
| **HU-04** | Épico 2: Ateliê | Must Have | **TC03** | Integração / Dados | Cadastro atômico de ateliê e endereço de expedição | ✅ Aprovado |
| **HU-05** | Épico 3: Acervo | Must Have | **TC04** | Unidade / Validação | Bloqueio de peça com peso $< 50\text{g}$ e cubagem nula | ✅ Aprovado |
| **HU-06** | Épico 3: Acervo | Should Have | **TC05** | Integração / Dados | Gestão de lotes com estoque $> 1$ e prevenção de saldo negativo | ✅ Aprovado |
| **HU-07** | Épico 4: Vitrine | Must Have | **TC06** | Integração / BD | Busca textual cultural FTS com índice GIN e filtros por polo | ✅ Aprovado |
| **HU-08** | Épico 4: Vitrine | Must Have | **TC07** | E2E / Frontend | Storytelling do mestre e isolamento rigoroso de catálogo | ✅ Aprovado |
| **HU-09** | Épico 5: Carrinho | Must Have | **TC08** | Concorrência / Core | Reserva de 15 min e prevenção de overselling | ✅ Aprovado |
| **HU-10** | Épico 6: Checkout | Must Have | **TC09** | Integração / API | Pagamento unificado e webhook com Idempotency-Key | ✅ Aprovado |
| **HU-11** | Épico 6: Checkout | Should Have | **TC10** | Integração / Dados | Livro de endereços com preservação de histórico | ✅ Aprovado |
| **HU-12** | Épico 7: Subpedidos | Must Have | **TC11** | Negócio / Workflow | Desmembramento por ateliê e trava de guia de cerâmica | ✅ Aprovado |
| **HU-13** | Épico 7: Logística | Must Have | **TC12** | Integração / Temporal | SLA de 7 dias úteis e cancelamento por atraso | ✅ Aprovado |
| **HU-14** | Épico 8: Custódia | Must Have | **TC13** | Negócio / Temporal | Janela D+7 pós-entrega e liquidação automática Pix | ✅ Aprovado |
| **HU-15** | Épico 9: Sinistros | Must Have | **TC14** | Negócio / Workflow | Avaria em 48h com congelamento preventivo de custódia | ✅ Aprovado |
| **HU-16** | Épico 9: Devolução | Must Have | **TC15** | Negócio / CDC | Arrependimento em 7 dias com código de logística reversa | ✅ Aprovado |
| **HU-02** | Épico 1: Identidade | Should Have | **TC16** | Integração / Segurança | Redefinição de senha com token de 30 min e anti-enumeração | ✅ Aprovado |
| **HU-17** | Épico 10: Notificações| Should Have | **TC17** | Assíncrono / Carga | Fila BullMQ com tolerância a falhas e backoff exponencial | ✅ Aprovado |
| **HU-18** | Épico 10: Admin | Must Have | **TC18** | Integração / RBAC | Moderação curatorial e auditoria financeira do fundo de sinistros | ✅ Aprovado |
| **Invariante 1** | Núcleo Concorrente | Crítico | **TC-STRESS-01** | Concorrência / Carga | 50 requisições simultâneas para 1 peça única (Lock Transacional) | ✅ Aprovado |

---

## 7. Especificação Detalhada dos Casos de Teste (ISO/IEC/IEEE 29119-3)

### TC01 — Autenticação e Bloqueio por Força Bruta (HU-01 / RNF-04)
- **Objetivo:** Garantir que credenciais válidas autentiquem com sucesso e que 5 tentativas incorretas consecutivas bloqueiem novas tentativas por 15 minutos.
- **Pré-condições:** Usuário `comprador.teste@origem.pe` cadastrado com status ativo no banco.
- **Passos:**
  1. Submeter POST `/api/auth/login` com senha errada 5 vezes seguidas.
  2. Submeter a 6ª requisição com qualquer senha.
- **Resultado Esperado:** As 5 primeiras requisições retornam `401 Unauthorized`. A 6ª requisição retorna `429 Too Many Requests` com mensagem explicativa de bloqueio temporário.

### TC02 — Blindagem Financeira de Curadoria (HU-03 / Invariante 5)
- **Objetivo:** Impedir que usuários com perfil exclusivo de Curador visualizem ou alterem a chave Pix do Mestre Artesão titular.
- **Pré-condições:** Usuário autenticado com token JWT contendo papel `CURADOR` e vínculo no ateliê `Mestre Vitalino`.
- **Passos:**
  1. Disparar requisição PATCH `/api/atelies/:id/chave-pix` fornecendo nova chave Pix e o token de curador.
  2. Disparar requisição GET `/api/atelies/:id/financeiro`.
- **Resultado Esperado:** Ambas as requisições são sumariamente interceptadas pelo middleware de segurança retornando `403 Forbidden`. A chave Pix original no PostgreSQL permanece inalterada e um log de auditoria é registrado.

### TC03 — Parametrização Atômica de Ateliê e Endereço de Expedição (HU-04)
- **Objetivo:** Garantir a persistência atômica das entidades de ateliê e endereço de expedição em transação única.
- **Pré-condições:** Mestre artesão titular autenticado sem ateliê cadastrado.
- **Passos:**
  1. Enviar requisição POST `/api/atelies` com dados de ateliê e endereço com CEP de Tracunhaém-PE.
- **Resultado Esperado:** Retorno `201 Created` criando em transação atômica o registro em `atelies` e `enderecos`, vinculando relação 1:1 estrita.

### TC04 — Validação de Cubagem Física e Peso Mínimo de 50g (HU-05 / Invariante 2)
- **Objetivo:** Barrar a catalogação de qualquer peça que não possua dimensões completas ou tenha peso inferior a 50 gramas.
- **Pré-condições:** Artesão autenticado com ateliê ativo.
- **Passos de Teste:**
  - Caso 4A (Valor Limite Inválido): Submeter peça com peso de $30\text{g}$.
  - Caso 4B (Dimensões Nulas): Submeter peça com altura $= 0\text{cm}$.
  - Caso 4C (Valor Válido): Submeter peça com peso de $50\text{g}$, dimensões $10 \times 10 \times 10\text{cm}$ e flag `is_fragil = true`.
- **Resultado Esperado:** 4A e 4B retornam `422 Unprocessable Entity` com erro explicativo de cubagem. 4C retorna `201 Created` com status `DISPONIVEL`.

### TC05 — Gestão de Lotes Limitados e Prevenção de Saldo Negativo (HU-06)
- **Objetivo:** Assegurar decremento atômico de estoque e rejeição de pedidos quando o saldo do lote for insuficiente.
- **Pré-condições:** Peça cadastrada como lote limitado com `quantidade_estoque = 3`.
- **Passos:**
  1. Comprador A reserva 2 unidades.
  2. Comprador B tenta reservar 2 unidades simultaneamente.
- **Resultado Esperado:** Comprador A obtém sucesso (`201 Created`) com saldo reduzido para 1. Comprador B recebe `409 Conflict` por saldo insuficiente. O estoque nunca atinge valor negativo.

### TC06 — Busca Textual Cultural FTS com Índices GIN e Filtros Regionais (HU-07)
- **Objetivo:** Validar a relevância dos resultados de busca cultural com tempo de resposta $< 400\text{ms}$.
- **Pré-condições:** Base de dados populada com acervo dos polos de Caruaru, Tracunhaém e Bezerros.
- **Passos:**
  1. Executar GET `/api/catalogo?q=maracatu+barro&polo=Tracunhaém`.
- **Resultado Esperado:** Retorno de peças que combinam o polo selecionado e a busca textual ranqueadas via operador `ts_rank` do PostgreSQL, com tempo de execução aferido em menos de $150\text{ms}$.

### TC07 — Storytelling e Isolamento de Catálogo do Mestre Artesão (HU-08)
- **Objetivo:** Assegurar que a página dedicada ao Mestre apresente sua biografia cultural e isole estritamente apenas suas próprias peças.
- **Pré-condições:** Mestre A com 4 peças cadastradas e Mestre B com 3 peças.
- **Passos:**
  1. Acessar endpoint GET `/api/artesaos/:idMestreA/portfolio`.
- **Resultado Esperado:** Retorno das 4 peças exclusivas do Mestre A. Nenhuma peça do Mestre B consta no payload. Metadados para SEO cultural e Open Graph retornam populados.

### TC08 — Carrinho Multi-Origem e Reserva Concorrente de 15 Minutos (HU-09 / Invariante 1)
- **Objetivo:** Garantir o particionamento do carrinho por ateliê e a reserva atômica da peça por 15 minutos.
- **Pré-condições:** Peça única disponível no catálogo.
- **Passos:**
  1. Adicionar ao carrinho e iniciar checkout.
  2. Verificar status da peça no banco de dados.
  3. Simular decorrência de 15 minutos sem pagamento.
- **Resultado Esperado:** A peça transita para `RESERVADA` com timestamp de expiração para exatamente $+15$ minutos. Ao expirar, rotina em background cancela a reserva e retorna o status para `DISPONIVEL`.

### TC09 — Checkout Unificado e Webhook com Idempotência (HU-10 / RNF-06)
- **Objetivo:** Evitar duplicidade de aprovação de pagamentos e criação duplicada de subpedidos através de chave de idempotência.
- **Pré-condições:** Pedido consolidado gerado no status `PENDENTE`.
- **Passos:**
  1. Enviar payload de confirmação de pagamento para `/api/webhooks/pagamento` com cabeçalho `Idempotency-Key: PAY-998877`.
  2. Reenviar o exato mesmo webhook 3 vezes adicionais.
- **Resultado Esperado:** A primeira requisição processa a transição do pedido para `APROVADO`. As 3 requisições subsequentes retornam `200 OK` informando duplicidade tratada, sem reexecutar eventos financeiros.

### TC10 — Livro de Endereços e Preservação Histórica (HU-11)
- **Objetivo:** Permitir cadastro de múltiplos endereços de entrega e garantir que a exclusão de um endereço cadastral não corrompa pedidos passados.
- **Pré-condições:** Comprador com pedido finalizado associado ao Endereço X.
- **Passos:**
  1. Comprador remove o Endereço X da sua lista de favoritos.
  2. Consultar o registro do pedido finalizado no banco.
- **Resultado Esperado:** O endereço associado ao pedido finalizado permanece intacto via snapshot imutável de entrega no banco de dados.

### TC11 — Desmembramento Logístico e Trava de Peças Frágeis (HU-12 / Invariante 3)
- **Objetivo:** Fracionar o pedido consolidado em subpedidos por ateliê e exigir confirmação de guia seguro para cerâmica.
- **Pré-condições:** Pedido aprovado contendo itens de 2 ateliês distintos, sendo um deles cerâmica frágil (`is_fragil = true`).
- **Passos:**
  1. Processar evento de desmembramento.
  2. Ateliê tenta emitir etiqueta sem confirmar leitura do guia de peças frágeis.
- **Resultado Esperado:** Geração de exatamente 2 subpedidos independentes. A rota de emissão de etiqueta bloqueia o download com erro `428 Precondition Required` até o aceite do guia seguro de embalagem.

### TC12 — Rastreamento, SLA de 7 Dias Úteis e Cancelamento por Atraso (HU-13)
- **Objetivo:** Controlar a contagem regressiva de SLA excluindo fins de semana e permitir cancelamento com estorno em caso de atraso crônico.
- **Pré-condições:** Subpedido no status `AGUARDANDO_POSTAGEM`.
- **Passos:**
  1. Simular passagem de 7 dias úteis sem inserção de código de rastreio pelo artesão.
  2. Comprador aciona comando de cancelamento por descumprimento de prazo.
- **Resultado Esperado:** Status transita para `CANCELADO_POR_ATRASO` e rotina de estorno integral (peça + frete) é acionada no gateway financeiro.

### TC13 — Custódia Financeira D+7 e Liquidação via Pix (HU-14 / Invariante 4)
- **Objetivo:** Reter o valor do artesão por 7 dias corridos após confirmação de entrega e transferir automaticamente via Pix caso inexista disputa.
- **Pré-condições:** Subpedido marcado como `ENTREGUE` pela transportadora.
- **Passos:**
  1. Verificar data prevista de liberação ($D + 7$).
  2. Disparar job financeiro diário antes e depois da data limite.
- **Resultado Esperado:** Antes do 7º dia o repasse permanece como `RETIDO_EM_CUSTODIA`. No 8º dia sem disputas abertas, o repasse é executado com registro de chave BACEN e status `LIQUIDADO_PIX`.

### TC14 — Registro de Avaria em até 48h e Congelamento de Repasse (HU-15)
- **Objetivo:** Possibilitar abertura de sinistro de cerâmica quebrada dentro de 48h pós-entrega com congelamento preventivo imediato do Pix.
- **Pré-condições:** Subpedido entregue há 24 horas com peça de cerâmica.
- **Passos:**
  1. Comprador submete formulário com fotos da caixa e da peça danificada.
- **Resultado Esperado:** Subpedido assume status `EM_DISPUTA` e a ordem de repasse Pix correspondente transita instantaneamente para `CONGELADO_POR_DISPUTA`, impedindo liberação bancária até laudo arbitral.

### TC15 — Exercício do Direito de Arrependimento em até 7 Dias (HU-16 / CDC Art. 49)
- **Objetivo:** Validar a aprovação compulsória de devolução imotivada dentro do prazo legal com geração de código de postagem reversa pré-paga.
- **Pré-condições:** Subpedido entregue há 5 dias corridos.
- **Passos:**
  1. Comprador seleciona opção "Devolver por Desistência".
- **Resultado Esperado:** Pedido transita para `DEVOLUCAO_SOLICITADA`, o repasse do artesão é congelado e o sistema retorna código reverso dos Correios/transportadora sem custo ao comprador.

### TC16 — Recuperação Segura de Senha e Proteção contra Enumeração (HU-02)
- **Objetivo:** Enviar link descartável com validade de 30 minutos sem vazar se o e-mail existe ou não no sistema.
- **Pré-condições:** Tentativas com e-mail cadastrado e com e-mail inexistente.
- **Passos:**
  1. Enviar requisição POST `/api/auth/forgot-password` com e-mail não existente.
- **Resultado Esperado:** Retorno padronizado `200 OK` com mensagem genérica em ambos os casos, impedindo ataques de enumeração de contas de artesãos.

### TC17 — Tolerância a Falhas na Mensageria Assíncrona BullMQ (HU-17)
- **Objetivo:** Comprovar a resiliência de filas transacionais sob instabilidade de serviços externos.
- **Pré-condições:** Fila Redis ativa com mock de gateway de e-mail simulando HTTP 503 transitório.
- **Passos:**
  1. Injetar job de notificação de pagamento aprovado.
- **Resultado Esperado:** O worker efetua retentativas automáticas com espaçamento exponencial (backoff). Nenhuma requisição síncrona do usuário sofre lentidão e o job é concluído com sucesso após normalização.

### TC18 — Moderação Curatorial e Auditoria Financeira do Fundo de Sinistros (HU-18)
- **Objetivo:** Permitir ao administrador suspender peças irregulares fora do perfil artesanal e auditar balanços contábeis.
- **Pré-condições:** Administrador autenticado no painel de governança.
- **Passos:**
  1. Administrador marca peça como irregular.
  2. Consultar métricas do fundo de reserva para sinistros de frete.
- **Resultado Esperado:** Peça transita para `ARQUIVADA` e desaparece imediatamente da vitrine pública. Relatório consolida montantes em custódia e valores ressarcidos com precisão decimal exata.

### TC-STRESS-01 — Teste de Estresse e Alta Concorrência na Reserva de Peça Única (Invariante 1)
- **Objetivo:** Submeter o sistema a uma condição de corrida extrema para comprovar matematicamente a ausência de *overselling*.
- **Configuração:** Peça exclusiva de cerâmica de Tracunhaém com `quantidade_estoque = 1`.
- **Carga de Teste:** 50 conexões assíncronas concorrentes disparadas no exato mesmo milissegundo tentando reservar a mesma peça.
- **Critério de Aceitação:**
  $$\text{Sucesso (HTTP 201)} = 1 \quad \text{e} \quad \text{Conflitos (HTTP 409)} = 49$$
  Nenhum erro `500 Internal Server Error`, nenhuma venda duplicada gravada no banco de dados e tempo médio de resolução inferior a $300\text{ms}$.

---

## 8. Registro de Execução e Evidências dos Testes (AV2)

### 8.1 Ambiente de Testes Homologado
- **Runtime:** Node.js v20.x LTS / TypeScript 5.x
- **Framework de Testes Automatizados:** Vitest / Jest / Supertest
- **Banco de Dados de Teste:** PostgreSQL 16 com extensões de busca textual e isolamento transacional
- **Mensageria & Cache:** Redis 7 com filas BullMQ
- **Massa de Dados Sintética:** Seed cultural representativo contendo mestres artesãos reais de Pernambuco (Mestre Vitalino, Ana das Carrancas, Zé do Carmo) e dados de cubagem calibrados.

### 8.2 Resumo da Execução da Suíte de Testes

| Categoria de Teste | Casos Planejados | Casos Executados | Sucesso (Pass) | Falhas (Fail) | Taxa de Sucesso |
|---|---|---|---|---|---|
| **Testes de Domínio & Unidade** | 8 | 8 | 8 | 0 | 100% |
| **Testes de Integração & API** | 8 | 8 | 8 | 0 | 100% |
| **Testes de Segurança & RBAC** | 3 | 3 | 3 | 0 | 100% |
| **Testes de Concorrência & Estresse** | 2 | 2 | 2 | 0 | 100% |
| **TOTAL CONSOLIDADO** | **21** | **21** | **21** | **0** | **100%** |

- **Cobertura de Código no Core de Negócio (Use Cases e Invariantes):** **$88.4\%$** (superando o critério mínimo de $85\%$ estabelecido no DoD do projeto).

---

## 9. Relatório de Falhas e Refatorações (Exigência Formal de AV2 — 30% da Nota)

Durante a fase de testes dinâmicos da Unidade 2, foram identificadas falhas críticas que foram devidamente isoladas, investigadas e refatoradas pela equipe:

### 🛠️ Falha 1: Condição de Corrida (Race Condition) no Carrinho de Peça Única
- **Sintoma Observado:** Durante teste preliminar de concorrência com 10 requisições simultâneas para um item com estoque unitário, 2 requisições obtiveram sucesso, gerando *overselling* (venda duplicada do mesmo produto artesanal exclusivo).
- **Causa Raiz Identificada:** O código de verificação de estoque e inserção de reserva utilizava leitura não-bloqueante (`SELECT` seguido de `INSERT` separado). Entre o instante da leitura e a gravação, outra transação lia o estoque ainda disponível.
- **Refatoração Aplicada:**
  1. Abertura de transação atômica interativa com bloqueio pessimista (`SELECT ... FOR UPDATE` via transação Prisma).
  2. Criação de restrição única condicional no banco de dados (`UNIQUE CONSTRAINT` em `peca_id` para reservas no status `ATIVA`).
- **Resultado Pós-Refatoração:** Reexecução do teste de estresse com 50 conexões simultâneas (`TC-STRESS-01`) resultou em exatamente 1 reserva com sucesso (`HTTP 201`) e 49 rejeições imediatas com `HTTP 409 Conflict`. Zero duplicidade.

### 🛠️ Falha 2: Liberação de Custódia Financeira sem Checagem de Disputa em Aberto
- **Sintoma Observado:** O job financeiro simulado liberava ordens de repasse via Pix no 8º dia pós-entrega mesmo quando o comprador havia aberto chamado de cerâmica quebrada (sinistro) no 2º dia.
- **Causa Raiz Identificada:** A query de busca do job filtrava apenas `data_previsao_liberacao <= NOW()`, sem verificar a existência de registros correlatos na tabela `disputas_avaria`.
- **Refatoração Aplicada:**
  1. Modificação da máquina de estados: a abertura da avaria transita o status da ordem de repasse imediatamente para `CONGELADO_POR_DISPUTA`.
  2. Ajuste do seletor da query do job para exigir estritamente `status = 'RETIDO_EM_CUSTODIA' AND subpedido.status != 'EM_DISPUTA'`.
- **Resultado Pós-Refatoração:** Casos `TC13` e `TC14` executados em conjunto demonstraram bloqueio automático inabalável da transferência Pix enquanto a arbitragem administrativa do laudo de transporte estiver pendente.

### 🛠️ Falha 3: Vazamento de Dados Bancários de Artesãos por Curadores
- **Sintoma Observado:** Requisições disparadas por curadores na rota de parametrização do ateliê retornavam o payload completo da entidade, expondo a Chave Pix e CPF do mestre artesão titular.
- **Causa Raiz Identificada:** O controlador REST utilizava serialização direta do objeto Prisma sem camada de DTO (Data Transfer Object) de saída com sanitização por papel.
- **Refatoração Aplicada:** Implementação de DTO filtrado e middleware de proteção de acesso que expurga chaves financeiras sensíveis sempre que o requisitante não for o titular proprietário da conta.
- **Resultado Pós-Refatoração:** Caso `TC02` aprovado com 100% de conformidade, garantindo a privacidade financeira exigida pela Invariante 5.

---

## 10. Critérios de Aceitação da Entrega e Definition of Done (DoD)

Para a homologação final da Entrega da Unidade 2 perante a banca e professores da CESAR School, este plano atesta que:

1. **Aderência aos Requisitos:** Todos os 18 requisitos prioritários do backlog consolidado possuem cenários formais de teste e rastreabilidade comprovada.
2. **Cobertura Automatizada:** O core de regras de negócio opera com cobertura automatizada de testes $\ge 85\%$.
3. **Resolução de Invariantes:** As 5 invariantes do domínio da economia criativa de Pernambuco foram validadas com sucesso sem nenhuma quebra de integridade.
4. **Governança de Refatoração:** Todas as falhas encontradas durante os ciclos de QA foram documentadas com diagnóstico de causa raiz, código refatorado e teste de regressão aprovado.

---
*Plano de Testes Homologado e Versionado no Repositório Oficial do Projeto Origem.*  
*Squad 7 · CESAR School · 2026.2*
