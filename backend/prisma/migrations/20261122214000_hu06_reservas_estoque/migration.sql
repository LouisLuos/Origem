-- HU-06 (T-LOT-01) e compatibilidade com HU-09 (T-RES-01):
-- Estrutura persistente de reservas de estoque com agrupamento atômico multi-item,
-- idempotência por comprador e controle estrito de ciclo de vida sem devolução duplicada.
-- Obs.: `public.pecas` já possui `quantidade_estoque INTEGER NOT NULL DEFAULT 1` e
-- `CHECK (quantidade_estoque >= 0)` aplicados em `20261121110000_hu03_hu04_hu05_acervo`.

-- CreateEnum
CREATE TYPE "StatusReserva" AS ENUM ('ATIVA', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "reservas_grupos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "peca_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "status" "StatusReserva" NOT NULL DEFAULT 'ATIVA',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" TIMESTAMP(3),
    "estoque_devolvido_em" TIMESTAMP(3),

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservas_grupos_usuario_id_idempotency_key_key" ON "reservas_grupos"("usuario_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "reservas_grupos_usuario_id_criado_em_idx" ON "reservas_grupos"("usuario_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_grupo_id_peca_id_key" ON "reservas"("grupo_id", "peca_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_usuario_id_idempotency_key_peca_id_key" ON "reservas"("usuario_id", "idempotency_key", "peca_id");

-- CreateIndex
CREATE INDEX "reservas_peca_id_status_idx" ON "reservas"("peca_id", "status");

-- CreateIndex
CREATE INDEX "reservas_status_expira_em_idx" ON "reservas"("status", "expira_em");

-- CreateIndex
CREATE INDEX "reservas_usuario_id_status_idx" ON "reservas"("usuario_id", "status");

-- AddForeignKey
ALTER TABLE "reservas_grupos" ADD CONSTRAINT "reservas_grupos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "reservas_grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "pecas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Regras de integridade não representáveis no schema Prisma (escritas à mão)
-- ---------------------------------------------------------------------------------------------

-- Índice parcial para varredura rápida de reservas ativas expiradas (15 minutos)
CREATE INDEX "reservas_ativas_expira_em_idx" ON "reservas"("expira_em") WHERE "status" = 'ATIVA';

-- Integridade de entrada, idempotência, TTL positivo e ciclo de vida sem devolução duplicada
ALTER TABLE "reservas_grupos" ADD CONSTRAINT "reservas_grupos_idempotency_key_check" CHECK (char_length(btrim("idempotency_key")) > 0);
ALTER TABLE "reservas_grupos" ADD CONSTRAINT "reservas_grupos_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "reservas" ADD CONSTRAINT "reservas_quantidade_check" CHECK ("quantidade" > 0);
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_expira_em_check" CHECK ("expira_em" > "criado_em");
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_idempotency_key_check" CHECK (char_length(btrim("idempotency_key")) > 0);
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_ciclo_vida_check" CHECK (
  ("status" = 'ATIVA' AND "finalizado_em" IS NULL AND "estoque_devolvido_em" IS NULL)
  OR ("status" = 'CONFIRMADA' AND "finalizado_em" IS NOT NULL AND "estoque_devolvido_em" IS NULL)
  OR ("status" IN ('CANCELADA', 'EXPIRADA') AND "finalizado_em" IS NOT NULL AND "estoque_devolvido_em" IS NOT NULL)
);

-- ---------------------------------------------------------------------------------------------
-- Segurança: novas tabelas sem acesso pela Data API do Supabase (anon/authenticated)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "reservas_grupos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservas" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON "reservas_grupos", "reservas" FROM %I', papel);
    END IF;
  END LOOP;
END $$;
