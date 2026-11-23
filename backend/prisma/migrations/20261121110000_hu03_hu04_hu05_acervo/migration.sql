-- CreateEnum
CREATE TYPE "StatusPeca" AS ENUM ('DISPONIVEL', 'RESERVADA', 'VENDIDA', 'ARQUIVADA');

-- CreateTable
CREATE TABLE "artesaos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "biografia_cultural" TEXT NOT NULL,
    "tipo_chave_pix" VARCHAR NOT NULL,
    "chave_pix_criptografada" VARCHAR NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artesaos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atelies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artesao_id" UUID NOT NULL,
    "nome_comercial" VARCHAR NOT NULL,
    "polo_cultural" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL DEFAULT 'ATIVO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atelies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atelies_curadores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "atelie_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atelies_curadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cep" VARCHAR(8) NOT NULL,
    "logradouro" VARCHAR NOT NULL,
    "numero" VARCHAR NOT NULL,
    "complemento" VARCHAR,
    "bairro" VARCHAR NOT NULL,
    "cidade" VARCHAR NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "atelie_id" UUID,
    "usuario_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "atelie_id" UUID NOT NULL,
    "titulo" VARCHAR NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipologia" VARCHAR NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "peso_gramas" INTEGER NOT NULL,
    "comprimento_cm" INTEGER NOT NULL,
    "largura_cm" INTEGER NOT NULL,
    "altura_cm" INTEGER NOT NULL,
    "is_fragil" BOOLEAN NOT NULL DEFAULT false,
    "quantidade_estoque" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusPeca" NOT NULL DEFAULT 'DISPONIVEL',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pecas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_peca" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "peca_id" UUID NOT NULL,
    "url" VARCHAR NOT NULL,
    "caminho_armazenamento" VARCHAR NOT NULL,
    "is_principal" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_peca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artesaos_usuario_id_key" ON "artesaos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "atelies_artesao_id_key" ON "atelies"("artesao_id");

-- CreateIndex
CREATE INDEX "atelies_curadores_usuario_id_idx" ON "atelies_curadores"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "atelies_curadores_atelie_id_usuario_id_key" ON "atelies_curadores"("atelie_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "enderecos_atelie_id_key" ON "enderecos"("atelie_id");

-- CreateIndex
CREATE INDEX "enderecos_usuario_id_idx" ON "enderecos"("usuario_id");

-- CreateIndex
CREATE INDEX "pecas_atelie_id_idx" ON "pecas"("atelie_id");

-- CreateIndex
CREATE INDEX "pecas_status_idx" ON "pecas"("status");

-- CreateIndex
CREATE UNIQUE INDEX "fotos_peca_peca_id_ordem_key" ON "fotos_peca"("peca_id", "ordem");

-- AddForeignKey
ALTER TABLE "artesaos" ADD CONSTRAINT "artesaos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atelies" ADD CONSTRAINT "atelies_artesao_id_fkey" FOREIGN KEY ("artesao_id") REFERENCES "artesaos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atelies_curadores" ADD CONSTRAINT "atelies_curadores_atelie_id_fkey" FOREIGN KEY ("atelie_id") REFERENCES "atelies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atelies_curadores" ADD CONSTRAINT "atelies_curadores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_atelie_id_fkey" FOREIGN KEY ("atelie_id") REFERENCES "atelies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_atelie_id_fkey" FOREIGN KEY ("atelie_id") REFERENCES "atelies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_peca" ADD CONSTRAINT "fotos_peca_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "pecas"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------------
-- Regras de integridade não representáveis no schema Prisma (escritas à mão)
-- ---------------------------------------------------------------------------------------------

-- : status de ateliê e formato do endereço de expedição
ALTER TABLE "atelies" ADD CONSTRAINT "atelies_status_check" CHECK ("status" IN ('ATIVO', 'SUSPENSO'));
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_cep_check" CHECK ("cep" ~ '^[0-9]{8}$');
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_uf_check" CHECK ("uf" ~ '^[A-Z]{2}$');
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_dono_check" CHECK (num_nonnulls("atelie_id", "usuario_id") >= 1);

-- : tipo de Chave Pix
ALTER TABLE "artesaos" ADD CONSTRAINT "artesaos_tipo_chave_pix_check" CHECK ("tipo_chave_pix" IN ('CPF', 'EMAIL', 'TELEFONE', 'EVP'));

--  (Invariante 2): cubagem física e preço
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_peso_minimo_check" CHECK ("peso_gramas" >= 50);
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_comprimento_check" CHECK ("comprimento_cm" > 0);
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_largura_check" CHECK ("largura_cm" > 0);
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_altura_check" CHECK ("altura_cm" > 0);
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_preco_check" CHECK ("preco" > 0);
ALTER TABLE "pecas" ADD CONSTRAINT "pecas_quantidade_estoque_check" CHECK ("quantidade_estoque" >= 0);
ALTER TABLE "fotos_peca" ADD CONSTRAINT "fotos_peca_ordem_check" CHECK ("ordem" >= 0);

-- ---------------------------------------------------------------------------------------------
-- Segurança: novas tabelas sem acesso pela Data API do Supabase (anon/authenticated)
-- ---------------------------------------------------------------------------------------------
ALTER TABLE "artesaos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "atelies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "atelies_curadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enderecos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pecas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fotos_peca" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON "artesaos", "atelies", "atelies_curadores", "enderecos", "pecas", "fotos_peca" FROM %I', papel);
    END IF;
  END LOOP;
END $$;

-- : no máximo uma foto principal (capa) por peça
CREATE UNIQUE INDEX "fotos_peca_principal_unica" ON "fotos_peca"("peca_id") WHERE "is_principal";
