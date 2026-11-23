import {
  PIECE_DESCRIPTION_MAX,
  PIECE_MAX_PHOTOS,
  PIECE_MAX_PHOTO_BYTES,
  PIECE_MIN_PHOTOS,
  PIECE_MIN_STOCK,
  PIECE_MIN_WEIGHT_GRAMS,
  PIECE_MIN_WEIGHT_MESSAGE,
  PIECE_PHOTO_TYPES,
  PIECE_TITLE_MAX,
  pieceTypologies,
} from '@/services/pieceService'

export interface PieceDraft {
  title: string
  description: string
  typology: string
  price: string
  stock: string
  weight: string
  length: string
  width: string
  height: string
  isFragile: boolean
  photoCount: number
}

export type PieceDraftField =
  | 'title'
  | 'description'
  | 'typology'
  | 'price'
  | 'stock'
  | 'weight'
  | 'length'
  | 'width'
  | 'height'
  | 'photos'

export type PieceDraftErrors = Partial<Record<PieceDraftField, string>>

/** Converte texto digitado (aceita vírgula decimal) em número; vazio ou inválido vira NaN. */
export function parseDecimal(value: string): number {
  const normalized = value.trim().replace(',', '.')
  return normalized === '' ? Number.NaN : Number(normalized)
}

function positive(value: string, label: string): string | undefined {
  const parsed = parseDecimal(value)
  const capitalized = `${label.charAt(0).toUpperCase()}${label.slice(1)}`
  if (!Number.isFinite(parsed)) return `Informe ${label} em centímetros.`
  if (parsed <= 0) return `${capitalized} deve ser maior que zero.`
  // Banco: comprimento_cm/largura_cm/altura_cm são inteiros
  if (!Number.isInteger(parsed)) return `${capitalized} deve ser informado(a) em centímetros inteiros.`
  return undefined
}

/**
 * Validação local para feedback imediato. Espelha as regras do backend, que permanece a fonte
 * de verdade (a API revalida e responde 422).
 */
export function validatePieceDraft(draft: PieceDraft): PieceDraftErrors {
  const errors: PieceDraftErrors = {}

  const title = draft.title.trim()
  if (!title) errors.title = 'Informe o título da peça.'
  else if (title.length > PIECE_TITLE_MAX) errors.title = `O título deve ter no máximo ${PIECE_TITLE_MAX} caracteres.`

  const description = draft.description.trim()
  if (!description) errors.description = 'Informe a descrição da peça.'
  else if (description.length > PIECE_DESCRIPTION_MAX)
    errors.description = `A descrição deve ter no máximo ${PIECE_DESCRIPTION_MAX} caracteres.`

  if (!(pieceTypologies as readonly string[]).includes(draft.typology)) {
    errors.typology = 'Selecione uma tipologia homologada.'
  }

  const price = parseDecimal(draft.price)
  if (!Number.isFinite(price)) errors.price = 'Informe o preço da peça.'
  else if (price <= 0) errors.price = 'O preço deve ser maior que zero.'
  else if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-6)
    errors.price = 'O preço deve ter no máximo duas casas decimais.'

  const stock = parseDecimal(draft.stock)
  if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < PIECE_MIN_STOCK) {
    errors.stock = 'A quantidade em estoque deve ser um número inteiro maior ou igual a 1.'
  }

  const weight = parseDecimal(draft.weight)
  if (!Number.isFinite(weight)) errors.weight = 'Informe o peso embalado em gramas.'
  else if (weight < PIECE_MIN_WEIGHT_GRAMS) errors.weight = PIECE_MIN_WEIGHT_MESSAGE
  else if (!Number.isInteger(weight)) errors.weight = 'O peso embalado deve ser informado em gramas inteiros.'

  const length = positive(draft.length, 'o comprimento')
  if (length) errors.length = length
  const width = positive(draft.width, 'a largura')
  if (width) errors.width = width
  const height = positive(draft.height, 'a altura')
  if (height) errors.height = height

  if (draft.photoCount < PIECE_MIN_PHOTOS) {
    errors.photos = `A publicação exige no mínimo ${PIECE_MIN_PHOTOS} fotos da peça.`
  } else if (draft.photoCount > PIECE_MAX_PHOTOS) {
    errors.photos = `Envie no máximo ${PIECE_MAX_PHOTOS} fotos por peça.`
  }

  return errors
}

/** Verifica um arquivo antes de adicioná-lo à galeria; devolve a mensagem de erro, se houver. */
export function validatePhotoFile(file: File): string | undefined {
  if (!(PIECE_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}": formato não suportado (use JPEG ou PNG).`
  }
  if (file.size > PIECE_MAX_PHOTO_BYTES) {
    return `"${file.name}": excede o tamanho máximo de ${PIECE_MAX_PHOTO_BYTES / (1024 * 1024)} MB.`
  }
  return undefined
}
