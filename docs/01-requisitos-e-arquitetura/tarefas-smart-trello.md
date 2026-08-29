# 📋 Tarefas SMART para o Trello — Projeto Origem

> Cada seção abaixo é um **card do Trello**. O título é o nome do card, a descrição vai no campo de descrição e os itens do checklist vão na checklist do card.

---

## 🔐 ÉPICO 1: IDENTIDADE E ACESSO

---

### Card: HU-01 · Cadastro de Conta com Seleção de Perfil

**Descrição:**
Como visitante, quero criar uma conta escolhendo se sou comprador ou artesão, para acessar as funcionalidades da plataforma correspondentes ao meu papel.

**Checklist: Tarefas SMART**

- [ ] **T-CAD-01 · Backend: Endpoint de criação de conta** (8h)
  Implementar `POST /auth/register` com validação de campos obrigatórios (nome, e-mail, senha, telefone), verificação de unicidade de e-mail, seleção de perfil (Comprador/Artesão) e dados complementares para artesão (biografia, polo, foto). Hash bcrypt para senha. DoD: Testes de integração cobrindo cadastro de comprador, artesão com status "Pendente de Verificação", rejeição de e-mail duplicado e validação de força de senha.

- [ ] **T-CAD-02 · Backend/Infra: E-mail de confirmação assíncrono** (4h)
  Configurar serviço de envio de e-mail de confirmação via fila (Redis/BullMQ) após criação da conta. DoD: E-mail enviado após cadastro sem impactar tempo de resposta da API.

- [ ] **T-CAD-03 · Frontend: Formulário de cadastro responsivo** (8h)
  Construir formulário com seleção dinâmica de perfil, campos complementares para artesão, validação client-side de senha, indicador de força e upload de foto de ateliê. DoD: Formulário funcional em desktop e mobile com validações visuais.

---

### Card: HU-02 · Autenticação Segura

**Descrição:**
Como usuário cadastrado, quero autenticar-me com meu e-mail e senha, para acessar meu perfil, carrinho e funcionalidades restritas.

**Checklist: Tarefas SMART**

- [ ] **T-AUTH-01 · Backend: Serviço de autenticação JWT** (8h)
  Criar serviço com hash bcrypt e geração de JWT assinado com refresh token. Controller `/auth/login`, claims (`role`, `userId`) e middleware de verificação. DoD: Testes unitários com senhas válidas/inválidas e JWT verificado.

- [ ] **T-AUTH-02 · Backend: Guards RBAC para rotas restritas** (4h)
  Implementar middlewares de autorização para proteção de rotas por papel (Comprador, Artesão, Admin) com retorno HTTP 401/403. DoD: Acesso a rota de outro papel bloqueado com teste automatizado.

- [ ] **T-AUTH-03 · Frontend: Formulário de login** (6h)
  Formulário de login com feedback de erro, persistência segura do token no cliente e redirecionamento pós-login por perfil. DoD: Login funcional com validação visual e redirecionamento correto.

---

### Card: HU-03 · Recuperação de Senha

**Descrição:**
Como usuário que esqueceu sua senha, quero solicitar a redefinição via e-mail, para recuperar o acesso de forma segura.

**Checklist: Tarefas SMART**

- [ ] **T-REC-01 · Backend: Solicitação de recuperação** (4h)
  Endpoint `POST /auth/forgot-password` que gera token UUID com expiração de 1h, persiste no banco e dispara e-mail via fila. Resposta genérica (proteção contra enumeração). DoD: Token gerado e evento de e-mail publicado na fila.

- [ ] **T-REC-02 · Backend: Redefinição de senha** (4h)
  Endpoint `POST /auth/reset-password` que valida token, verifica expiração, aplica novo hash bcrypt e invalida tokens anteriores. DoD: Testes com token válido, expirado e já utilizado.

- [ ] **T-REC-03 · Frontend: Formulários de recuperação/redefinição** (4h)
  Formulário de solicitação (campo e-mail) e formulário de redefinição (nova senha + confirmação) com validação client-side. DoD: Fluxo completo funcional: solicitação → e-mail → link → redefinição → login.

---

### Card: HU-04 · Gestão de Perfil e Endereços

**Descrição:**
Como usuário autenticado, quero editar meus dados pessoais e gerenciar endereços de entrega, para manter informações atualizadas.

**Checklist: Tarefas SMART**

- [ ] **T-PERF-01 · Backend: CRUD de perfil e endereços** (6h)
  Endpoints `PUT /usuarios/:id` e CRUD de endereços (`POST/PUT/DELETE /usuarios/:id/enderecos`) com validação e marcação de endereço principal. Autorização: usuário só edita próprio perfil. DoD: Testes cobrindo CRUD completo e tentativa de edição de outro perfil retornando 403.

- [ ] **T-PERF-02 · Frontend: Página "Meu Perfil"** (8h)
  Página com edição inline dos dados pessoais, listagem de endereços com ações (adicionar, editar, remover, marcar como principal). DoD: Interface responsiva com edição funcional e atualização imediata.

- [ ] **T-PERF-03 · Frontend: Página pública do ateliê** (6h)
  Página pública do artesão com biografia, polo cultural, foto do ateliê e listagem de obras ativas com nota média. Endpoint `/artesaos/:id/perfil-publico`. DoD: Página acessível sem autenticação, refletindo dados atualizados.

---

## 🎨 ÉPICO 2: DESCOBERTA CULTURAL E VITRINE

---

### Card: HU-05 · Busca Textual no Catálogo

**Descrição:**
Como visitante ou comprador, quero pesquisar peças por palavras-chave (nome, artesão, região), para encontrar rapidamente o que procuro.

**Checklist: Tarefas SMART**

- [ ] **T-BUSCA-01 · Backend/BD: Endpoint de busca textual** (8h)
  Endpoint `GET /produtos/busca?q=termo` com busca por título, descrição e nome do artesão, ordenação por relevância e link para ateliê. Query com `ILIKE` ou Full Text Search + índice GIN/GiST. DoD: Testes com resultados, sem resultados e busca por nome de artesão.

- [ ] **T-BUSCA-02 · Frontend: Barra de busca** (4h)
  Componente de barra de busca na navbar com persistência do termo, ícone e atalho Enter. DoD: Busca funcional em todas as páginas com termo mantido.

- [ ] **T-BUSCA-03 · Frontend: Tela de resultados** (6h)
  Listagem de peças com cards, contador de resultados e estado vazio com mensagem e sugestão de termos populares. DoD: Cenários com e sem resultados renderizados corretamente.

---

### Card: HU-06 · Filtro por Região de Origem

**Descrição:**
Como comprador, quero filtrar peças por polo/região de origem de Pernambuco, para encontrar e valorizar produções de territórios culturais específicos.

**Checklist: Tarefas SMART**

- [ ] **T1 · Backend: Endpoint de consulta com filtros combinados** (8h)
  Query SQL/ORM e controller REST que retorna peças da região selecionada com combinação cumulativa com filtro de técnica. DoD: Testes dos Cenários 1 e 3, código de acesso a dados refatorado.

- [ ] **T2 · Frontend: Interface de seleção/remoção de filtros** (8h)
  Captura de clique, atualização de params na URL, renderização de cards e badges de filtros ativos. DoD: Usuário adiciona/remove filtros e tela atualiza conforme critérios de aceite.

- [ ] **T3 · Frontend: Tratamento de vitrine vazia** (4h)
  Componente de fallback com mensagem informativa e lista de regiões ativas quando resultado = 0. DoD: Mensagem e regiões vizinhas sem quebrar navegação.

- [ ] **T4 · Frontend: Badge "Esgotado" no card** (4h)
  Badge visual e bloqueio do botão de compra em produtos com estoque = 0. DoD: Produtos esgotados não disparam adição ao carrinho.

- [ ] **T5 · QA: Automação dos testes BDD** (16h)
  Steps de teste executáveis em Cypress/Playwright/Jest para todos os cenários de filtro. DoD: Cenários automatizados passando na pipeline.

- [ ] **T6 · Backend/BD: Benchmark de desempenho** (8h)
  Massa de 10.000 peças sintéticas + verificação de resposta < 250ms no P95. DoD: Relatório de tempo de resposta comprobatório.

---

### Card: HU-07 · Filtro por Técnica Artesanal

**Descrição:**
Como comprador, quero filtrar peças por técnica artesanal (Cerâmica, Renda, Xilogravura, etc.), para explorar obras de tradições que me interessam.

**Checklist: Tarefas SMART**

- [ ] **T-TEC-01 · Backend: Endpoint de listagem e filtro por técnica** (4h)
  Endpoint `GET /tecnicas` + suporte ao query param `?tecnica=` no endpoint de busca/filtro existente com combinação cumulativa. DoD: Testes com filtro isolado e combinação técnica + faixa de preço.

- [ ] **T-TEC-02 · Frontend: Painel de filtros por técnica e preço** (6h)
  Checkboxes de técnicas + slider/inputs de faixa de preço mín/máx integrados ao estado de filtros. DoD: Filtros cumulativos com contador de resultados atualizado em tempo real.

- [ ] **T-TEC-03 · Frontend: Integração de filtros combinados na URL** (4h)
  Sincronização bidirecional de estado de filtros (região + técnica + preço) com query params da URL (deep linking). DoD: Filtros refletidos na URL e restaurados ao acessar URL diretamente.

---

### Card: HU-08 · Visualização de Detalhes e Storytelling

**Descrição:**
Como comprador, quero visualizar a página completa de uma peça (fotos, ficha técnica, biografia do artesão, avaliações), para compreender o valor cultural antes da compra.

**Checklist: Tarefas SMART**

- [ ] **T-DET-01 · Backend: Endpoint de detalhes da peça** (6h)
  Endpoint `GET /produtos/:id` com fotos, ficha técnica (dimensões, peso, matéria-prima, tempo), dados do artesão (nome, polo, foto, biografia), nota média e indicador de estoque. DoD: Payload completo testado com e sem avaliações.

- [ ] **T-DET-02 · Frontend: Página de detalhes com galeria e storytelling** (8h)
  Galeria de fotos em carrossel, seção "Sobre o Mestre" com link para ateliê, ficha técnica e indicador "Última unidade!" DoD: Carrossel funcional, link para ateliê navegável.

- [ ] **T-DET-03 · Frontend: Seção de avaliações** (4h)
  Nota média com estrelas, listagem paginada de comentários e estado vazio ("Esta peça ainda não possui avaliações"). DoD: Seção correta com e sem avaliações.

---

## 🪵 ÉPICO 3: GESTÃO DO ATELIÊ E CATÁLOGO

---

### Card: HU-09 · Publicação de Nova Peça Artesanal

**Descrição:**
Como artesão homologado, quero cadastrar uma nova peça com título, descrição, técnica, preço, estoque, fotos e dados de feitura, para expor minha produção na vitrine.

**Checklist: Tarefas SMART**

- [ ] **T-PUB-01 · Backend: Endpoint de criação de peça** (6h)
  Endpoint `POST /produtos` com validação de campos, vínculo de técnica/polo e isolamento por artesão. Status inicial "Pendente de Moderação". DoD: Apenas artesãos homologados criam peças (teste de integração).

- [ ] **T-PUB-02 · Backend/Infra: Upload de fotos** (6h)
  Serviço de upload com validação de formato (JPG/PNG) e tamanho máximo (5MB), armazenamento local/S3 simulado e associação com entidade `Midia`. DoD: Upload vinculado à peça com sucesso.

- [ ] **T-PUB-03 · Frontend: Formulário de publicação** (8h)
  Formulário no painel do artesão com campos de dimensões, peso, técnica, pré-visualização de imagens e seleção de polo regional. DoD: Responsivo com preview de mídias e tratamento de erros.

---

### Card: HU-10 · Edição de Peça Já Publicada

**Descrição:**
Como artesão, quero editar dados de uma peça publicada (título, preço, fotos, descrição), para corrigir informações ou atualizar preços.

**Checklist: Tarefas SMART**

- [ ] **T-EDIT-01 · Backend: Endpoint de edição com regras de reaprovação** (6h)
  Endpoint `PUT /produtos/:id` — alteração de título/descrição/fotos reverte para "Pendente de Moderação"; preço mantém "Aprovada". Validação de propriedade. DoD: Testes de reaprovação por campo e bloqueio de edição por outro artesão (403).

- [ ] **T-EDIT-02 · Backend/BD: Auditoria de edições** (4h)
  Geração automática de log de auditoria (valores antigos vs. novos) com referência ao artesão e timestamp. Modelo `LogAuditoria`. DoD: Registro persistido para cada edição, consultável pelo admin.

- [ ] **T-EDIT-03 · Frontend: Formulário de edição com alertas** (6h)
  Formulário pré-preenchido com badges nos campos que exigem reaprovação e modal de confirmação antes da submissão. DoD: Artesão informado das consequências antes de submeter.

---

### Card: HU-11 · Gestão de Estoque do Ateliê

**Descrição:**
Como artesão, quero ajustar a quantidade disponível das minhas peças, para sincronizar o estoque digital com vendas presenciais ou novas produções.

**Checklist: Tarefas SMART**

- [ ] **T-EST-01 · Backend: Endpoint de atualização de estoque** (4h)
  Endpoint `PATCH /produtos/:id/estoque` com validação ≥ 0, atualização em tempo real e registro de auditoria (valores antigos/novos). DoD: Ajuste com auditoria, rejeição de negativo e reflexo na vitrine.

- [ ] **T-EST-02 · Backend: Notificação de estoque crítico** (4h)
  Serviço que detecta estoque = 1 e gera notificação ao artesão com flag "Última unidade". DoD: Notificação automática ao atingir 1, sem duplicatas.

- [ ] **T-EST-03 · Frontend: Interface de gestão de estoque** (6h)
  Listagem de peças no painel com destaque de estoque crítico, input numérico de quantidade e botão salvar. DoD: Destaque visual de peças com estoque = 1 e atualização otimista.

---

### Card: HU-12 · Painel de Vendas do Artesão

**Descrição:**
Como artesão, quero acompanhar pedidos com minhas peças (valores, status, dados do comprador), para organizar produção e despacho.

**Checklist: Tarefas SMART**

- [ ] **T-VEND-01 · Backend: Listagem de pedidos recebidos** (6h)
  Endpoint `GET /artesaos/:id/vendas` com joins Pedido/ItemPedido/Produto, filtrado pelo artesão autenticado, paginado e ordenado do mais recente. DoD: Listagem correta com ordenação cronológica reversa.

- [ ] **T-VEND-02 · Backend: Detalhamento de pedido** (4h)
  Endpoint `GET /artesaos/:id/vendas/:pedidoId` com endereço de entrega, itens do artesão e transições de status disponíveis. DoD: Payload com endereço e peças, sem itens de outros artesãos.

- [ ] **T-VEND-03 · Frontend: Painel "Minhas Vendas"** (8h)
  Listagem paginada de pedidos + página de detalhes com endereço, itens e botões de transição de status contextuais. DoD: Navegação entre listagem e detalhes funcional.

---

## 🛒 ÉPICO 4: CARRINHO E CHECKOUT CONCORRENTE

---

### Card: HU-13 · Gestão do Carrinho de Compras

**Descrição:**
Como comprador, quero adicionar, remover e alterar quantidade de peças no carrinho, para compor meu pedido antes da compra.

**Checklist: Tarefas SMART**

- [ ] **T-CART-01 · Backend: API do carrinho** (8h)
  Endpoints `POST /carrinho/itens` (adição com validação de estoque e ajuste ao máximo), `PUT /carrinho/itens/:id` (alteração) e `DELETE /carrinho/itens/:id` (remoção). Bloqueio de peça esgotada. DoD: Testes de adição, bloqueio, ajuste e remoção com recálculo.

- [ ] **T-CART-02 · Frontend: Página do carrinho** (8h)
  Listagem agrupada por artesão/ateliê, controle de quantidade, remoção, subtotais por artesão e valor total consolidado. DoD: Interface responsiva com agrupamento e totais corretos.

- [ ] **T-CART-03 · Frontend: Contador do carrinho na navbar** (4h)
  Ícone/badge numérica de itens na barra superior, atualizada em tempo real ao adicionar/remover. DoD: Badge atualizada em todas as páginas após operações.

---

### Card: HU-14 · Checkout com Baixa Atômica Concorrente

**Descrição:**
Como comprador, quero finalizar o pedido com garantia de reserva segura, para receber as peças sem risco de venda duplicada (overselling).

**Checklist: Tarefas SMART**

- [ ] **T-CHK-01 · Backend/BD: Transação com lock para débito atômico** (8h)
  Transação com Lock Otimista (ou Pessimista com `SELECT FOR UPDATE`) para débito atômico de estoque. Isolamento adequado contra race conditions. DoD: Testes de integração concorrentes sem estoque negativo.

- [ ] **T-CHK-02 · QA/FCCPD: Teste de estresse de concorrência** (8h)
  Script com 50 requisições simultâneas disputando 1 peça única. Exatamente 1 sucesso e 49 rejeições. DoD: Relatório de consistência e logs transacionais.

- [ ] **T-CHK-03 · Backend/Distribuído: Fila assíncrona pós-venda** (8h)
  Fila (RabbitMQ/Redis) para notificações pós-venda após confirmação da transação. Publicador na API + consumidor em worker. DoD: Evento publicado e consumido sem bloquear resposta HTTP.

---

## 📦 ÉPICO 5: CICLO DE VIDA DO PEDIDO

---

### Card: HU-15 · Acompanhamento de Pedido pelo Comprador

**Descrição:**
Como comprador, quero acompanhar o status dos meus pedidos (Confirmado → Em Preparação → Enviado → Entregue), para saber a situação atual.

**Checklist: Tarefas SMART**

- [ ] **T-ACOMP-01 · Backend: Endpoint de detalhes com timeline** (6h)
  Endpoint `GET /pedidos/:id` com timeline de transições de status, data/hora de cada transição e dados do artesão por item. Join com `HistoricoStatusPedido`. DoD: Payload com timeline e dados de artesão por item.

- [ ] **T-ACOMP-02 · Backend: Notificações de mudança de status** (6h)
  Sistema de notificações in-app disparado automaticamente ao artesão atualizar status. Modelo `Notificacao` (destinatário, mensagem, link, lida) + endpoint `GET /notificacoes`. DoD: Notificação criada na transição e listável com marcação de lida.

- [ ] **T-ACOMP-03 · Frontend: Página de acompanhamento com timeline** (8h)
  Timeline visual (stepper) com estados concluídos, atual e pendentes + data/hora + dados do artesão. Ícone de notificação na navbar. DoD: Timeline correta para todos os estados com badge de notificações.

---

### Card: HU-16 · Cancelamento de Pedido

**Descrição:**
Como comprador, quero cancelar um pedido que ainda não foi enviado, para desistir da compra caso mude de ideia.

**Checklist: Tarefas SMART**

- [ ] **T-CANC-01 · Backend: Endpoint de cancelamento** (6h)
  Endpoint `POST /pedidos/:id/cancelar` validando status cancelável ("Confirmado"/"Em Preparação"), restaurando estoque integralmente, alterando para "Cancelado" e gerando auditoria com motivo. DoD: Cancelamento com restauração, rejeição de "Enviado" e auditoria com motivo.

- [ ] **T-CANC-02 · Backend: Estorno simulado e notificação** (4h)
  Registro de pagamento marcado como "Estornado" + notificação ao(s) artesão(ões) via fila assíncrona. DoD: Pagamento estornado e artesão(ões) notificado(s) com motivo.

- [ ] **T-CANC-03 · Frontend: Modal de cancelamento** (4h)
  Modal com campo obrigatório de motivo, confirmação e feedback visual. Mensagem de bloqueio para pedidos já enviados/entregues. DoD: Modal com validação e mensagem de bloqueio conforme status.

---

### Card: HU-17 · Atualização de Status de Envio pelo Artesão

**Descrição:**
Como artesão, quero atualizar o status logístico dos pedidos com minhas peças, para informar ao comprador sobre preparação, envio e entrega.

**Checklist: Tarefas SMART**

- [ ] **T-STATUS-01 · Backend: Máquina de estados de pedido** (6h)
  Endpoint `PATCH /pedidos/:id/status` com validação de transições: Confirmado → Em Preparação → Enviado → Entregue. Rejeição de salto de etapa. Persistência de `HistoricoStatusPedido` com timestamp. DoD: Transição válida, rejeição de salto e histórico persistido.

- [ ] **T-STATUS-02 · Backend: Notificações por transição** (4h)
  Disparo automático de notificação ao comprador com mensagem contextualizada por estado ("Sendo preparado", "Foi despachada!"). DoD: Mensagem correta por transição entregue ao comprador.

- [ ] **T-STATUS-03 · Frontend: Botões de transição no painel** (6h)
  Botões contextuais renderizados conforme status atual no painel de vendas. Modal de confirmação + atualização otimista. DoD: Botões corretos por status, transição imediata na interface.

---

## ⭐ ÉPICO 6: AVALIAÇÃO E PÓS-VENDA

---

### Card: HU-18 · Avaliação de Peça Adquirida

**Descrição:**
Como comprador, quero registrar avaliação com nota (1-5) e comentário para peças adquiridas, para ajudar outros compradores e reconhecer o artesão.

**Checklist: Tarefas SMART**

- [ ] **T-AVAL-01 · Backend: Endpoints de avaliação** (6h)
  Endpoints `POST /produtos/:id/avaliacoes` e `PUT /avaliacoes/:id` com validações: pedido "Entregue", nota 1-5, comentário ≥ 10 caracteres, 1 avaliação por peça/pedido com opção de edição. DoD: Testes de avaliação, bloqueio de não entregue, bloqueio de duplicata e validação de comprimento.

- [ ] **T-AVAL-02 · Backend/BD: Recálculo de nota média** (4h)
  Recálculo automático de `notaMedia` na entidade `Produto` após inserção/edição de avaliação via trigger ou service hook. DoD: Nota média atualizada corretamente com teste de consistência numérica.

- [ ] **T-AVAL-03 · Frontend: Formulário de avaliação** (6h)
  Formulário condicional (visível apenas para compradores com pedido "Entregue"), seleção de estrelas, textarea e mensagem "Deseja editar?" para avaliação existente. DoD: Formulário para elegíveis, edição disponível e avaliação publicada imediatamente.

---

### Card: HU-19 · Consulta ao Histórico de Compras

**Descrição:**
Como comprador, quero consultar o histórico completo dos meus pedidos anteriores, para acompanhar aquisições e consultar detalhes.

**Checklist: Tarefas SMART**

- [ ] **T-HIST-01 · Backend: Listagem paginada de pedidos** (6h)
  Endpoint `GET /pedidos?status=&page=&limit=10` com pedidos do comprador autenticado, filtro por status, dados resumidos (número, data, valor, status, miniatura). DoD: Paginação e filtro por status com 15+ pedidos de teste.

- [ ] **T-HIST-02 · Frontend: Página "Meus Pedidos"** (6h)
  Listagem paginada com tabs/select de filtro por status (Todos, Confirmados, Enviados, Entregues, Cancelados) e navegação para detalhes. DoD: Responsiva com filtros e paginação corretos.

- [ ] **T-HIST-03 · Frontend: Card de pedido com miniatura** (4h)
  Componente reutilizável com miniatura da primeira peça, número do pedido, data, valor total e badge colorida por status. DoD: Cards com cores distintas por status e navegação funcional.

---

## 🛡️ ÉPICO 7: ADMINISTRAÇÃO E GOVERNANÇA

---

### Card: HU-20 · Moderação de Publicações de Peças

**Descrição:**
Como administrador, quero aprovar, recusar ou solicitar ajustes em peças pendentes, para garantir a autenticidade cultural do catálogo.

**Checklist: Tarefas SMART**

- [ ] **T-MOD-01 · Backend: Endpoints de aprovação/recusa** (6h)
  Endpoints `POST /admin/moderacao/:produtoId/aprovar` e `.../recusar` com justificativa obrigatória na recusa. Guard RBAC (admin), alteração de status, auditoria e publicação/ocultação na vitrine. DoD: Aprovação com publicação, recusa com justificativa e rejeição de recusa sem justificativa.

- [ ] **T-MOD-02 · Backend: Notificação ao artesão** (4h)
  Notificação automática com resultado: aprovação (mensagem de sucesso) ou recusa (com justificativa detalhada). Via fila assíncrona. DoD: Artesão notificado com mensagem correta.

- [ ] **T-MOD-03 · Frontend: Painel de moderação** (8h)
  Fila de peças pendentes com fotos, técnica, biografia do artesão e botões "Aprovar"/"Recusar" (com campo de justificativa obrigatório). DoD: Painel funcional com validação de justificativa.

---

### Card: HU-21 · Homologação de Cadastro de Artesão

**Descrição:**
Como administrador, quero validar cadastros de novos artesãos analisando polo, técnica, biografia e documentos, para assegurar autenticidade.

**Checklist: Tarefas SMART**

- [ ] **T-HOMOL-01 · Backend: Endpoints de homologação** (6h)
  Endpoints `POST /admin/homologacao/:artesaoId/aprovar` (status "Homologado" + libera publicação) e `.../solicitar-complemento` (mantém "Pendente" + registra pendências). Guard RBAC. DoD: Aprovação com acesso, complemento com pendências e bloqueio de publicação por não homologado.

- [ ] **T-HOMOL-02 · Backend: Notificação de resultado** (4h)
  Notificação automática: aprovação com boas-vindas ou solicitação de complemento com lista de pendências. DoD: Mensagem correta com pendências listadas (quando aplicável).

- [ ] **T-HOMOL-03 · Frontend: Painel de homologação** (6h)
  Fila de artesãos pendentes com biografia, polo, técnica, foto e botões "Aprovar"/"Solicitar Complemento". DoD: Dados completos e ações de homologação funcionais.

---

### Card: HU-22 · Dashboard de Indicadores Culturais e Comerciais

**Descrição:**
Como administrador, quero visualizar métricas consolidadas de vendas, artesãos, técnicas e regiões, para tomar decisões sobre curadoria e marketing.

**Checklist: Tarefas SMART**

- [ ] **T-DASH-01 · Backend/BD: Endpoints de métricas agregadas** (8h)
  Endpoint `GET /admin/dashboard?periodo=30d` com: artesãos ativos, peças aprovadas, volume de vendas (R$), ticket médio, top 5 técnicas e top 5 polos. Queries com `SUM`, `AVG`, `COUNT`, `GROUP BY`. DoD: Métricas corretas para períodos de 7, 30 e 90 dias.

- [ ] **T-DASH-02 · Frontend: Dashboard com gráficos** (8h)
  Cards de KPIs + gráficos de barras/pizza (Chart.js ou similar) para top 5 técnicas e polos. Layout responsivo de grid. DoD: Dashboard com dados reais e gráficos interativos.

- [ ] **T-DASH-03 · Frontend: Filtro de período** (4h)
  Selector de período (7d, 30d, 90d, personalizado) com atualização dinâmica de indicadores e gráficos. DoD: Recálculo correto ao alterar período.

---

### Card: HU-23 · Consulta aos Logs de Auditoria

**Descrição:**
Como administrador, quero consultar registros de auditoria de ações sensíveis (estoque, moderações, cancelamentos), para rastrear atividades irregulares.

**Checklist: Tarefas SMART**

- [ ] **T-AUDIT-01 · Backend/BD: Endpoint de consulta de logs** (6h)
  Endpoint `GET /admin/auditoria?acao=&periodo=&entidade=&page=` com filtros compostos. Cada registro: data/hora, ator, ação, entidade, dados antes/depois. Paginação e ordem cronológica reversa. DoD: Filtro por ação, período, paginação e payload com dados antes/depois.

- [ ] **T-AUDIT-02 · Backend: Exportação CSV** (4h)
  Endpoint `GET /admin/auditoria/exportar?acao=&periodo=` gerando CSV em streaming com cabeçalhos e encoding UTF-8 com BOM. DoD: CSV correto com acentos preservados no Excel.

- [ ] **T-AUDIT-03 · Frontend: Interface de auditoria** (8h)
  Tabela paginada de logs com filtros, acordeão de dados antes/depois e botão "Exportar CSV". DoD: Filtros aplicáveis, detalhes expandíveis e download funcional.

---

## 🧠 ÉPICO 8: INTELIGÊNCIA ARTIFICIAL

---

### Card: HU-24 · Recomendação Contextual de Peças Afins

**Descrição:**
Como comprador, quero ver sugestões de peças semelhantes baseadas em técnica, polo e comportamento de navegação, para descobrir outros mestres e obras afins.

**Checklist: Tarefas SMART**

- [ ] **T-IA-01 · IA/BD: Extração de features de produtos** (4h)
  Pipeline/query de extração de dados estruturados (técnica, polo, categoria, preço) em formato tabular para alimentar o serviço de recomendação. DoD: Dataset estruturado gerado e validado com dados sintéticos.

- [ ] **T-IA-02 · IA/Backend: Baseline de recomendação por similaridade** (8h)
  Algoritmo heurístico de ranking por similaridade de conteúdo (técnica + polo) e endpoint `/produtos/{id}/recomendados` retornando top-N peças afins. DoD: Endpoint funcional com teste unitário validando coerência.

- [ ] **T-IA-03 · Frontend: Seção "Você também pode gostar"** (4h)
  Componente na página de detalhes consumindo endpoint de recomendação com cards de peças e links diretos. DoD: Cards renderizados com links na vitrine.

---

### Card: HU-25 · Análise Automática de Sentimento de Avaliações

**Descrição:**
Como administrador, quero que o sistema classifique automaticamente o sentimento (Positivo/Neutro/Negativo) dos comentários, para monitorar satisfação e identificar artesãos que precisam de suporte.

**Checklist: Tarefas SMART**

- [ ] **T-SENT-01 · IA/Backend: Pipeline de classificação de sentimento** (8h)
  Processamento automático de texto via modelo NLP (BERT/Transformers ou API) após submissão de avaliação. Persistência do campo `sentimento`. Invocação assíncrona via fila. DoD: Acurácia ≥ 80% em 10+ avaliações de sentimento conhecido.

- [ ] **T-SENT-02 · Backend/BD: Alerta de avaliações negativas consecutivas** (4h)
  Detecção de 3+ avaliações consecutivas "Negativo" para um artesão → flag "Atenção Necessária" no perfil. DoD: Flag ativado com 3 negativas consecutivas, sem flag com avaliações mistas.

- [ ] **T-SENT-03 · Frontend: Seção "Atenção Necessária" no dashboard** (6h)
  Listagem de artesãos flagrados com avaliações negativas consolidadas e acordeão de visualização individual + link para perfil. DoD: Artesãos flagrados visíveis com avaliações negativas e navegação para perfil.

---

## 📊 Resumo para Criação de Cards no Trello

| Lista (Épico) | Cards (HUs) | Total de Itens de Checklist |
| :--- | :--- | :--- |
| 🔐 Identidade e Acesso | HU-01 a HU-04 (4 cards) | 12 tarefas |
| 🎨 Descoberta e Vitrine | HU-05 a HU-08 (4 cards) | 15 tarefas |
| 🪵 Gestão do Ateliê | HU-09 a HU-12 (4 cards) | 12 tarefas |
| 🛒 Carrinho e Checkout | HU-13 a HU-14 (2 cards) | 6 tarefas |
| 📦 Ciclo do Pedido | HU-15 a HU-17 (3 cards) | 9 tarefas |
| ⭐ Avaliação e Pós-Venda | HU-18 a HU-19 (2 cards) | 6 tarefas |
| 🛡️ Administração | HU-20 a HU-23 (4 cards) | 12 tarefas |
| 🧠 Inteligência Artificial | HU-24 a HU-25 (2 cards) | 6 tarefas |
| **TOTAL** | **25 cards** | **78 tarefas** |
