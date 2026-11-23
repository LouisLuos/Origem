-- Segurança do Supabase: o backend acessa o banco exclusivamente pelo Prisma como `postgres`
-- (dono das tabelas, portanto não sujeito a RLS). Os papéis públicos da Data API (`anon` e
-- `authenticated`) não devem ler nem escrever nenhuma tabela da aplicação.
-- Idempotente e compatível com PostgreSQL sem os papéis do Supabase (ambientes de teste isolados).

DO $$
DECLARE
  papel TEXT;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', papel);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', papel);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', papel);
      -- Tabelas, sequências e funções criadas futuramente pelo `postgres` (migrations) não
      -- herdam mais acesso público.
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I', papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', papel);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', papel);
    END IF;
  END LOOP;
END $$;

-- Defesa em profundidade: RLS ativo sem políticas nega qualquer acesso via Data API, mesmo que
-- um privilégio seja concedido por engano no futuro. O dono (`postgres`/Prisma) não é afetado.
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuarios_papeis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_login_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
