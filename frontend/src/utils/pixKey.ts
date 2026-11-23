export type PixKeyType = 'CPF' | 'EMAIL' | 'TELEFONE' | 'EVP'

export const BIOGRAFIA_MIN_LENGTH = 20
export const BIOGRAFIA_MAX_LENGTH = 2000
export const PIX_EMAIL_MAX_LENGTH = 77

const CURATOR_EMAIL_MAX_LENGTH = 254

const VALID_BR_DDDS: ReadonlySet<string> = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
])

export interface PixKeyTypeOption {
  readonly value: PixKeyType
  readonly label: string
  readonly placeholder: string
  readonly hint: string
}

export const PIX_KEY_TYPE_OPTIONS: readonly PixKeyTypeOption[] = [
  {
    value: 'CPF',
    label: 'CPF',
    placeholder: '000.000.000-00',
    hint: 'Informe os 11 dígitos do CPF (com ou sem pontuação).',
  },
  {
    value: 'EMAIL',
    label: 'E-mail',
    placeholder: 'artesao@atelie.com.br',
    hint: 'Até 77 caracteres no padrão aceito pelo DICT.',
  },
  {
    value: 'TELEFONE',
    label: 'Celular (+55)',
    placeholder: '+5581999998888',
    hint: 'Formato internacional brasileiro E.164 com +55, DDD válido e 9 dígitos.',
  },
  {
    value: 'EVP',
    label: 'Chave aleatória (EVP)',
    placeholder: '550e8400-e29b-41d4-a716-446655440000',
    hint: 'UUID v4 gerado pelo seu banco/PSP no padrão DICT.',
  },
] as const

export type ClientPixValidationResult =
  | { readonly valid: true; readonly type: PixKeyType; readonly normalizedValue: string }
  | { readonly valid: false; readonly reason: string }

export type ClientEmailValidationResult =
  | { readonly valid: true; readonly normalizedEmail: string }
  | { readonly valid: false; readonly reason: string }

const CPF_INPUT_REGEX = /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/
const ALL_EQUAL_DIGITS_REGEX = /^(\d)\1{10}$/
const BR_E164_MOBILE_INPUT_REGEX = /^\+55[\s-]?(?:\(\d{2}\)|\d{2})[\s-]?9\d{4}[\s-]?\d{4}$/
const EVP_UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_LOCAL_PART_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i
const EMAIL_DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const EMAIL_TLD_REGEX = /^[a-z]{2,}$/i

function validateCpfDigits(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || ALL_EQUAL_DIGITS_REGEX.test(digits)) {
    return false
  }

  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * (10 - i)
  }
  const firstRemainder = (sum * 10) % 11
  const expectedFirst = firstRemainder === 10 ? 0 : firstRemainder
  if (expectedFirst !== Number(digits[9])) {
    return false
  }

  sum = 0
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * (11 - i)
  }
  const secondRemainder = (sum * 10) % 11
  const expectedSecond = secondRemainder === 10 ? 0 : secondRemainder
  return expectedSecond === Number(digits[10])
}

function isValidEmailSyntax(value: string, maxLength: number): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength || /\s/.test(trimmed)) {
    return false
  }

  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i)
    if (code < 32 || code === 127) return false
  }

  const parts = trimmed.split('@')
  if (parts.length !== 2) return false

  const [local, domain] = parts
  if (
    !local ||
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !EMAIL_LOCAL_PART_REGEX.test(local)
  ) {
    return false
  }

  if (!domain || domain.length > 253) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false

  for (const label of labels) {
    if (!EMAIL_DOMAIN_LABEL_REGEX.test(label)) return false
  }

  const tld = labels[labels.length - 1]
  return Boolean(tld && EMAIL_TLD_REGEX.test(tld))
}

/**
 * Validação client-side auxiliar dos formatos de Chave Pix DICT/BACEN.
 * Não substitui a validação do backend nem comprova registro ou titularidade no DICT.
 */
export function validatePixKeyClient(
  rawValue: string,
  expectedType: PixKeyType,
): ClientPixValidationResult {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    return { valid: false, reason: 'Informe a Chave Pix.' }
  }

  switch (expectedType) {
    case 'CPF': {
      if (!CPF_INPUT_REGEX.test(trimmed)) {
        return {
          valid: false,
          reason: 'CPF inválido: informe 11 dígitos ou o formato XXX.XXX.XXX-XX.',
        }
      }
      const normalized = trimmed.replace(/[.-]/g, '')
      if (!validateCpfDigits(normalized)) {
        return { valid: false, reason: 'CPF inválido: dígitos verificadores incorretos.' }
      }
      return { valid: true, type: 'CPF', normalizedValue: normalized }
    }

    case 'EMAIL': {
      if (trimmed.length > PIX_EMAIL_MAX_LENGTH) {
        return {
          valid: false,
          reason: `E-mail Pix deve ter no máximo ${PIX_EMAIL_MAX_LENGTH} caracteres.`,
        }
      }
      if (!isValidEmailSyntax(trimmed, PIX_EMAIL_MAX_LENGTH)) {
        return { valid: false, reason: 'Chave Pix de e-mail inválida.' }
      }
      return { valid: true, type: 'EMAIL', normalizedValue: trimmed.toLowerCase() }
    }

    case 'TELEFONE': {
      if (!BR_E164_MOBILE_INPUT_REGEX.test(trimmed)) {
        return {
          valid: false,
          reason:
            'Celular deve estar no padrão brasileiro E.164 (+55 + DDD + 9 + 8 dígitos).',
        }
      }
      const normalized = trimmed.replace(/[\s()-]/g, '')
      const ddd = normalized.slice(3, 5)
      if (!VALID_BR_DDDS.has(ddd)) {
        return { valid: false, reason: `DDD brasileiro '${ddd}' inválido para Chave Pix.` }
      }
      return { valid: true, type: 'TELEFONE', normalizedValue: normalized }
    }

    case 'EVP': {
      if (!EVP_UUID_V4_REGEX.test(trimmed)) {
        return {
          valid: false,
          reason: 'Chave aleatória (EVP) deve ser um UUID v4 válido no formato DICT.',
        }
      }
      return { valid: true, type: 'EVP', normalizedValue: trimmed.toLowerCase() }
    }
  }
}

export function validateCuratorEmailClient(rawValue: string): ClientEmailValidationResult {
  const trimmed = rawValue.trim().toLowerCase()
  if (!trimmed) {
    return { valid: false, reason: 'Informe o e-mail do usuário que atuará como curador.' }
  }
  if (!isValidEmailSyntax(trimmed, CURATOR_EMAIL_MAX_LENGTH)) {
    return { valid: false, reason: 'Informe um endereço de e-mail válido.' }
  }
  return { valid: true, normalizedEmail: trimmed }
}
