/**
 * Prepara o bucket de fotos das peças no Supabase Storage (HU-05 / T-PEC-03). Idempotente.
 * Uso: npm run storage:setup  (requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no backend/.env)
 *
 * Política resultante:
 * - leitura pública das imagens (vitrine), via URL pública do bucket;
 * - escrita apenas pelo backend com a chave service_role (nenhuma policy de escrita para
 *   anon/authenticated: o RLS de storage.objects nega por padrão);
 * - somente WebP (saída do processador sharp) até 5 MB.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';

const OPCOES = { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ['image/webp'] };

async function main(): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias para preparar o Storage.');
    process.exit(1);
  }
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = env.SUPABASE_STORAGE_BUCKET_FOTOS;

  const { data: existente } = await client.storage.getBucket(bucket);
  const { error } = existente
    ? await client.storage.updateBucket(bucket, OPCOES)
    : await client.storage.createBucket(bucket, OPCOES);
  if (error) {
    console.error(`Falha ao preparar o bucket "${bucket}": ${error.message}`);
    process.exit(1);
  }
  console.log(`Bucket "${bucket}" ${existente ? 'atualizado' : 'criado'}: leitura pública, escrita só via service_role, WebP até 5 MB.`);
}

void main();
