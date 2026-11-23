-- HU-11 (T-END-01): o livro de endereços do comprador aceita entregas em qualquer UF.
-- A restrição a Pernambuco (HU-04) passa a valer somente para o endereço de expedição do ateliê.
ALTER TABLE "enderecos" DROP CONSTRAINT IF EXISTS "enderecos_uf_check";
ALTER TABLE "enderecos"
  ADD CONSTRAINT "enderecos_uf_check"
  CHECK ("uf" ~ '^[A-Z]{2}$' AND ("atelie_id" IS NULL OR "uf" = 'PE'));
