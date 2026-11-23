import sharp from 'sharp';
import type { ProcessadorImagemPeca } from '../repositories/contracts/pecas.contracts.js';
import { AppError } from './AppError.js';

/** Maior lado da imagem otimizada (adequado para vitrine e página de detalhe em telas densas). */
export const FOTO_OTIMIZADA_LADO_MAX = 1600;
/** Qualidade WebP: preserva textura e cor das peças artesanais com bom ganho de tamanho. */
export const FOTO_OTIMIZADA_QUALIDADE = 82;
/** Proteção contra "bombas de descompressão" (imagens com dimensões absurdas). */
const LIMITE_PIXELS_ENTRADA = 50_000_000;

/**
 * Processador real de fotos com `sharp`:
 * - decodifica com falha em dados corrompidos (`failOn: 'error'`);
 * - aplica a orientação EXIF e descarta metadados (GPS, câmera etc.), que o sharp não copia por padrão;
 * - reduz para no máximo 1600 px no maior lado, preservando a proporção e sem ampliar;
 * - converte para WebP.
 */
export const sharpProcessadorImagemPeca: ProcessadorImagemPeca = {
  async otimizar({ conteudo }) {
    try {
      const otimizada = await sharp(conteudo, { failOn: 'error', limitInputPixels: LIMITE_PIXELS_ENTRADA })
        .rotate()
        .resize({
          width: FOTO_OTIMIZADA_LADO_MAX,
          height: FOTO_OTIMIZADA_LADO_MAX,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: FOTO_OTIMIZADA_QUALIDADE, effort: 4 })
        .toBuffer();
      return { conteudo: otimizada, tipoMime: 'image/webp', extensao: 'webp' };
    } catch {
      throw new AppError(
        'Uma das fotos enviadas está corrompida ou não pôde ser processada como imagem.',
        422,
        'FOTO_INVALIDA',
      );
    }
  },
};
