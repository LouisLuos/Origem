ALTER TABLE "enderecos" DROP CONSTRAINT IF EXISTS "enderecos_uf_check";
ALTER TABLE "enderecos"
  ADD CONSTRAINT "enderecos_uf_check" CHECK ("uf" = 'PE');
