# Checklist de telas do frontend · Origem

**Atualizado em:** 23/11/2026 · **Base verificada:** `feat/frontend-next` no commit `22b0afc`
**Referência das telas:** documento de sugestões de telas e fluxos UX/UI (T01 a T22)
**Padrão visual:** `frontend/DESIGN_SYSTEM.md` (seção 5, "Montando uma tela nova")

Este checklist foi feito a partir do código, não do Jira. Uma tela só conta como **pronta** quando existe e usa a API real do backend; dados fixos, simulados ou salvos só no navegador contam como **parcial**.

## Resumo

| Situação | Qtd. | Telas |
|---|---|---|
| Pronta | 4 | T04, T11, T18, T19 |
| Parcial | 11 | T01, T02, T03, T05, T07, T08, T09, T12, T20, T21, T22 |
| Feita em branch, aguardando merge | 2 | T06, T10 |
| Não existe | 5 | T13, T14, T15, T16, T17 |

## Antes de começar: branches com trabalho pronto e não juntado

Juntar estas branches na `feat/frontend-next` evita refazer trabalho. Cada uma depende de migration aplicada no banco (ver o card da HU no Jira).

- [ ] `feat/hu-07-vitrine-busca-fts`: busca textual no servidor (FTS), filtros e frete por CEP no detalhe da peça. Resolve boa parte de T02 e T03.
- [ ] `feat/hu-11-livro-enderecos`: livro de endereços e escolha de endereço salvo no checkout (T10 e parte de T09).
- [ ] `feat/hu-02-recuperacao-senha`: "Esqueci minha senha", `/recuperar-senha` e `/redefinir-senha` (T06 e parte de T05). **Não juntar sem a migration:** o login passa a depender de uma coluna nova.

## Telas prontas

- [x] **T04 · Perfil público do artesão:** `views/ArtisanProfile.tsx` (`/artesaos/:id`)
- [x] **T11 · Confirmação do pedido:** `views/OrderConfirmation.tsx` (`GET /pedidos/:id`, acompanha o status do Pix). Ainda não mostra subpedidos (ver T12).
- [x] **T18 · Configuração do ateliê:** `components/AtelierSetupForm.tsx`
- [x] **T19 · Perfil do artesão, Pix e curadores:** `ArtisanOnboardingForm`, `FinancialPixSection`, `CuratorManagementSection`

## Telas parciais

### Comprador

- **T01 · Vitrine pública**: catálogo real (`GET /produtos`)
  - [ ] Trocar os depoimentos fixos (`services/reviewService.ts`, mock) por dados reais ou remover a seção
- **T02 · Busca e filtros**
  - [ ] Busca e filtros rodam no navegador, só sobre os 100 primeiros produtos (`limit=100`). Passar a filtrar no servidor (`hub`, `technique` e, depois da HU-07, texto)
  - [ ] Página de resultados própria (hoje só existe o dropdown do Header)
  - [ ] Estado vazio com "limpar filtros" usando `EmptyState`
- **T03 · Detalhe da peça**: galeria, estoque e artesão OK
  - [ ] Mostrar dimensões/cubagem e fragilidade
  - [ ] Cotação de frete por CEP (pronta na branch da HU-07)
  - [ ] Remover as imagens sintéticas geradas quando a peça não tem galeria (`getProductGalleryImages`)
- **T05 · Login e cadastro**
  - [ ] Mensagem própria para o bloqueio após 5 tentativas (HTTP 429, código `LOGIN_BLOQUEADO`): avisar os 15 minutos e desabilitar o botão
  - [ ] Link "Esqueci minha senha" (pronto na branch da HU-02)
- **T07 · Carrinho multi-origem**
  - [ ] Agrupar pelo `atelieId`, não pelo nome do artesão (hoje dois ateliês com o mesmo nome se misturam)
  - [ ] Mostrar o frete por grupo no carrinho (hoje aparece "Calculado no checkout"; a API `POST /pedidos/cotar-frete` existe)
  - O carrinho continua salvo no navegador: não há API de carrinho no backend
- **T08 · Reserva de 15 minutos**
  - [ ] O relógio do carrinho é só local (900 s fixos) e não corresponde a nenhuma reserva no servidor. Remover do carrinho ou mostrar só depois da reserva real; no checkout o relógio já é real
- **T09 · Checkout e pagamento**: fluxo real com reserva, cotação, Pix e cartão
  - [ ] Etapa de revisão separada antes do pagamento
  - [ ] Escolha de endereço salvo (pronta na branch da HU-11)
- **T12 · Pedidos do comprador**: lista real (`GET /pedidos/meus`) em `views/Account.tsx`
  - [ ] Detalhe do pedido com um cartão por ateliê (subpedido). **Bloqueado:** o backend ainda não tem o modelo de subpedido

### Artesão

- **T20 · Catálogo e nova peça**: criar peça funciona (`POST /atelies/:id/pecas`)
  - [ ] **Bug:** editar, ativar/desativar e remover peça chamam `PATCH`/`DELETE /produtos/:id`, que não existem (erro 404). Ver `services/artisanCatalogService.ts` e `views/ArtisanPanel.tsx`. **Bloqueado:** precisa de rota no backend para editar e remover peça
  - [ ] Tirar do painel a mistura de `pieceService` com o `useCatalog` legado
- **T21 · Lotes e estoque**: ajuste de estoque real
  - [ ] Visão de lotes. **Bloqueado:** não existe modelo de lote no backend

### Administrador

- **T22 · Painel administrativo**: lista de usuários real (`GET /auth/users`)
  - [ ] **Bug:** a aba de pedidos usa `/pedidos/meus` e mostra só os pedidos do próprio admin
  - [ ] **Bug:** a moderação do catálogo usa as mesmas rotas inexistentes de T20
  - [ ] Auditoria, sinistros e métricas reais. **Bloqueado:** não há rotas de admin no backend

## Telas que não existem

### Dá para fazer agora (a API já existe)

- [ ] **T17 · Central de notificações:** `GET /notificacoes/minhas` (autenticado). Criar o service, a página e o acesso pelo Header. Filtros e "não lida" ainda não existem na API
  - Componentes: `SectionTitle`, `Badge` de status, `EmptyState`, `LoadingBlock`/`ErrorBlock`

### Bloqueadas pelo backend (dá para desenhar, não para integrar)

- [ ] **T13 · Rastreamento e prazo de postagem:** sem rotas de rastreio
- [ ] **T14 · Custódia e repasse (D+7):** só existe `GET /atelies/:id/financeiro` (resumo)
- [ ] **T15 · Registro de avaria (até 48 h, com fotos):** sem rotas
- [ ] **T16 · Devolução / arrependimento (7 dias):** sem rotas; hoje só há o texto "7 dias para troca" no detalhe da peça

## Bugs encontrados

- [ ] Editar, desativar e remover peça (painel do artesão e admin) dão 404: as rotas `PATCH`/`DELETE /produtos` não existem
- [ ] Admin vê só os próprios pedidos (`/pedidos/meus`), não os da plataforma
- [ ] Carrinho mostra "Reserva ativa (15 min)" sem reserva no servidor
- [ ] Carrinho agrupa pelo nome do artesão em vez do `atelieId`
- [ ] Busca e filtros consideram só os 100 primeiros produtos
- [ ] Depoimentos da home são dados fixos
- [ ] `artisanService.create` chama `POST /artesaos`, que não existe (código sem uso; pode ser removido)

## Ordem sugerida

1. Juntar as branches da HU-07, HU-11 e HU-02 (depende das migrations)
2. **T17 · Notificações**: única tela nova que não depende de backend
3. **T05**: mensagem de bloqueio do login
4. **T07 e T08**: agrupamento por ateliê, frete por grupo e relógio do carrinho
5. **T02 e T03**: completar depois da HU-07
6. Pedir ao backend as rotas que destravam T20, T22, T12 e T13 a T16
