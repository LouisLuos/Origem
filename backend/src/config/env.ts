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

function optionalTrimmedString() {
  return z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v),
    z.string().optional(),
  );
}

function optionalUrl(message: string) {
  return z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v),
    z.string().url(message).optional(),
  );
}

function coerceBooleanWithDefault(defaultValue: boolean) {
  return z.preprocess((v) => {
    if (v === undefined || v === null) return defaultValue;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const normalized = v.trim().toLowerCase();
      if (normalized === '') return defaultValue;
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return v;
  }, z.boolean());
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
    APP_PUBLIC_URL: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().url('APP_PUBLIC_URL deve ser uma URL válida.').default('http://localhost:5173'),
    ),
    // Supabase Storage: credencial administrativa usada somente no backend.
    SUPABASE_URL: optionalUrl('SUPABASE_URL deve ser uma URL válida.'),
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
    FOTOS_STORAGE_LOCAL_DIR: optionalTrimmedString(),
    FOTOS_PUBLIC_BASE_URL: optionalUrl('FOTOS_PUBLIC_BASE_URL deve ser uma URL válida.'),
    PIX_ENCRYPTION_KEY: optionalTrimmedString(),
    // Redis e fila BullMQ (HU-17)
    REDIS_URL: optionalUrl('REDIS_URL deve ser uma URL válida.'),
    REDIS_HOST: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).default('127.0.0.1'),
    ),
    REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
    REDIS_PASSWORD: optionalTrimmedString(),
    REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
    REDIS_KEY_PREFIX: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).default('origem'),
    ),
    NOTIFICATION_QUEUE_NAME: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).default('origem-notificacoes'),
    ),
    // Alinhado a RNF-05/RNF-12 (3 tentativas) com backoff exponencial iniciando em 1s
    NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    NOTIFICATION_BACKOFF_INITIAL_MS: z.coerce.number().int().min(50).max(300_000).default(1000),
    NOTIFICATION_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    NOTIFICATION_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(8000),
    NOTIFICATION_SLA_CHECK_INTERVAL_MS: z.coerce.number().int().min(1000).max(86_400_000).default(3_600_000),
    NOTIFICATION_HOLIDAYS_ISO: optionalTrimmedString(),
    // Provedor de e-mail transacional (HU-17)
    EMAIL_PROVIDER: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.enum(['disabled', 'smtp', 'http_webhook']).optional(),
    ),
    EMAIL_FROM: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(3).default('Origem Marketplace <nao-responda@origem.local>'),
    ),
    SMTP_HOST: optionalTrimmedString(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: coerceBooleanWithDefault(false),
    SMTP_USER: optionalTrimmedString(),
    SMTP_PASS: optionalTrimmedString(),
    EMAIL_HTTP_ENDPOINT: optionalUrl('EMAIL_HTTP_ENDPOINT deve ser uma URL válida.'),
    EMAIL_HTTP_API_KEY: optionalTrimmedString(),
    // Provedor oficial de WhatsApp Business (Meta Cloud API ou gateway HTTP oficial)
    WHATSAPP_PROVIDER: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.enum(['disabled', 'meta_cloud', 'http_webhook']).optional(),
    ),
    WHATSAPP_API_BASE_URL: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().url('WHATSAPP_API_BASE_URL deve ser uma URL válida.').default('https://graph.facebook.com/v21.0'),
    ),
    WHATSAPP_PHONE_NUMBER_ID: optionalTrimmedString(),
    WHATSAPP_ACCESS_TOKEN: optionalTrimmedString(),
    WHATSAPP_DEFAULT_LANGUAGE: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(2).default('pt_BR'),
    ),
    WHATSAPP_HTTP_ENDPOINT: optionalUrl('WHATSAPP_HTTP_ENDPOINT deve ser uma URL válida.'),
    WHATSAPP_HTTP_API_KEY: optionalTrimmedString(),
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
