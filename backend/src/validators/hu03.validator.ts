import { z } from 'zod';
import type { TipoChavePix } from '../repositories/contracts/hu03.contracts.js';
import {
  isValidEmailSyntax,
  maskPixKey,
  normalizePixKey,
  validatePixKeyFormat,
} from '../utils/pixKey.util.js';

export const BIOGRAFIA_MIN_LENGTH = 20;
export const BIOGRAFIA_MAX_LENGTH = 2000;

const CURATOR_EMAIL_MAX_LENGTH = 254;
const VALID_PIX_TYPES = new Set<TipoChavePix>(['CPF', 'EMAIL', 'TELEFONE', 'EVP']);

interface ValidationCtx {
  addIssue: (issue: { code: 'custom'; path?: Array<string | number>; message: string }) => void;
}

function requiredStringField(label: string) {
  return z.unknown().transform((val, ctx): string => {
    if (typeof val !== 'string') {
      ctx.addIssue({
        code: 'custom',
        message: `${label} é obrigatório(a) e deve ser um texto válido.`,
      });
      return z.NEVER;
    }

    const trimmed = val.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} é obrigatório(a).`,
      });
      return z.NEVER;
    }

    return trimmed;
  });
}

export const tipoChavePixSchema = z
  .unknown()
  .optional()
  .transform((val, ctx): TipoChavePix | undefined => {
    if (val === undefined) {
      return undefined;
    }

    if (typeof val !== 'string' || !VALID_PIX_TYPES.has(val as TipoChavePix)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Tipo de Chave Pix inválido. Valores aceitos: CPF, EMAIL, TELEFONE ou EVP.',
      });
      return z.NEVER;
    }

    return val as TipoChavePix;
  });

export const biografiaCulturalSchema = requiredStringField('Biografia cultural').transform(
  (trimmed, ctx): string => {
    if (trimmed.length < BIOGRAFIA_MIN_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: `Biografia cultural deve ter no mínimo ${BIOGRAFIA_MIN_LENGTH} caracteres.`,
      });
      return z.NEVER;
    }

    if (trimmed.length > BIOGRAFIA_MAX_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        message: `Biografia cultural deve ter no máximo ${BIOGRAFIA_MAX_LENGTH} caracteres.`,
      });
      return z.NEVER;
    }

    return trimmed;
  },
);

function parsePixKeyInput(
  chavePix: string,
  tipoChavePix: TipoChavePix | undefined,
  ctx: ValidationCtx,
) {
  const formatResult = validatePixKeyFormat(chavePix, tipoChavePix);
  if (!formatResult.valid) {
    ctx.addIssue({
      code: 'custom',
      path: ['chavePix'],
      message: formatResult.reason,
    });
    return z.NEVER;
  }

  const normalized = normalizePixKey(chavePix, formatResult.type);
  const masked = maskPixKey(normalized, formatResult.type);

  return {
    tipoChavePix: formatResult.type,
    chavePixNormalizada: normalized,
    chavePixMascarada: masked,
    verificacaoDict: 'NAO_VERIFICADA_LOCALMENTE' as const,
  };
}

/**
 * Schema para `POST /api/v1/artesaos/habilitacao`.
 * Rejeita campos fora do contrato por descarte automático do `z.object`, evitando mass assignment.
 */
export const habilitarArtesaoBodySchema = z
  .object({
    biografiaCultural: biografiaCulturalSchema,
    chavePix: requiredStringField('Chave Pix'),
    tipoChavePix: tipoChavePixSchema,
  })
  .transform((data, ctx) => {
    const pix = parsePixKeyInput(data.chavePix, data.tipoChavePix, ctx);
    if (pix === z.NEVER) {
      return z.NEVER;
    }

    return {
      biografiaCultural: data.biografiaCultural,
      ...pix,
    };
  });

/**
 * Schema para `PATCH /api/v1/atelies/:atelieId/chave-pix`.
 */
export const atualizarChavePixBodySchema = z
  .object({
    chavePix: requiredStringField('Chave Pix'),
    tipoChavePix: tipoChavePixSchema,
  })
  .transform((data, ctx) => parsePixKeyInput(data.chavePix, data.tipoChavePix, ctx));

/**
 * Schema para `POST /api/v1/atelies/:atelieId/curadores`.
 */
export const associarCuradorBodySchema = z.object({
  email: requiredStringField('E-mail do curador').transform((trimmed, ctx): string => {
    const normalized = trimmed.toLowerCase();
    if (!isValidEmailSyntax(normalized, CURATOR_EMAIL_MAX_LENGTH)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Informe um e-mail válido para vincular o curador.',
      });
      return z.NEVER;
    }
    return normalized;
  }),
});

function createBoundedIdSchema(fieldLabel: string) {
  return requiredStringField(fieldLabel).transform((trimmed, ctx): string => {
    if (trimmed.length > 100) {
      ctx.addIssue({
        code: 'custom',
        message: `${fieldLabel} excede o tamanho máximo de 100 caracteres.`,
      });
      return z.NEVER;
    }
    return trimmed;
  });
}

export const atelieIdParamSchema = z.object({
  atelieId: createBoundedIdSchema('Identificador do ateliê'),
});

export const curadorVinculoParamsSchema = z.object({
  atelieId: createBoundedIdSchema('Identificador do ateliê'),
  curadorUsuarioId: createBoundedIdSchema('Identificador do curador'),
});

export type HabilitarArtesaoValidatedInput = z.infer<typeof habilitarArtesaoBodySchema>;
export type AtualizarChavePixValidatedInput = z.infer<typeof atualizarChavePixBodySchema>;
export type AssociarCuradorValidatedInput = z.infer<typeof associarCuradorBodySchema>;
