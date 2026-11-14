import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  CORS_ORIGIN: z.string().optional(),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET deve ter no mínimo 8 caracteres').default('chave_secreta_para_desenvolvimento_origem_jwt_2026'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  IA_RECOMENDADOR_URL: z.string().url().optional().default('http://localhost:3002'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Erro na validação das variáveis de ambiente:');
  console.error(_env.error.format());
  process.exit(1);
}

export const env = _env.data;
