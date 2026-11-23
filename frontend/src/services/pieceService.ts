import { apiRequest, isApiError } from './api'
import { techniques } from '@/design-system/tokens'

/** Regras de domínio espelhadas do backend (backend/src/validators/peca.validator.ts). */
export const PIECE_MIN_WEIGHT_GRAMS = 50
export const PIECE_MIN_WEIGHT_MESSAGE = 'O peso mínimo embalado para cotação de frete é 50g'
export const PIECE_MIN_PHOTOS = 2
export const PIECE_MAX_PHOTOS = 5
export const PIECE_MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const PIECE_PHOTO_TYPES = ['image/jpeg', 'image/png'] as const
export const PIECE_TITLE_MAX = 150
export const PIECE_DESCRIPTION_MAX = 5000
export const PIECE_MIN_STOCK = 1
export const PIECE_DEFAULT_STOCK = 1
export const LOW_STOCK_THRESHOLD = 3

/**
 * Tipologias homologadas aceitas pelo backend: técnicas do Design System mais as do catálogo
 * (Couro e Papel Machê). Deve permanecer idêntica a `TIPOLOGIAS_HOMOLOGADAS` em
 * backend/src/constants/taxonomy.ts.
 */
export const pieceTypologies = [...techniques, 'Couro', 'Papel Machê'] as const

export type PiecePhotoType = (typeof PIECE_PHOTO_TYPES)[number]

export interface PiecePhotoPayload {
  tipoMime: PiecePhotoType
  conteudoBase64: string
}

/** Corpo de `POST /atelies/:atelieId/pecas`. */
export interface CreatePiecePayload {
  titulo: string
  descricao: string
  tipologia: string
  preco: number
  pesoGramas: number
  comprimentoCm: number
  larguraCm: number
  alturaCm: number
  isFragil: boolean
  quantidadeEstoque: number
  fotos: PiecePhotoPayload[]
  indiceFotoPrincipal: number
}

export interface CreatedPiece {
  id: string
  atelieId: string
  titulo: string
  descricao?: string
  tipologia?: string
  preco?: number
  pesoGramas?: number
  comprimentoCm?: number
  larguraCm?: number
  alturaCm?: number
  quantidadeEstoque: number
  status: 'DISPONIVEL' | 'RESERVADA' | 'VENDIDA' | 'ARQUIVADA'
  isFragil: boolean
  fotos: { id: string; url: string; isPrincipal: boolean }[]
}

export type StudioPiece = CreatedPiece

export type UpdatePieceStockPayload =
  | { readonly quantidadeEstoque: number }
  | { readonly delta: number }

export type PieceErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'conflict'
  | 'unavailable'
  | 'too_large'
  | 'network'
  | 'unknown'

export interface ClassifiedPieceError {
  kind: PieceErrorKind
  message: string
}

/** Converte um arquivo de imagem em base64 puro (sem o prefixo `data:`). */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(new Error(`Não foi possível ler a foto "${file.name}".`))
    reader.readAsDataURL(file)
  })
}

/** Classifica falhas da publicação e gestão de estoque sem jamais tratá-las como sucesso. */
export function classifyPieceError(reason: unknown): ClassifiedPieceError {
  if (!isApiError(reason)) {
    return {
      kind: 'unknown',
      message: reason instanceof Error ? reason.message : 'Não foi possível concluir a operação da peça.',
    }
  }
  switch (reason.status) {
    case 0:
      return { kind: 'network', message: reason.message }
    case 401:
      return {
        kind: 'unauthenticated',
        message: 'Sua sessão não foi reconhecida pelo servidor. Entre novamente para continuar.',
      }
    case 403:
      return { kind: 'forbidden', message: reason.message }
    case 409:
      return { kind: 'conflict', message: reason.message }
    case 413:
      return { kind: 'too_large', message: reason.message }
    case 422:
      return { kind: 'validation', message: reason.message }
    case 503:
      return {
        kind: 'unavailable',
        message: `${reason.message} Nenhuma alteração foi gravada.`,
      }
    default:
      return { kind: 'unknown', message: reason.message }
  }
}

export const pieceService = {
  /** Lista peças reais cadastradas no ateliê no PostgreSQL. */
  async listByAtelier(atelieId: string): Promise<StudioPiece[]> {
    const response = await apiRequest<{ dados: StudioPiece[] }>(
      `/atelies/${encodeURIComponent(atelieId)}/pecas`,
      undefined,
      'Não foi possível carregar as peças do ateliê.',
    )
    return response.dados
  },

  /** Publica uma peça no ateliê. Só resolve quando o servidor confirma com 201. */
  async create(atelieId: string, payload: CreatePiecePayload): Promise<CreatedPiece> {
    return apiRequest<CreatedPiece>(
      `/atelies/${encodeURIComponent(atelieId)}/pecas`,
      { method: 'POST', body: JSON.stringify(payload) },
      'Não foi possível publicar a peça.',
    )
  },

  /** Atualiza o estoque de uma peça pertencente ao ateliê no PostgreSQL. */
  async updateStock(
    atelieId: string,
    pecaId: string,
    payload: UpdatePieceStockPayload,
  ): Promise<StudioPiece> {
    return apiRequest<StudioPiece>(
      `/atelies/${encodeURIComponent(atelieId)}/pecas/${encodeURIComponent(pecaId)}/estoque`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      'Não foi possível atualizar o estoque da peça.',
    )
  },
}
