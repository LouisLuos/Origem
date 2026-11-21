CREATE TYPE "PapelUsuario" AS ENUM ('COMPRADOR', 'ARTESAO', 'CURADOR', 'ADMIN');

CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR NOT NULL,
    "email" VARCHAR NOT NULL,
    "cpf_cnpj" VARCHAR NOT NULL,
    "telefone_whatsapp" VARCHAR NOT NULL,
    "senha_hash" VARCHAR NOT NULL,
    "status" VARCHAR NOT NULL DEFAULT 'ATIVO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE UNIQUE INDEX "usuarios_cpf_cnpj_key" ON "usuarios"("cpf_cnpj");

CREATE TABLE "usuarios_papeis" (
    "id" SERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    CONSTRAINT "usuarios_papeis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_papeis_usuario_id_papel_key"
    ON "usuarios_papeis"("usuario_id", "papel");

ALTER TABLE "usuarios_papeis"
    ADD CONSTRAINT "usuarios_papeis_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "auth_login_attempts" (
    "email" VARCHAR NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_login_attempts_pkey" PRIMARY KEY ("email")
);
