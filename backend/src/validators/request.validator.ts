import { z } from 'zod';

export const MAX_PAGE_LIMIT = 100;

interface ValidationContext {
  addIssue: (issue: { code: 'custom'; message: string }) => void;
}

const INVALID_QUERY_VALUE = Symbol('INVALID_QUERY_VALUE');

function failValidation(ctx: ValidationContext, message: string): never {
  ctx.addIssue({ code: 'custom', message });
  return z.NEVER;
}

function extractOptionalQueryString(
  val: unknown,
  ctx: ValidationContext,
  invalidTypeMessage: string,
): string | undefined | typeof INVALID_QUERY_VALUE {
  if (val === undefined) {
    return undefined;
  }

  if (typeof val !== 'string') {
    ctx.addIssue({ code: 'custom', message: invalidTypeMessage });
    return INVALID_QUERY_VALUE;
  }

  return val.trim() === '' ? undefined : val;
}

/**
 * Valida parâmetros inteiros positivos opcionais vindos de query strings HTTP.
 * Strings vazias ou ausentes são convertidas para `undefined`; arrays, objetos,
 * textos não numéricos, decimais ou valores fora do intervalo geram `ZodError`.
 */
export function optionalPositiveIntQuery(fieldName: string, max?: number) {
  const rangeMsg =
    max !== undefined
      ? `O parâmetro '${fieldName}' deve ser um número inteiro entre 1 e ${max}.`
      : `O parâmetro '${fieldName}' deve ser um número inteiro maior ou igual a 1.`;

  return z.unknown().transform((val, ctx): number | undefined => {
    const raw = extractOptionalQueryString(val, ctx, rangeMsg);
    if (raw === INVALID_QUERY_VALUE) {
      return z.NEVER;
    }
    if (raw === undefined) {
      return undefined;
    }

    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      return failValidation(ctx, rangeMsg);
    }

    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) {
      return failValidation(ctx, rangeMsg);
    }

    return parsed;
  });
}

/**
 * Valida parâmetros textuais opcionais vindos de query strings HTTP.
 * Aceita apenas texto único; valores vazios ou compostos apenas por espaços viram `undefined`.
 */
export function optionalTextQuery(fieldName: string) {
  const typeMsg = `O parâmetro '${fieldName}' deve ser um texto único.`;

  return z.unknown().transform((val, ctx): string | undefined => {
    const raw = extractOptionalQueryString(val, ctx, typeMsg);
    return raw === INVALID_QUERY_VALUE ? z.NEVER : raw;
  });
}

/**
 * Campos de paginação compartilhados pelos endpoints de listagem da API.
 */
export const paginationQueryFields = {
  page: optionalPositiveIntQuery('page'),
  limit: optionalPositiveIntQuery('limit', MAX_PAGE_LIMIT),
};

/**
 * Cria um schema Zod para extração e validação de parâmetros de rota `:id`.
 */
export function createIdParamSchema(resourceLabel: string) {
  const requiredMsg = `Identificador do ${resourceLabel} é obrigatório.`;

  return z.object({
    id: z.unknown().transform((val, ctx): string => {
      if (typeof val !== 'string' || val.trim() === '') {
        return failValidation(ctx, requiredMsg);
      }

      return val.trim();
    }),
  });
}
