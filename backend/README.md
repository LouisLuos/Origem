# Origem: Backend Express + Prisma ORM + Worker Assíncrono

Servidor HTTP **Express** e camada de domínio, aplicação e persistência relacional do marketplace **Origem**, construído sob **Clean Architecture / Hexagonal (RNF-04)** com **TypeScript + Express + Prisma ORM + PostgreSQL (Supabase)**.

## Arquitetura em Camadas

```
backend/
├── prisma/
│   ├── schema.prisma        # Modelos PostgreSQL: User, Artisan, Product, Order, OrderItem, Notification, Review
│   └── seed.ts              # Carga idempotente (upsert) de polos, mestres, peças artesanais e contas bcrypt
├── src/
│   ├── domain/              # Entidades puras, invariantes, exceções e portas de repositório (zero acoplamento externo)
│   ├── application/         # Casos de uso ACID (StockReservationService, OrderCheckoutService) e NotificationWorkerService
│   ├── infrastructure/      # Adaptadores Prisma ORM, mappers e Lock Pessimista SQL (SELECT ... FOR UPDATE)
│   ├── presentation/http/   # Servidor Express, rotas /api/v1, controllers finos e handler global de erros
│   └── server.ts            # Bootstrap de produção com graceful shutdown e polling de recuperação da fila
└── tests/                   # Suíte automatizada Vitest + Supertest (Domínio, Concorrência 100x, Endpoints REST e Worker)
```

## Endpoints REST (`/api/v1`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/health` | Health check do servidor, banco PostgreSQL e worker assíncrono |
| `GET` | `/api/v1/produtos` | Catálogo paginado (`page`, `limit`, `technique`/`categoria`, `hub`) |
| `GET` | `/api/v1/produtos/:id` | Detalhe de peça artesanal |
| `POST` | `/api/v1/produtos` | Publicação de nova peça artesanal (`201`) |
| `PATCH` | `/api/v1/produtos/:id` | Atualização parcial de peça / estoque / visibilidade |
| `DELETE` | `/api/v1/produtos/:id` | Remoção de peça (`204`) |
| `POST` | `/api/v1/estoque/reservas` | Reserva e baixa atômica multi-item com Lock Pessimista (`SELECT ... FOR UPDATE`) |
| `GET` | `/api/v1/artesaos` | Perfis públicos de mestres e cooperativas (`q`/`nome`, `hub`, `technique`) com proteção LGPD |
| `GET` | `/api/v1/artesaos/:id` | Perfil público individual do artesão |
| `POST` | `/api/v1/artesaos` | Cadastro de novo perfil artesanal (`201`) |
| `GET` | `/api/v1/pedidos` | Listagem de pedidos (`?userEmail=...` opcional) |
| `GET` | `/api/v1/pedidos/:id` | Detalhe de pedido |
| `POST` | `/api/v1/pedidos` | Checkout transacional ACID + agendamento assíncrono na fila `notification` (`201`) |
| `GET` | `/api/v1/avaliacoes` | Depoimentos verificados da vitrine |

## Comandos Principais

```bash
cd backend
cp .env.example .env          # Configure DATABASE_URL apontando para seu PostgreSQL / Supabase
npm install
npm run prisma:generate       # Gera o cliente tipado @prisma/client
npm run prisma:db:push        # Sincroniza tabelas no banco PostgreSQL
npm run prisma:seed           # Executa carga inicial idempotente do acervo pernambucano
npm run dev                   # Inicia servidor Express em modo watch (http://localhost:3000/api/v1)
npm run typecheck             # Validação estrita do TypeScript (tsc --noEmit)
npm run build                 # Compila artefatos de produção em dist/
npm test                      # Executa toda a suíte Vitest + Supertest
```
