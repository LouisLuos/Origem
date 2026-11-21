import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../utils/AppError.js';
import { isUuid } from '../utils/uuid.util.js';
import type { ArmazenamentoFotosPeca } from './contracts/pecas.contracts.js';
import { HU05_ERROR_CODES } from './unconfiguredPecas.repository.js';

export interface LocalDiskStorageConfig {
  /** Diretório raiz onde as fotos são gravadas (servido em `/uploads/fotos-pecas`). */
  readonly diretorio: string;
  /** URL pública base do backend (ex.: http://localhost:3001). */
  readonly urlPublicaBase: string;
}

export const ROTA_PUBLICA_FOTOS_LOCAIS = '/uploads/fotos-pecas';

/**
 * Armazenamento real em disco local (T-PEC-03, DoD: "armazena em disco ou nuvem").
 * Indicado para desenvolvimento; em produção, preferir o Supabase Storage.
 */
export function createLocalDiskArmazenamentoFotosPeca(config: LocalDiskStorageConfig): ArmazenamentoFotosPeca {
  const raiz = path.resolve(config.diretorio);

  function resolverDentroDaRaiz(caminhoRelativo: string): string {
    const absoluto = path.resolve(raiz, caminhoRelativo);
    if (!absoluto.startsWith(raiz + path.sep)) {
      throw new AppError('Caminho de foto inválido.', 400);
    }
    return absoluto;
  }

  return {
    async salvar({ atelieId, conteudo, extensao }) {
      if (!isUuid(atelieId) || !/^[a-z0-9]{2,5}$/.test(extensao)) {
        throw new AppError('Parâmetros de armazenamento inválidos.', 400);
      }
      const caminho = `atelies/${atelieId}/${randomUUID()}.${extensao}`;
      const destino = resolverDentroDaRaiz(caminho);
      try {
        await mkdir(path.dirname(destino), { recursive: true });
        await writeFile(destino, conteudo, { flag: 'wx' });
      } catch {
        throw new AppError(
          'Não foi possível armazenar as fotos da peça. Nenhuma peça foi publicada.',
          502,
          HU05_ERROR_CODES.ARMAZENAMENTO_INDISPONIVEL,
        );
      }
      const base = config.urlPublicaBase.replace(/\/+$/, '');
      return { url: `${base}${ROTA_PUBLICA_FOTOS_LOCAIS}/${caminho}`, caminho };
    },

    async remover(caminhos) {
      for (const caminho of caminhos) {
        try {
          await unlink(resolverDentroDaRaiz(caminho));
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
      }
    },
  };
}
