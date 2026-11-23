import { z } from 'zod';
import {
  createIdParamSchema,
  optionalTextQuery,
  paginationQueryFields,
} from './request.validator.js';

function optionalBooleanQuery(fieldName: string) {
  const msg = `O parâmetro '${fieldName}' deve ser 'true' ou 'false'.`;
  return z.unknown().optional().transform((val, ctx): boolean | undefined => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    if (typeof val !== 'string') {
      ctx.addIssue({ code: 'custom', message: msg });
      return z.NEVER;
    }
    const normalized = val.trim().toLowerCase();
    if (normalized === '') return undefined;
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    ctx.addIssue({ code: 'custom', message: msg });
    return z.NEVER;
  });
}

/**
 * Schema de validação da query string de listagem de produtos (`GET /api/v1/produtos`).
 * Suporta filtros combinados de polo (`hub`/`polo`), tipologia (`technique`/`tipologia`/`categoria`),
 * busca textual FTS (`q`/`busca`) e flag de disponibilidade (`apenasDisponiveis`) — HU-07.
 */
export const listarProdutosQuerySchema = z
  .object({
    ...paginationQueryFields,
    technique: optionalTextQuery('technique'),
    tipologia: optionalTextQuery('tipologia'),
    categoria: optionalTextQuery('categoria'),
    hub: optionalTextQuery('hub'),
    polo: optionalTextQuery('polo'),
    q: optionalTextQuery('q'),
    busca: optionalTextQuery('busca'),
    apenasDisponiveis: optionalBooleanQuery('apenasDisponiveis'),
  })
  .transform(({ tipologia, categoria, technique, polo, hub, busca, q, ...rest }) => ({
    ...rest,
    technique: technique ?? tipologia ?? categoria,
    hub: hub ?? polo,
    q: q ?? busca,
  }));

/**
 * Schema de validação da query string de listagem de artesãos (`GET /api/v1/artesaos`).
 * Mantém o alias `nome` para retrocompatibilidade com consumidores que não enviam `q`.
 */
export const listarArtesaosQuerySchema = z
  .object({
    ...paginationQueryFields,
    q: optionalTextQuery('q'),
    nome: optionalTextQuery('nome'),
    hub: optionalTextQuery('hub'),
    technique: optionalTextQuery('technique'),
  })
  .transform(({ nome, q, ...rest }) => ({
    ...rest,
    q: q ?? nome,
  }));

export const produtoIdParamSchema = createIdParamSchema('produto');
export const artesaoIdParamSchema = createIdParamSchema('artesão');
