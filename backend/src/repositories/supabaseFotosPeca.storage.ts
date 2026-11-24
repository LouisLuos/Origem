import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../utils/AppError.js';
import type { ArmazenamentoFotosPeca } from './contracts/pecas.contracts.js';
import { FOTO_PECA_ERROR_CODES } from './unconfiguredPecas.repository.js';

export interface SupabaseStorageConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly bucket: string;
}

/**
 * Armazenamento real das fotos no Supabase Storage.
 * Usa a chave `service_role` EXCLUSIVAMENTE no backend; o bucket é público apenas para leitura
 * das imagens da vitrine, e a escrita não tem políticas para `anon`/`authenticated`.
 */
export function createSupabaseArmazenamentoFotosPeca(
  config: SupabaseStorageConfig,
  client: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
): ArmazenamentoFotosPeca {
  const bucket = client.storage.from(config.bucket);

  return {
    async salvar({ atelieId, conteudo, tipoMime, extensao }) {
      const caminho = `atelies/${atelieId}/${randomUUID()}.${extensao}`;
      const { error } = await bucket.upload(caminho, conteudo, {
        contentType: tipoMime,
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) {
        // Mensagem do provedor fica fora da resposta e do log para não vazar detalhes internos.
        console.error('❌ Falha no upload de foto para o Storage:', { caminho, status: (error as { statusCode?: string }).statusCode ?? null });
        throw new AppError(
          'Não foi possível armazenar as fotos da peça. Nenhuma peça foi publicada.',
          502,
          FOTO_PECA_ERROR_CODES.ARMAZENAMENTO_INDISPONIVEL,
        );
      }
      const { data } = bucket.getPublicUrl(caminho);
      return { url: data.publicUrl, caminho };
    },

    async remover(caminhos) {
      if (caminhos.length === 0) return;
      const { error } = await bucket.remove([...caminhos]);
      if (error) {
        throw new AppError('Falha ao remover fotos do Storage.', 502, FOTO_PECA_ERROR_CODES.ARMAZENAMENTO_INDISPONIVEL);
      }
    },
  };
}
