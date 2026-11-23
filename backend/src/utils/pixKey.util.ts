import type { TipoChavePix } from '../repositories/contracts/hu03.contracts.js';
import { AppError } from './AppError.js';

/** Limite oficial do DICT/BACEN para chave Pix do tipo e-mail. */
export const PIX_EMAIL_MAX_LENGTH = 77;

/** Conjunto oficial de códigos DDD brasileiros ativos pela ANATEL. */
export const VALID_BR_DDDS: ReadonlySet<string> = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

export type DictVerificationStatus = 'NAO_VERIFICADA_LOCALMENTE' | 'VERIFICADA_DICT';

export type PixKeyFormatValidationResult =
  | { readonly valid: true; readonly type: TipoChavePix }
  | { readonly valid: false; readonly reason: string };

export interface ValidatedPixKey {
  readonly type: TipoChavePix;
  readonly normalizedValue: string;
  readonly maskedValue: string;
  readonly dictVerificationStatus: 'NAO_VERIFICADA_LOCALMENTE';
}

export interface PixKeyDirectoryVerificationResult {
  readonly status: DictVerificationStatus;
  readonly registered: boolean;
  readonly ownershipVerified: boolean;
}

/**
 * Porta reservada para futura integração externa com DICT/PSP autorizado.
 * Validações locais de formato NUNCA comprovam existência nem titularidade real no BACEN.
 */
export interface PixKeyDirectoryVerifier {
  verifyRegistration(
    normalizedKey: string,
    type: TipoChavePix,
    ownerCpfCnpj?: string,
  ): Promise<PixKeyDirectoryVerificationResult>;
}

const CPF_INPUT_REGEX = /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/;
const ALL_EQUAL_DIGITS_REGEX = /^(\d)\1{10}$/;
const BR_E164_MOBILE_INPUT_REGEX = /^\+55[\s-]?(?:\(\d{2}\)|\d{2})[\s-]?9\d{4}[\s-]?\d{4}$/;
const EVP_UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERIC_UUID_SHAPE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_LOCAL_PART_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const EMAIL_DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const EMAIL_TLD_REGEX = /^[a-z]{2,}$/i;

function validateCpfDigits(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || ALL_EQUAL_DIGITS_REGEX.test(digits)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * (10 - i);
  }
  const firstRemainder = (sum * 10) % 11;
  const expectedFirst = firstRemainder === 10 ? 0 : firstRemainder;
  if (expectedFirst !== Number(digits[9])) {
    return false;
  }

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * (11 - i);
  }
  const secondRemainder = (sum * 10) % 11;
  const expectedSecond = secondRemainder === 10 ? 0 : secondRemainder;
  return expectedSecond === Number(digits[10]);
}

function validateCpfFormat(trimmed: string): PixKeyFormatValidationResult {
  if (!CPF_INPUT_REGEX.test(trimmed)) {
    return {
      valid: false,
      reason: 'CPF inválido: informe 11 dígitos ou o formato XXX.XXX.XXX-XX.',
    };
  }

  const digits = trimmed.replace(/[.-]/g, '');
  if (!validateCpfDigits(digits)) {
    return {
      valid: false,
      reason: 'CPF inválido: dígitos verificadores incorretos.',
    };
  }

  return { valid: true, type: 'CPF' };
}

/**
 * Valida sintaxe de e-mail dentro de um limite máximo de caracteres configurável
 * (77 caracteres no DICT Pix; até 254 caracteres para e-mails cadastrais).
 */
export function isValidEmailSyntax(value: string, maxLength = PIX_EMAIL_MAX_LENGTH): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[\s\x00-\x1f\x7f]/.test(trimmed)) {
    return false;
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !EMAIL_LOCAL_PART_REGEX.test(local)
  ) {
    return false;
  }

  if (!domain || domain.length > 253) {
    return false;
  }

  const labels = domain.split('.');
  if (labels.length < 2) {
    return false;
  }

  for (const label of labels) {
    if (!EMAIL_DOMAIN_LABEL_REGEX.test(label)) {
      return false;
    }
  }

  const tld = labels[labels.length - 1];
  return Boolean(tld && EMAIL_TLD_REGEX.test(tld));
}

function validateEmailPixFormat(trimmed: string): PixKeyFormatValidationResult {
  if (/[\s\x00-\x1f\x7f]/.test(trimmed) || !trimmed.includes('@')) {
    return { valid: false, reason: 'Chave Pix de e-mail inválida.' };
  }

  if (trimmed.length > PIX_EMAIL_MAX_LENGTH) {
    return {
      valid: false,
      reason: `Chave Pix de e-mail excede o limite oficial de ${PIX_EMAIL_MAX_LENGTH} caracteres do DICT.`,
    };
  }

  if (!isValidEmailSyntax(trimmed, PIX_EMAIL_MAX_LENGTH)) {
    return { valid: false, reason: 'Chave Pix de e-mail inválida.' };
  }

  return { valid: true, type: 'EMAIL' };
}

function extractMobileDigits(trimmed: string): string {
  return trimmed.replace(/[\s()-]/g, '');
}

function validatePhonePixFormat(trimmed: string): PixKeyFormatValidationResult {
  if (!BR_E164_MOBILE_INPUT_REGEX.test(trimmed)) {
    return {
      valid: false,
      reason:
        'Chave Pix celular deve estar no formato internacional brasileiro E.164 (+55 + DDD + 9 + 8 dígitos).',
    };
  }

  const normalized = extractMobileDigits(trimmed);
  const ddd = normalized.slice(3, 5);
  if (!VALID_BR_DDDS.has(ddd)) {
    return {
      valid: false,
      reason: `DDD brasileiro '${ddd}' não reconhecido para Chave Pix celular.`,
    };
  }

  return { valid: true, type: 'TELEFONE' };
}

function validateEvpPixFormat(trimmed: string): PixKeyFormatValidationResult {
  if (!EVP_UUID_V4_REGEX.test(trimmed)) {
    return {
      valid: false,
      reason: 'Chave Pix aleatória (EVP) deve ser um UUID v4 válido no padrão aceito pelo DICT.',
    };
  }

  return { valid: true, type: 'EVP' };
}

function inferCandidateType(trimmed: string): TipoChavePix | null {
  if (trimmed.includes('@')) {
    return 'EMAIL';
  }
  if (trimmed.startsWith('+')) {
    return 'TELEFONE';
  }
  if (GENERIC_UUID_SHAPE_REGEX.test(trimmed) || (trimmed.includes('-') && /^[0-9a-f-]+$/i.test(trimmed) && trimmed.length >= 20)) {
    return 'EVP';
  }
  if (CPF_INPUT_REGEX.test(trimmed)) {
    return 'CPF';
  }
  return null;
}

const VALIDATORS_BY_TYPE: Record<TipoChavePix, (trimmed: string) => PixKeyFormatValidationResult> = {
  CPF: validateCpfFormat,
  EMAIL: validateEmailPixFormat,
  TELEFONE: validatePhonePixFormat,
  EVP: validateEvpPixFormat,
};

/**
 * Detecta automaticamente o tipo DICT apenas quando o valor é válido para um dos quatro formatos.
 */
export function detectPixKeyType(rawValue: string): TipoChavePix | null {
  const result = validatePixKeyFormat(rawValue);
  return result.valid ? result.type : null;
}

/**
 * Valida apenas a sintaxe local da Chave Pix (não verifica existência ou titularidade no DICT).
 */
export function validatePixKeyFormat(
  rawValue: string,
  expectedType?: TipoChavePix,
): PixKeyFormatValidationResult {
  if (typeof rawValue !== 'string') {
    return { valid: false, reason: 'Chave Pix deve ser informada como texto.' };
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Chave Pix é obrigatória.' };
  }

  if (expectedType) {
    return VALIDATORS_BY_TYPE[expectedType](trimmed);
  }

  const candidateType = inferCandidateType(trimmed);
  if (!candidateType) {
    return {
      valid: false,
      reason:
        'Formato de Chave Pix não reconhecido. Utilize CPF, e-mail (até 77 chars), celular brasileiro (+55...) ou UUID EVP.',
    };
  }

  return VALIDATORS_BY_TYPE[candidateType](trimmed);
}

/**
 * Normaliza a Chave Pix para sua representação canônica DICT após validar o tipo informado.
 */
export function normalizePixKey(rawValue: string, type: TipoChavePix): string {
  const validation = validatePixKeyFormat(rawValue, type);
  if (!validation.valid) {
    throw new AppError(validation.reason, 400);
  }

  const trimmed = rawValue.trim();
  switch (type) {
    case 'CPF':
      return trimmed.replace(/[.-]/g, '');
    case 'EMAIL':
      return trimmed.toLowerCase();
    case 'TELEFONE':
      return extractMobileDigits(trimmed);
    case 'EVP':
      return trimmed.toLowerCase();
  }
}

/**
 * Mascara a Chave Pix para exibição segura em respostas HTTP e painéis,
 * garantindo que o valor original completo não seja exposto desnecessariamente.
 */
export function maskPixKey(rawOrNormalizedValue: string, type: TipoChavePix): string {
  const normalized = normalizePixKey(rawOrNormalizedValue, type);

  switch (type) {
    case 'CPF':
      return `***.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-**`;
    case 'EMAIL': {
      const [local, domain] = normalized.split('@');
      const visiblePrefix = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
      return `${visiblePrefix}***@${domain}`;
    }
    case 'TELEFONE':
      return `${normalized.slice(0, 5)}*****${normalized.slice(-4)}`;
    case 'EVP':
      return `${normalized.slice(0, 8)}-****-****-****-********${normalized.slice(-4)}`;
  }
}

/**
 * Executa validação sintática e normalização canônica em um passo coeso,
 * sinalizando explicitamente que a verificação DICT permanece pendente.
 */
export function validateAndNormalizePixKey(
  rawValue: string,
  expectedType?: TipoChavePix,
): ValidatedPixKey {
  const validation = validatePixKeyFormat(rawValue, expectedType);
  if (!validation.valid) {
    throw new AppError(validation.reason, 400);
  }

  const normalizedValue = normalizePixKey(rawValue, validation.type);
  const maskedValue = maskPixKey(normalizedValue, validation.type);

  return {
    type: validation.type,
    normalizedValue,
    maskedValue,
    dictVerificationStatus: 'NAO_VERIFICADA_LOCALMENTE',
  };
}
