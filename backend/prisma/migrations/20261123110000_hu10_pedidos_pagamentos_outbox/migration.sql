-- HU-10 (T-PAG-01):
-- Estruturas persistentes de pedidos consolidados, pagamentos (Pix e Cartão tokenizado),
-- deduplicação de webhooks financeiros e outbox transacional integrado ao relay da HU-17.
-- Operação exclusivamente aditiva; não cria tabelas de subpedidos (escopo da HU-12).

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM (
    'PENDENTE_PAGAMENTO',
    'APROVADO',
    'RECUSADO',
    'EXPIRADO',
    'CANCELADO',
    'RECONCILIACAO_ESTORNO'
);

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('PIX', 'CARTAO_CREDITO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM (
    'CRIADO',
    'PENDENTE',
    'APROVADO',
    'RECUSADO',
    'EXPIRADO',
    'CANCELADO',
    'ESTORNADO',
    'ERRO_COMUNICACAO'
);

-- CreateEnum
CREATE TYPE "StatusProcessamentoWebhook" AS ENUM (
    'RECEBIDO',
    'PROCESSADO',
    'IGNORADO_DUPLICADO',
    'ERRO'
);

-- CreateEnum
CREATE TYPE "StatusEventoOutbox" AS ENUM ('PENDENTE', 'PUBLICADO', 'FALHA');

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_pedido" VARCHAR(32) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "reserva_grupo_id" UUID NOT NULL,
    "endereco_entrega_id" UUID,
    "endereco_entrega_snapshot" JSONB NOT NULL,
    "fretes_por_origem" JSONB NOT NULL,
    "itens_snapshot" JSONB NOT NULL,
    "valor_total_pecas" DECIMAL(10, 2) NOT NULL,
    "valor_total_frete" DECIMAL(10, 2) NOT NULL,
    "valor_total_pedido" DECIMAL(10, 2) NOT NULL,
    "status" "StatusPedido" NOT NULL DEFAULT 'PENDENTE_PAGAMENTO',
    "metodo_pagamento" "MetodoPagamento" NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "subpedidos_gerados" BOOLEAN NOT NULL DEFAULT false,
    "subpedidos_gerados_em" TIMESTAMP(3),
    "pago_em" TIMESTAMP(3),
    "cancelado_em" TIMESTAMP(3),
    "reconciliacao_motivo" VARCHAR(500),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pedido_id" UUID NOT NULL,
    "gateway" VARCHAR(40) NOT NULL,
    "ambiente" VARCHAR(20) NOT NULL DEFAULT 'sandbox',
    "metodo" "MetodoPagamento" NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'CRIADO',
    "valor" DECIMAL(10, 2) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "external_payment_id" VARCHAR(128),
    "gateway_status_raw" VARCHAR(64),
    "gateway_status_detail" VARCHAR(120),
    "expira_em" TIMESTAMP(3),
    "gateway_expira_em" TIMESTAMP(3),
    "pix_copia_e_cola" TEXT,
    "pix_qr_code_base64" TEXT,
    "pix_ticket_url" VARCHAR(512),
    "cartao_bandeira" VARCHAR(32),
    "cartao_ultimos_digitos" VARCHAR(4),
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "erro_sanitizado" VARCHAR(500),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprovado_em" TIMESTAMP(3),
    "recusado_em" TIMESTAMP(3),
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks_pagamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gateway" VARCHAR(40) NOT NULL,
    "evento_externo_id" VARCHAR(160) NOT NULL,
    "tipo_evento" VARCHAR(80) NOT NULL,
    "external_payment_id" VARCHAR(128),
    "pagamento_id" UUID,
    "assinatura_valida" BOOLEAN NOT NULL DEFAULT false,
    "status_processamento" "StatusProcessamentoWebhook" NOT NULL DEFAULT 'RECEBIDO',
    "payload_hash" VARCHAR(64) NOT NULL,
    "resumo_auditoria" JSONB,
    "erro_sanitizado" VARCHAR(500),
    "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processado_em" TIMESTAMP(3),

    CONSTRAINT "webhooks_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_eventos_notificacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo_evento" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "StatusEventoOutbox" NOT NULL DEFAULT 'PENDENTE',
    "tentativas_publicacao" INTEGER NOT NULL DEFAULT 0,
    "erro_sanitizado" VARCHAR(500),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicado_em" TIMESTAMP(3),
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_eventos_notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_codigo_pedido_key" ON "pedidos"("codigo_pedido");
CREATE UNIQUE INDEX "pedidos_usuario_id_idempotency_key_key" ON "pedidos"("usuario_id", "idempotency_key");
CREATE INDEX "pedidos_usuario_id_criado_em_idx" ON "pedidos"("usuario_id", "criado_em");
CREATE INDEX "pedidos_status_criado_em_idx" ON "pedidos"("status", "criado_em");
CREATE INDEX "pedidos_reserva_grupo_id_idx" ON "pedidos"("reserva_grupo_id");

CREATE UNIQUE INDEX "pagamentos_idempotency_key_key" ON "pagamentos"("idempotency_key");
CREATE INDEX "pagamentos_pedido_id_criado_em_idx" ON "pagamentos"("pedido_id", "criado_em");
CREATE INDEX "pagamentos_status_expira_em_idx" ON "pagamentos"("status", "expira_em");

CREATE UNIQUE INDEX "webhooks_pagamento_gateway_evento_externo_id_key" ON "webhooks_pagamento"("gateway", "evento_externo_id");
CREATE INDEX "webhooks_pagamento_gateway_external_payment_id_idx" ON "webhooks_pagamento"("gateway", "external_payment_id");
CREATE INDEX "webhooks_pagamento_pagamento_id_recebido_em_idx" ON "webhooks_pagamento"("pagamento_id", "recebido_em");
CREATE INDEX "webhooks_pagamento_status_processamento_recebido_em_idx" ON "webhooks_pagamento"("status_processamento", "recebido_em");

CREATE UNIQUE INDEX "outbox_eventos_notificacao_idempotency_key_key" ON "outbox_eventos_notificacao"("idempotency_key");
CREATE INDEX "outbox_eventos_notificacao_aggregate_id_tipo_evento_idx" ON "outbox_eventos_notificacao"("aggregate_id", "tipo_evento");
CREATE INDEX "outbox_eventos_notificacao_status_criado_em_idx" ON "outbox_eventos_notificacao"("status", "criado_em");

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_reserva_grupo_id_fkey" FOREIGN KEY ("reserva_grupo_id") REFERENCES "reservas_grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_endereco_entrega_id_fkey" FOREIGN KEY ("endereco_entrega_id") REFERENCES "enderecos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "webhooks_pagamento" ADD CONSTRAINT "webhooks_pagamento_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------
-- Índices parciais e CHECK constraints de integridade financeira, concorrência e segurança
-- ---------------------------------------------------------------------------------------------

-- Impede dois pedidos ativos/aprovados simultâneos para o mesmo grupo de reservas da HU-06
CREATE UNIQUE INDEX "pedidos_reserva_grupo_ativo_unico"
  ON "pedidos"("reserva_grupo_id")
  WHERE "status" IN ('PENDENTE_PAGAMENTO', 'APROVADO', 'RECONCILIACAO_ESTORNO');

-- Impede duplicidade de transação externa do mesmo gateway e dois pagamentos ativos no mesmo pedido
CREATE UNIQUE INDEX "pagamentos_gateway_external_id_unico"
  ON "pagamentos"("gateway", "external_payment_id")
  WHERE "external_payment_id" IS NOT NULL;

CREATE UNIQUE INDEX "pagamentos_pedido_ativo_unico"
  ON "pagamentos"("pedido_id")
  WHERE "status" IN ('CRIADO', 'PENDENTE', 'APROVADO');

-- Índice parcial para varredura eficiente do Relay de Outbox da HU-17
CREATE INDEX "outbox_eventos_pendentes_idx"
  ON "outbox_eventos_notificacao"("criado_em")
  WHERE "status" IN ('PENDENTE', 'FALHA');

-- Constraints de integridade monetária exata (Decimal), idempotência e ciclo de vida
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_codigo_pedido_check" CHECK (char_length(btrim("codigo_pedido")) > 0);
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_idempotency_key_check" CHECK (char_length(btrim("idempotency_key")) > 0);
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_valores_check" CHECK ("valor_total_pecas" > 0 AND "valor_total_frete" >= 0 AND "valor_total_pedido" > 0);
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_soma_exata_check" CHECK ("valor_total_pedido" = "valor_total_pecas" + "valor_total_frete");
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_ciclo_vida_check" CHECK (
  ("status" = 'PENDENTE_PAGAMENTO' AND "pago_em" IS NULL)
  OR ("status" = 'APROVADO' AND "pago_em" IS NOT NULL)
  OR ("status" = 'RECONCILIACAO_ESTORNO' AND "pago_em" IS NOT NULL AND "reconciliacao_motivo" IS NOT NULL AND char_length(btrim("reconciliacao_motivo")) > 0)
  OR ("status" IN ('RECUSADO', 'EXPIRADO', 'CANCELADO') AND "pago_em" IS NULL)
);

ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_gateway_check" CHECK (char_length(btrim("gateway")) > 0);
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_ambiente_check" CHECK ("ambiente" IN ('sandbox', 'production'));
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_idempotency_key_check" CHECK (char_length(btrim("idempotency_key")) > 0);
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_valor_check" CHECK ("valor" > 0);
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_parcelas_check" CHECK ("parcelas" >= 1 AND "parcelas" <= 12);
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_cartao_ultimos_digitos_check" CHECK ("cartao_ultimos_digitos" IS NULL OR "cartao_ultimos_digitos" ~ '^[0-9]{4}$');
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_pix_campos_check" CHECK (
  ("metodo" = 'CARTAO_CREDITO' AND "pix_copia_e_cola" IS NULL AND "pix_qr_code_base64" IS NULL)
  OR ("metodo" = 'PIX')
);
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_ciclo_vida_check" CHECK (
  ("status" = 'APROVADO' AND "aprovado_em" IS NOT NULL)
  OR ("status" = 'RECUSADO' AND "recusado_em" IS NOT NULL)
  OR ("status" IN ('CRIADO', 'PENDENTE', 'EXPIRADO', 'CANCELADO', 'ESTORNADO', 'ERRO_COMUNICACAO'))
);

ALTER TABLE "webhooks_pagamento" ADD CONSTRAINT "webhooks_pagamento_gateway_check" CHECK (char_length(btrim("gateway")) > 0);
ALTER TABLE "webhooks_pagamento" ADD CONSTRAINT "webhooks_pagamento_evento_id_check" CHECK (char_length(btrim("evento_externo_id")) > 0);
ALTER TABLE "webhooks_pagamento" ADD CONSTRAINT "webhooks_pagamento_tipo_evento_check" CHECK (char_length(btrim("tipo_evento")) > 0);
ALTER TABLE "webhooks_pagamento" ADD CONSTRAINT "webhooks_pagamento_payload_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "outbox_eventos_notificacao" ADD CONSTRAINT "outbox_tipo_evento_check" CHECK (char_length(btrim("tipo_evento")) > 0);
ALTER TABLE "outbox_eventos_notificacao" ADD CONSTRAINT "outbox_idempotency_key_check" CHECK (char_length(btrim("idempotency_key")) > 0);
ALTER TABLE "outbox_eventos_notificacao" ADD CONSTRAINT "outbox_tentativas_check" CHECK ("tentativas_publicacao" >= 0);
ALTER TABLE "outbox_eventos_notificacao" ADD CONSTRAINT "outbox_ciclo_vida_check" CHECK (
  ("status" = 'PUBLICADO' AND "publicado_em" IS NOT NULL)
  OR ("status" IN ('PENDENTE', 'FALHA') AND "publicado_em" IS NULL)
);

-- ---------------------------------------------------------------------------------------------
-- Segurança: novas tabelas sem acesso pela Data API do Supabase (anon/authenticated)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "pedidos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhooks_pagamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_eventos_notificacao" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format(
        'REVOKE ALL ON "pedidos", "pagamentos", "webhooks_pagamento", "outbox_eventos_notificacao" FROM %I',
        papel
      );
    END IF;
  END LOOP;
END $$;
