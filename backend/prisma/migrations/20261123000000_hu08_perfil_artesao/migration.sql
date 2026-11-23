ALTER TABLE "artesaos"
  ADD COLUMN "tecnica_principal" VARCHAR,
  ADD COLUMN "ano_inicio" INTEGER,
  ADD COLUMN "foto_url" TEXT,
  ADD COLUMN "foto_alt" VARCHAR,
  ADD COLUMN "cover_url" TEXT,
  ADD COLUMN "cover_alt" VARCHAR;

ALTER TABLE "artesaos"
  ADD CONSTRAINT "artesaos_ano_inicio_check"
  CHECK ("ano_inicio" IS NULL OR "ano_inicio" BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
