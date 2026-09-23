# Checklist — Escopo mínimo da Avaliação 1

Acompanhamento do escopo mínimo exigido para a primeira avaliação. Marcar `[x]`
conforme cada item for implementado no projeto.

| Status | Área | O que deve aparecer na entrega | Observações |
|---|---|---|---|
| [x] | Vitrine | Página inicial ou listagem de produtos. | `Home` com `FeaturedShowcase` (grade de produtos mock) e `CategoryShowcase` (carrossel de categorias). |
| [ ] | Busca e filtros | Busca por produto, técnica, região ou categoria. | Campo de busca no `Header` é apenas visual (sem lógica de busca/filtro ligada aos dados). |
| [ ] | Produto | Página de detalhes do produto. | Não há rota/página de detalhe — só o card na vitrine. |
| [ ] | Artesão | Perfil do artesão com dados básicos e produtos relacionados. | `ArtisanSpotlight` mostra cards na home, sem página de perfil individual. |
| [ ] | Carrinho | Adicionar, remover e visualizar itens. | Ícone de carrinho no `Header` é estático ("0 itens"), sem estado nem interação. |
| [ ] | Pedido | Fluxo inicial de pedido ou simulação de compra. | Não iniciado. |
| [ ] | Comprador | Área inicial ou fluxo mínimo do comprador. | Não iniciado (ícone de conta no `Header` sem funcionalidade). |
| [ ] | Artesão (painel) | Área inicial para catálogo, produtos ou estoque. | Não iniciado. |
| [ ] | Administração | Estrutura inicial de painel administrativo. | Não iniciado. |
| [ ] | Dados | Consumo por Fake API estruturada e services. | Dados hoje vêm de mocks estáticos locais (`src/data/mockProducts.ts`, `src/data/mockArtisans.ts`), sem camada de services nem Fake API. |
| [ ] | Publicação | Deploy público da aplicação. | Sem configuração de deploy (Vercel/Netlify/CI) no repositório ainda. |

## Progresso

**1 / 11** itens concluídos.

## Notas de contexto

- O front-end atual (`/frontend`) cobre apenas a Design System e a vitrine
  principal da home (Hero, categorias, produtos em destaque, artesãos em
  destaque, newsletter e footer) — ver `frontend/src/pages/Home.tsx`.
- Não existe backend/API no repositório ainda (`/docs/05-desenvolvimento-web`
  está com apenas um `.gitkeep`), então os itens de Dados, Carrinho, Pedido,
  Comprador, painel do Artesão e Administração dependem dessa camada.
- Atualize este arquivo manualmente conforme cada item for implementado,
  marcando o checkbox correspondente e ajustando o contador de progresso.
