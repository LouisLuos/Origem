# Contratos da API (Fake API → backend da Avaliação 2)

A Fake API simula o backend real. O frontend a consome apenas por `frontend/src/services/`, então
trocar pelo backend da Avaliação 2 exige só ajustar `VITE_API_URL` e, se necessário, os services.

- **Base URL (produção):** `https://origem-bnhv.onrender.com/api/v1`
- **Base URL (local):** `http://localhost:3000/api/v1`
- **Código:** branch `fake-api`, pasta `fake_api/` (Node + Express, dados em memória).
- **Formato:** JSON. Listas voltam em `{ "dados": [...], "meta": {...} }`; erros em `{ "erro": "mensagem" }`.
- **Persistência:** em memória. Os dados voltam ao seed quando o serviço reinicia.

## Convenções

Paginação por query string: `page` (padrão 1) e `limit` (padrão 10 em produtos, 20 em artesãos).

```json
{
  "dados": [],
  "meta": { "totalItens": 3, "paginaAtual": 1, "totalPaginas": 1 }
}
```

| Status | Uso |
|---|---|
| 200 | Consulta ou atualização bem-sucedida |
| 201 | Recurso criado |
| 204 | Remoção bem-sucedida (sem corpo) |
| 400 | Campo obrigatório ausente (`{ "erro": "Campo obrigatório: title." }`) |
| 404 | Recurso ou endpoint inexistente |
| 409 | Conflito (e-mail já cadastrado, estoque insuficiente, peça indisponível) |

## Produtos

### Modelo `Produto`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | gerado (`api-…`) | Identificador |
| `title` | string | sim | Nome da peça |
| `artisan` | string | sim | Nome do artesão ou da associação |
| `hub` | string | sim | Polo cultural |
| `technique` | string | sim | Técnica artesanal |
| `price` | number | sim | Preço em reais |
| `imageUrl` / `imageAlt` | string | sim | Imagem e texto alternativo |
| `description` | string | não | Descrição da peça |
| `details` | string[] | não | Detalhes da peça |
| `ownerEmail` | string | sim | E-mail da conta do artesão dono da peça |
| `stock` | number | sim | Unidades em estoque |
| `active` | boolean | não (padrão `true`) | Peças pausadas ficam fora da vitrine |

### Rotas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/produtos` | Lista paginada. Filtro opcional: `technique` (ou `categoria`), comparação exata sem diferenciar maiúsculas. |
| GET | `/produtos/:id` | Detalhe de um produto. 404 se não existir. |
| POST | `/produtos` | Cria um produto (201). 400 se faltar campo obrigatório. |
| PATCH | `/produtos/:id` | Atualiza campos parciais (200). 404 se não existir. |
| DELETE | `/produtos/:id` | Remove o produto (204). 404 se não existir. |

## Estoque

| Método | Rota | Descrição |
|---|---|---|
| POST | `/estoque/reservas` | Baixa o estoque de um pedido, tudo ou nada. |

Requisição:

```json
{ "lines": [{ "productId": "api-101", "quantity": 2 }] }
```

Resposta 200: `{ "dados": [ ...todos os produtos com o estoque atualizado ] }`.
Resposta 400 se `lines` estiver vazio ou ausente. Resposta 409 se alguma peça estiver
inativa ou inexistente, ou sem saldo (`"Estoque insuficiente para <título>."`); nesse caso nada é alterado.

## Artesãos

### Modelo `Artesao`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | gerado (`a-…`) | Identificador |
| `name` | string | sim | Nome |
| `hub` | string | sim | Polo cultural |
| `technique` | string | sim | Técnica |
| `bio` | string | sim | Biografia |
| `since` | number | sim | Ano de início no ofício |
| `photoUrl` / `photoAlt` | string | sim | Foto de perfil |
| `coverUrl` / `coverAlt` | string | sim | Imagem de capa |
| `email` | string | não | E-mail da conta (único, normalizado em minúsculas) |

### Rotas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/artesaos` | Lista paginada. Filtros: `q` (ou `nome`, busca em nome, polo e técnica), `hub`, `technique`. |
| GET | `/artesaos/:id` | Detalhe de um artesão. 404 se não existir. |
| POST | `/artesaos` | Cadastra um artesão (201). 400 se faltar campo; 409 se o e-mail já existir. |

## Recursos ainda simulados no frontend

Estes recursos ainda não têm endpoint e usam `localStorage` nos services. Devem virar rotas na Avaliação 2:

| Recurso | Service | Rota prevista |
|---|---|---|
| Usuários e autenticação | `authService` | `POST /auth/login`, `POST /auth/cadastro`, `GET /usuarios` |
| Pedidos | `orderService` | `GET/POST /pedidos`, `GET /pedidos/:id` |
| Carrinho | `cartService` | `GET/PUT /carrinho` |
| Avaliações | `reviewService` | `GET /avaliacoes` |
| Técnicas e polos | `design-system/tokens.ts` | `GET /tecnicas`, `GET /regioes` |
