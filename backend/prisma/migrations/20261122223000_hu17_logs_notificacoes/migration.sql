-- HU-17 (T-NOT-01):
-- Tabela de auditoria e rastreamento idempotente de notificações transacionais multicanal
-- (EMAIL e WHATSAPP), compatível com PostgreSQL/Supabase e preparada para vínculo futuro
-- com `pedidos` (HU-10) e `subpedidos` (HU-12/HU-13) via colunas UUID anuláveis.
-- Privacidade/LGPD: não armazena segredos, tokens nem corpo sensível de mensagens;
-- `destinatario` deve receber representação mascarada e `erro_sanitizado` apenas erro tratado.

-- CreateEnum
CREATE TYPE "CanalNotificacao" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM (
    'ENFILEIRADA',
    'PROCESSANDO',
    'ENVIADA',
    'FALHA_TRANSITORIA',
    'FALHA_PERMANENTE',
    'IGNORADA'
);

-- CreateTable
CREATE TABLE "logs_notificacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evento_origem" VARCHAR(80) NOT NULL,
    "pedido_id" UUID,
    "subpedido_id" UUID,
    "usuario_id" UUID,
    "atelie_id" UUID,
    "destinatario" VARCHAR(160) NOT NULL,
    "canal" "CanalNotificacao" NOT NULL,
    "template" VARCHAR(80) NOT NULL,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'ENFILEIRADA',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "max_tentativas" INTEGER NOT NULL DEFAULT 5,
    "provedor" VARCHAR(40),
    "provedor_mensagem_id" VARCHAR(160),
    "erro_codigo" VARCHAR(64),
    "erro_sanitizado" VARCHAR(500),
    "idempotency_key" VARCHAR(160) NOT NULL,
    "job_id" VARCHAR(160),
    "correlation_id" VARCHAR(128),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_tentativa_em" TIMESTAMP(3),
    "proxima_tentativa_em" TIMESTAMP(3),
    "enviado_em" TIMESTAMP(3),
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "logs_notificacoes_idempotency_key_key" ON "logs_notificacoes"("idempotency_key");

-- CreateIndex
CREATE INDEX "logs_notificacoes_pedido_id_idx" ON "logs_notificacoes"("pedido_id");

-- CreateIndex
CREATE INDEX "logs_notificacoes_subpedido_id_idx" ON "logs_notificacoes"("subpedido_id");

-- CreateIndex
CREATE INDEX "logs_notificacoes_usuario_id_criado_em_idx" ON "logs_notificacoes"("usuario_id", "criado_em");

-- CreateIndex
CREATE INDEX "logs_notificacoes_atelie_id_criado_em_idx" ON "logs_notificacoes"("atelie_id", "criado_em");

-- CreateIndex
CREATE INDEX "logs_notificacoes_status_criado_em_idx" ON "logs_notificacoes"("status", "criado_em");

-- CreateIndex
CREATE INDEX "logs_notificacoes_evento_origem_canal_idx" ON "logs_notificacoes"("evento_origem", "canal");

-- AddForeignKey (somente para entidades que já existem no schema real)
ALTER TABLE "logs_notificacoes" ADD CONSTRAINT "logs_notificacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_notificacoes" ADD CONSTRAINT "logs_notificacoes_atelie_id_fkey" FOREIGN KEY ("atelie_id") REFERENCES "atelies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Regras de integridade não representáveis no schema Prisma (escritas à mão)
-- ---------------------------------------------------------------------------------------------

-- Índice parcial para monitoramento e reconciliação de retentativas pendentes
CREATE INDEX "logs_notificacoes_falhas_pendentes_idx" ON "logs_notificacoes"("proxima_tentativa_em") WHERE "status" = 'FALHA_TRANSITORIA';

-- Integridade de campos obrigatórios, tentativas e máquina de estados
ALTER TABLE "logs_notificacoes" ADD CONSTRAINT "logs_notificacoes_evento_origem_check" CHECK (char_length(btrim("evento_origem")) > 0);
ALTER TABLE "logs_notificacoes" ADD CONSTRAINT "logs_notificacoes_destinatario_check" CHECK (char_length(btrim("destinatario")) > 0);
ALTER TABLE "logs_notificacoes" ADD CONSTRAINT "logs_notificacoes_template_check" CHECK (char_length(btrim("template")) > 0);
ALTER TABLE "logs_notificacoes" ADD CONSTRAINT "logs_notificacoes_idempotency_key_check" CHECK (char_length(btrim("idempotency_key")) > 0);
ALTER TABLE "logs_notificacoes" ADD CONSTRAINT "logs_notificacoes_tentativas_check" CHECK ("tentativas" >= 0 AND "max_tentativas" >= 1 AND "tentativas" <= "max_tentativas");
ALTER TABLE "logs_notificacoes" ADD CONSTRAINT "logs_notificacoes_ciclo_vida_check" CHECK (
  ("status" = 'ENFILEIRADA' AND "enviado_em" IS NULL)
  OR ("status" = 'PROCESSANDO' AND "enviado_em" IS NULL AND "ultima_tentativa_em" IS NOT NULL AND "tentativas" >= 1)
  OR ("status" = 'ENVIADA' AND "enviado_em" IS NOT NULL AND "ultima_tentativa_em" IS NOT NULL AND "tentativas" >= 1 AND "erro_sanitizado" IS NULL AND "proxima_tentativa_em" IS NULL)
  OR ("status" = 'FALHA_TRANSITORIA' AND "enviado_em" IS NULL AND "ultima_tentativa_em" IS NOT NULL AND "tentativas" >= 1)
  OR ("status" = 'FALHA_PERMANENTE' AND "enviado_em" IS NULL AND "ultima_tentativa_em" IS NOT NULL AND "tentativas" >= 1 AND "proxima_tentativa_em" IS NULL)
  OR ("status" = 'IGNORADA' AND "enviado_em" IS NULL AND "proxima_tentativa_em" IS NULL)
);

-- ---------------------------------------------------------------------------------------------
-- Segurança: tabela sem acesso pela Data API do Supabase (anon/authenticated)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "logs_notificacoes" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON "logs_notificacoes" FROM %I', papel);
    END IF;
  END LOOP;
END $$;
