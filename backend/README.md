# Origem: Backend & Persistência Relacional (Prisma ORM + PostgreSQL)

Camada de domínio, aplicação e persistência relacional do marketplace **Origem**, construída sob **Clean Architecture / Hexagonal (RNF-04)** com **TypeScript + Prisma ORM + PostgreSQL (Supabase)**.

## Arquitetura em Camadas

```
backend/
├── prisma/
│   ├── schema.prisma        # Modelos PostgreSQL: User, Artisan, Product, Order, OrderItem, Notification, Review
│   └── seed.ts              # Carga idempotente (upsert) de polos, mestres, peças artesanais e contas bcrypt
├── src/
│   ├── domain/              # Entidades puras, invariantes, exceções e portas de repositório (zero acoplamento externo)
│   ├── application/         # Casos de uso ACID (StockReservationService, OrderCheckoutService) e DTOs Zod
│   └── infrastructure/      # Adaptadores Prisma ORM, mappers e Lock Pessimista SQL (SELECT ... FOR UPDATE)
└── tests/                   # Suíte automatizada Vitest (Clean Arch, Lock Pessimista, Concorrência 100x, LGPD, Seed)
```

## Garantias de Engenharia (RNF-01, RNF-05 & LGPD)

1. **Controle de Concorrência Pessimista (RNF-01 / Rubrica FCCPD):**
   - `PrismaProductRepository.findByIdForUpdate` executa consulta parametrizada `SELECT ... FROM "product" WHERE "id" = $1 FOR UPDATE` dentro de `prisma.$transaction`.
   - `StockReservationService` consolida e ordena os `productId`s alfabeticamente antes de bloquear as tuplas, eliminando *deadlocks* em carrinhos multi-item concorrentes.
2. **Fila Durável de Mensageria Assíncrona (RNF-05 / Rubrica FCCPD):**
   - `OrderCheckoutService` persiste registros `Notification` com status `'pending'` na mesma transação ACID do pedido (*Transactional Outbox*), liberando o retorno imediatamente sem aguardar envio externo.
3. **Privacidade e LGPD (Lei nº 13.709/2018):**
   - Senhas armazenadas exclusivamente como hash `bcryptjs`.
   - Dados de contato direto e endereço físico de ateliês (`Artisan.toPublicProfileDto()`) permanecem ocultos por padrão e só são expostos mediante `publicContactConsent = true`.

## Comandos Principais

```bash
cd backend
cp .env.example .env          # Configure DATABASE_URL apontando para seu PostgreSQL / Supabase
npm install
npm run prisma:validate       # Valida o schema.prisma
npm run prisma:generate       # Gera o cliente tipado @prisma/client
npm run prisma:db:push        # Sincroniza tabelas no banco PostgreSQL (ou prisma:migrate:dev)
npm run prisma:seed           # Executa carga inicial idempotente do acervo pernambucano
npm run typecheck             # Validação estrita do TypeScript (tsc --noEmit)
npm run build                 # Compila artefatos de produção em dist/
npm test                      # Executa a suíte de testes automatizados (Vitest)
```

