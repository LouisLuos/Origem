ALTER TABLE "usuarios_papeis"
    ADD COLUMN "uuid_id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "usuarios_papeis"
    DROP CONSTRAINT "usuarios_papeis_pkey";

ALTER TABLE "usuarios_papeis"
    DROP COLUMN "id";

ALTER TABLE "usuarios_papeis"
    RENAME COLUMN "uuid_id" TO "id";

ALTER TABLE "usuarios_papeis"
    ADD CONSTRAINT "usuarios_papeis_pkey" PRIMARY KEY ("id");

ALTER TABLE "auth_login_attempts"
    ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "auth_login_attempts"
    DROP CONSTRAINT "auth_login_attempts_pkey";

ALTER TABLE "auth_login_attempts"
    ADD CONSTRAINT "auth_login_attempts_pkey" PRIMARY KEY ("id");

ALTER TABLE "auth_login_attempts"
    ADD CONSTRAINT "auth_login_attempts_email_key" UNIQUE ("email");
