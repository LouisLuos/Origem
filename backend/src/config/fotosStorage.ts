import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ArmazenamentoFotosPeca } from '../repositories/contracts/pecas.contracts.js';
import { createLocalDiskArmazenamentoFotosPeca } from '../repositories/localDiskFotosPeca.storage.js';
import { createSupabaseArmazenamentoFotosPeca } from '../repositories/supabaseFotosPeca.storage.js';
import { unconfiguredArmazenamentoFotosPeca } from '../repositories/unconfiguredPecas.repository.js';
import { env } from './env.js';

/** Diretório das fotos no driver local: `FOTOS_STORAGE_LOCAL_DIR` ou backend/uploads/fotos-pecas (fora do git). */
export const DIRETORIO_FOTOS_LOCAIS = env.FOTOS_STORAGE_LOCAL_DIR
  ? path.resolve(env.FOTOS_STORAGE_LOCAL_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/fotos-pecas');

export type DriverFotos = 'supabase' | 'local' | 'nao_configurado';

/**
 * Seleção do armazenamento de fotos (T-PEC-03):
 * - `FOTOS_STORAGE_DRIVER=local`: disco local, servido pelo próprio backend;
 * - Supabase Storage quando `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existem;
 * - caso contrário, fail-closed (503) — nunca simula upload.
 */
export function resolverDriverFotos(): DriverFotos {
  if (env.FOTOS_STORAGE_DRIVER === 'local') return 'local';
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) return 'supabase';
  return 'nao_configurado';
}

export function criarArmazenamentoFotosPeca(): ArmazenamentoFotosPeca {
  switch (resolverDriverFotos()) {
    case 'local':
      return createLocalDiskArmazenamentoFotosPeca({
        diretorio: DIRETORIO_FOTOS_LOCAIS,
        urlPublicaBase: env.FOTOS_PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`,
      });
    case 'supabase':
      return createSupabaseArmazenamentoFotosPeca({
        url: env.SUPABASE_URL as string,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
        bucket: env.SUPABASE_STORAGE_BUCKET_FOTOS,
      });
    default:
      return unconfiguredArmazenamentoFotosPeca;
  }
}
