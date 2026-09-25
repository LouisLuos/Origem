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
| [x] | Dados | Consumo por Fake API estruturada e services. | `catalogService` consome `GET/POST/PATCH/DELETE /api/v1/produtos` e `POST /api/v1/estoque/reservas`, e `artisanService` consome `/api/v1/artesaos`, ambos via `fetch`, com `VITE_API_URL` configurável. Carrinho (`cartService`), pedidos, autenticação e avaliações (`reviewService`) mantêm as simulações locais previstas para esta etapa. Os contextos consomem os services via `useResource` e as telas tratam carregamento/erro (`AsyncState`). |
| [x] | Publicação | Deploy público da aplicação. | Frontend publicado na Vercel (https://origem-five.vercel.app; configuração em `frontend/vercel.json`) e Fake API publicada na Render (https://origem-bnhv.onrender.com/api/v1). |

## Progresso

**11 / 11** itens concluídos.

## Checklist detalhado da aplicação

### Frontend responsivo e navegação

- [x] As telas principais foram implementadas (`Home`, produto, artesão, carrinho, checkout, conta, login e painéis).
- [x] A vitrine de produtos está funcional e alimentada pelo `CatalogContext`.
- [x] A busca e os filtros estão presentes no `Header`, `ProductFilterContext` e `ProductFilters`.
- [x] O perfil do artesão pode ser acessado pela rota `/artesaos/:id`.
- [x] O carrinho permite adicionar itens.
- [x] O carrinho permite remover itens.
- [x] O carrinho permite visualizar e alterar quantidades.
- [x] A navegação entre telas possui rotas protegidas, rota de produto e fallback `NotFound`.
- [x] O layout possui breakpoints para desktop e mobile nas telas principais.

### Fake API e preparação para integração

- [x] O frontend consome dados por uma camada organizada em `src/services/`.
- [x] As páginas não acessam diretamente a API nem armazenam produtos fixos localmente.
- [x] Produtos, estoque, criação, atualização, remoção e reserva de estoque estão simulados na Fake API.
- [x] Existem contratos e rotas REST em `/api/v1` para a Avaliação 2, documentados em [`contratos-api.md`](./contratos-api.md).
- [x] Há tratamento de loading com `LoadingBlock` e `useResource`.
- [x] Há tratamento de erro com `ErrorBlock`, mensagens da API e ação de retry.
- [x] Há tratamento de estados vazios na vitrine, favoritos e carrinho.
- [x] A Fake API está publicada e organizada em servidor, rotas, controllers e banco de dados em memória com arrays. O código dela fica na branch `fake-api` (pasta `fake_api/`) e foi removido da `main` no commit `0b7e7f9`.
- [x] A aplicação está publicada em ambiente externo.

## Notas de contexto

- Em produção, o frontend consome a Fake API em `https://origem-bnhv.onrender.com/api/v1`; localmente o padrão é `http://localhost:3000/api/v1`.
- Defina `VITE_API_URL` no ambiente do frontend (Vercel) quando a API estiver em outro endereço; a variável é embutida no build e exige novo deploy.
- Os dados da Fake API ficam em memória e voltam ao seed (3 produtos, 7 artesãos) quando a Render reinicia.
- Pedidos e autenticação ainda usam os services locais (localStorage); somente catálogo, estoque e artesãos estão conectados à Fake API nesta etapa.
- O deploy público foi realizado e está acessível para avaliação.
