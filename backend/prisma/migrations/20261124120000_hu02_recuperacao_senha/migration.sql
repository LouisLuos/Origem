-- HU-02 (T-REC-01): tokens descartáveis de recuperação de senha e invalidação de sessões.

-- Sessões JWT emitidas antes deste instante são recusadas (Cenário 3).
ALTER TABLE "usuarios" ADD COLUMN "sessoes_validas_desde" TIMESTAMP(3);

CREATE TABLE "recuperacoes_senha" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuperacoes_senha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recuperacoes_senha_token_hash_key" ON "recuperacoes_senha"("token_hash");
CREATE INDEX "recuperacoes_senha_usuario_id_idx" ON "recuperacoes_senha"("usuario_id");

ALTER TABLE "recuperacoes_senha"
  ADD CONSTRAINT "recuperacoes_senha_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recuperacoes_senha"
  ADD CONSTRAINT "recuperacoes_senha_token_hash_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "recuperacoes_senha" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON "recuperacoes_senha" FROM %I', papel);
    END IF;
  END LOOP;
END $$;
