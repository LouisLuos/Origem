import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: ['.env.local', '.env'] });

export const DEV_DEFAULT_JWT_SECRET = 'chave_secreta_para_desenvolvimento_origem_jwt_2026';

/**
 * Valida material de chave AES-256 (exatamente 32 bytes em hex de 64 chars ou base64 canônico).
 * Rejeita strings com espaços internos ou chaves degeneradas com byte único repetido.
 */
export function isValidAes256KeyMaterial(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }

  let bytes: Buffer | null = null;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    bytes = Buffer.from(trimmed, 'hex');
  } else if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32 && decoded.toString('base64') === trimmed) {
      bytes = decoded;
    }
  }

  if (!bytes || bytes.length !== 32) {
    return false;
  }

  // Impede chaves triviais como 32 bytes idênticos (ex.: todos zeros)
  return new Set(bytes).size >= 2;
}

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
    CORS_ORIGIN: z.string().optional(),
    JWT_SECRET: z
      .string()
      .min(8, 'JWT_SECRET deve ter no mínimo 8 caracteres')
      .default(DEV_DEFAULT_JWT_SECRET),
    JWT_EXPIRES_IN: z.string().default('7d'),
    IA_RECOMENDADOR_URL: z.string().url().optional().default('http://localhost:3002'),
    // Supabase Storage: credencial administrativa usada somente no backend.
    SUPABASE_URL: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().url('SUPABASE_URL deve ser uma URL válida.').optional(),
    ),
    SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY inválida.').optional(),
    ),
    SUPABASE_STORAGE_BUCKET_FOTOS: z.string().min(3).default('fotos-pecas'),
    // Driver de armazenamento das fotos: `local` grava em backend/uploads (desenvolvimento)
    FOTOS_STORAGE_DRIVER: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.enum(['supabase', 'local']).optional(),
    ),
    FOTOS_STORAGE_LOCAL_DIR: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().optional(),
    ),
    FOTOS_PUBLIC_BASE_URL: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().url('FOTOS_PUBLIC_BASE_URL deve ser uma URL válida.').optional(),
    ),
    PIX_ENCRYPTION_KEY: z.preprocess(
      (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v),
      z.string().optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.PIX_ENCRYPTION_KEY !== undefined && !isValidAes256KeyMaterial(data.PIX_ENCRYPTION_KEY)) {
      ctx.addIssue({
        code: 'custom',
        path: ['PIX_ENCRYPTION_KEY'],
        message:
          'PIX_ENCRYPTION_KEY deve representar exatamente 32 bytes válidos em hexadecimal (64 caracteres) ou base64.',
      });
    }

    if (data.NODE_ENV === 'production') {
      if (data.JWT_SECRET === DEV_DEFAULT_JWT_SECRET || data.JWT_SECRET.trim().length < 32) {
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_SECRET'],
          message:
            'JWT_SECRET de desenvolvimento não é permitido em produção; configure um segredo forte com ao menos 32 caracteres.',
        });
      }

      if (!data.PIX_ENCRYPTION_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['PIX_ENCRYPTION_KEY'],
          message: 'PIX_ENCRYPTION_KEY é obrigatória em ambiente de produção.',
        });
      }
    }
  });

/**
 * Valida explicitamente um dicionário de variáveis de ambiente sem efeitos colaterais.
 */
export function parseEnv(rawEnv: Record<string, string | undefined>) {
  return envSchema.safeParse(rawEnv);
}

const _env = parseEnv(process.env);

if (!_env.success) {
  console.error('❌ Erro na validação das variáveis de ambiente:');
  console.error(_env.error.issues);
  process.exit(1);
}

export const env = _env.data;
