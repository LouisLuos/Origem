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
| [x] | Pedido | Fluxo inicial de pedido ou simulação de compra. | Botão "Finalizar compra" do carrinho leva a `/checkout` (`Checkout`): dados do comprador, endereço de entrega com validação, forma de pagamento simulada (Pix/cartão/boleto) e resumo com frete (R$24,90, grátis acima de R$250). Ao confirmar, `OrderContext` registra o pedido em memória, o carrinho é esvaziado e o usuário vai para `/pedido/:id` (`OrderConfirmation`). |
| [x] | Comprador | Área inicial ou fluxo mínimo do comprador. | `/entrar` (`Login`) com login e cadastro simulados (`AuthContext`, contas no localStorage) e `/conta` (`Account`) com histórico de pedidos e edição do nome. Ícone de conta do `Header` leva a uma das duas; o checkout pré-preenche nome/e-mail e vincula o pedido à conta. Pedidos agora persistem no localStorage. |
| [x] | Artesão (painel) | Área inicial para catálogo, produtos ou estoque. | Rota `/painel` (`ArtisanPanel`), restrita a contas de artesão (cadastro com "Sou artesão(ã)" ou conta demo `artesao@origem.com` / `origem123`): resumo (peças ativas, unidades, estoque baixo, esgotadas), cadastro/edição/remoção de peças, pausar/reativar e ajuste de estoque +/−. o catálogo vem de `CatalogContext`/`catalogService`; alimenta a vitrine pública via `catalogService` (peças pausadas ficam ocultas; estoque zerado aparece como "Esgotado"). |
| [x] | Administração | Estrutura inicial de painel administrativo. | Rota `/admin` (`AdminPanel`), restrita ao perfil `admin` (conta demo `admin@origem.com` / `origem123`; não há cadastro público de administrador). Navegação lateral com Visão geral (métricas e pedidos recentes), Usuários, Pedidos e Catálogo (pausar/remover peças de qualquer artesão). Dados vêm do localStorage. |
| [x] | Dados | Consumo por Fake API estruturada e services. | Camada `src/services/` (`catalogService`, `artisanService`, `orderService`, `authService`, com persistência em `storage.ts`) expõe funções assíncronas com latência simulada, equivalentes a endpoints REST (`GET /produtos`, `POST /pedidos` etc.). Os contextos (`CatalogContext`, `ArtisanContext`, `OrderContext`, `AuthContext`) consomem os services via `useResource` e as telas tratam carregamento/erro (`AsyncState`). O catálogo é a fonte única da vitrine e dos painéis do artesão e da administração; pedidos baixam o estoque e falham se não houver saldo. Sem backend: os dados vêm dos mocks (`src/data/`) e do localStorage. |
| [ ] | Publicação | Deploy público da aplicação. | Sem configuração de deploy (Vercel/Netlify/CI) no repositório ainda. |

## Progresso

**10 / 11** itens concluídos.

## Notas de contexto

- O front-end atual (`/frontend`) cobre apenas a Design System e a vitrine
  principal da home (Hero, categorias, produtos em destaque, artesãos em
  destaque, newsletter e footer) — ver `frontend/src/pages/Home.tsx`.
- Não existe backend/API no repositório ainda (`/docs/05-desenvolvimento-web`
  está com apenas um `.gitkeep`), então os itens de Dados, Carrinho, Pedido,
  Comprador, painel do Artesão e Administração dependem dessa camada.
- Atualize este arquivo manualmente conforme cada item for implementado,
  marcando o checkbox correspondente e ajustando o contador de progresso.
