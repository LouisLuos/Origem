-- Cenário 2: trilha durável de auditoria de segurança.
-- Armazena apenas a allowlist de campos do evento (sem Chave Pix, JWT, cookies ou senhas).
-- CreateTable
CREATE TABLE "auditoria_seguranca" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo_evento" VARCHAR(40) NOT NULL,
    "decisao" VARCHAR(10) NOT NULL,
    "motivo" VARCHAR(40) NOT NULL,
    "operacao" VARCHAR(40) NOT NULL,
    "usuario_id" VARCHAR(100) NOT NULL,
    "atelie_id" VARCHAR(100) NOT NULL,
    "correlation_id" VARCHAR(128) NOT NULL,
    "metodo_http" VARCHAR(10) NOT NULL,
    "caminho" VARCHAR(512) NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL,
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_seguranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_seguranca_atelie_id_ocorrido_em_idx" ON "auditoria_seguranca"("atelie_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "auditoria_seguranca_usuario_id_ocorrido_em_idx" ON "auditoria_seguranca"("usuario_id", "ocorrido_em");


-- Valores controlados (espelham SecurityAuditEventType / SecurityAuditDecision / OperacaoAtelie)
ALTER TABLE "auditoria_seguranca" ADD CONSTRAINT "auditoria_seguranca_decisao_check"
  CHECK ("decisao" IN ('DENY', 'ALLOW'));
ALTER TABLE "auditoria_seguranca" ADD CONSTRAINT "auditoria_seguranca_tipo_evento_check"
  CHECK ("tipo_evento" IN ('FINANCIAL_ACCESS_DENIED', 'CURATOR_MANAGEMENT_DENIED', 'ATELIER_AUTHORIZATION_DENIED'));
ALTER TABLE "auditoria_seguranca" ADD CONSTRAINT "auditoria_seguranca_operacao_check"
  CHECK ("operacao" IN ('ALTERAR_CHAVE_PIX', 'CONSULTAR_DADOS_FINANCEIROS', 'GERENCIAR_CURADORES', 'GERENCIAR_CATALOGO', 'GERENCIAR_ETIQUETAS'));

-- Trilha imutável: registros de auditoria não podem ser alterados nem apagados pela aplicação.
CREATE FUNCTION "auditoria_seguranca_somente_insercao"() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'auditoria_seguranca é somente inserção: % não é permitido', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "auditoria_seguranca_bloqueia_alteracao"
  BEFORE UPDATE OR DELETE ON "auditoria_seguranca"
  FOR EACH ROW EXECUTE FUNCTION "auditoria_seguranca_somente_insercao"();

CREATE TRIGGER "auditoria_seguranca_bloqueia_truncate"
  BEFORE TRUNCATE ON "auditoria_seguranca"
  FOR EACH STATEMENT EXECUTE FUNCTION "auditoria_seguranca_somente_insercao"();

-- Sem acesso pela Data API do Supabase: somente o backend (dono da tabela) grava/consulta.
ALTER TABLE "auditoria_seguranca" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON "auditoria_seguranca" FROM %I', papel);
      EXECUTE format('REVOKE ALL ON FUNCTION "auditoria_seguranca_somente_insercao"() FROM %I', papel);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION "auditoria_seguranca_somente_insercao"() FROM PUBLIC;
