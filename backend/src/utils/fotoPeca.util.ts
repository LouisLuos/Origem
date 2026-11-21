import type { TipoMimeFotoPeca } from '../repositories/contracts/pecas.contracts.js';

/** Mínimo de fotos exigido para publicar uma peça (HU-05, Cenário 1). */
export const FOTOS_PECA_MIN = 2;

/**
 * Limites técnicos provisórios de upload (não definidos nos documentos normativos).
 * PENDÊNCIA: confirmar quantidade máxima e tamanho máximo por foto (T-PEC-03).
 */
export const FOTOS_PECA_MAX = 5;
export const FOTO_PECA_MAX_BYTES = 5 * 1024 * 1024;

/** Formatos aceitos (docs/01-requisitos-e-arquitetura/04-tarefas-smart.md: "imagens JPG/PNG"). */
export const TIPOS_MIME_FOTO_PECA: readonly TipoMimeFotoPeca[] = ['image/jpeg', 'image/png'];

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Tamanho máximo, em caracteres, de um conteúdo base64 cuja decodificação respeita o limite. */
export const FOTO_PECA_MAX_BASE64_CHARS = Math.ceil(FOTO_PECA_MAX_BYTES / 3) * 4;

/**
 * Limite do corpo JSON da rota de criação: todas as fotos no tamanho máximo em base64 mais
 * margem para os demais campos.
 */
export const LIMITE_CORPO_CRIACAO_PECA_BYTES = FOTOS_PECA_MAX * FOTO_PECA_MAX_BASE64_CHARS + 64 * 1024;

export function isTipoMimeFotoPeca(valor: unknown): valor is TipoMimeFotoPeca {
  return typeof valor === 'string' && (TIPOS_MIME_FOTO_PECA as readonly string[]).includes(valor);
}

/** Decodifica base64 canônico (sem prefixo data:, sem espaços); devolve `null` se inválido. */
export function decodificarBase64Estrito(conteudo: string): Buffer | null {
  if (conteudo.length === 0 || conteudo.length % 4 !== 0 || !BASE64_REGEX.test(conteudo)) {
    return null;
  }
  const buffer = Buffer.from(conteudo, 'base64');
  return buffer.length > 0 ? buffer : null;
}

/** Detecta o formato real pela assinatura binária (magic bytes), sem confiar no MIME declarado. */
export function detectarTipoMimeImagem(conteudo: Buffer): TipoMimeFotoPeca | null {
  if (conteudo.length >= 3 && conteudo[0] === 0xff && conteudo[1] === 0xd8 && conteudo[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    conteudo.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => conteudo[index] === byte)
  ) {
    return 'image/png';
  }
  return null;
}
