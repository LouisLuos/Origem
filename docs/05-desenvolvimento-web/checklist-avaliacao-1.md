# Checklist — Escopo mínimo da Avaliação 1

Acompanhamento do escopo mínimo exigido para a primeira avaliação. Marcar `[x]`
conforme cada item for implementado no projeto.

| Status | Área | O que deve aparecer na entrega | Observações |
|---|---|---|---|
| [x] | Vitrine | Página inicial ou listagem de produtos. | `Home` com `FeaturedShowcase` (grade de produtos mock) e `CategoryShowcase` (carrossel de categorias). |
| [x] | Busca e filtros | Busca por produto, técnica, região ou categoria. | Busca do `Header` com dropdown de resultados em tempo real, filtro lateral por técnica/polo/preço em `ProductFilters` e ordenação em `FeaturedShowcase`, tudo via `ProductFilterContext`. |
| [x] | Produto | Página de detalhes do produto. | Rota `/produtos/:id` (`ProductDetail`) com galeria, preço, seletor de quantidade, adicionar ao carrinho/favoritar, detalhes da peça, sobre o artesão e peças relacionadas. `ProductCard` e o dropdown de busca do `Header` linkam para ela. |
| [x] | Artesão | Perfil do artesão com dados básicos e produtos relacionados. | Rota `/artesaos/:id` (`ArtisanProfile`) com capa, avatar, bio, estatísticas (anos de ofício, peças na loja) e grade de peças do artesão. `ArtisanSpotlight` e a página de produto linkam para ela. |
| [x] | Carrinho | Adicionar, remover e visualizar itens. | Rota `/carrinho` (`Cart`) lista os itens com imagem, seletor de quantidade e remoção, além de resumo (subtotal, frete grátis acima de R$250, total). `CartContext` agora expõe `addItem`/`removeItem`/`setQuantity`/`clearCart`; ícone do `Header` linka para a página. |
| [ ] | Pedido | Fluxo inicial de pedido ou simulação de compra. | Não iniciado. |
| [ ] | Comprador | Área inicial ou fluxo mínimo do comprador. | Não iniciado (ícone de conta no `Header` sem funcionalidade). |
| [ ] | Artesão (painel) | Área inicial para catálogo, produtos ou estoque. | Não iniciado. |
| [ ] | Administração | Estrutura inicial de painel administrativo. | Não iniciado. |
| [ ] | Dados | Consumo por Fake API estruturada e services. | Dados hoje vêm de mocks estáticos locais (`src/data/mockProducts.ts`, `src/data/mockArtisans.ts`), sem camada de services nem Fake API. |
| [ ] | Publicação | Deploy público da aplicação. | Sem configuração de deploy (Vercel/Netlify/CI) no repositório ainda. |

## Progresso

**5 / 11** itens concluídos.

## Notas de contexto

- O front-end atual (`/frontend`) cobre apenas a Design System e a vitrine
  principal da home (Hero, categorias, produtos em destaque, artesãos em
  destaque, newsletter e footer) — ver `frontend/src/pages/Home.tsx`.
- Não existe backend/API no repositório ainda (`/docs/05-desenvolvimento-web`
  está com apenas um `.gitkeep`), então os itens de Dados, Carrinho, Pedido,
  Comprador, painel do Artesão e Administração dependem dessa camada.
- Atualize este arquivo manualmente conforme cada item for implementado,
  marcando o checkbox correspondente e ajustando o contador de progresso.
