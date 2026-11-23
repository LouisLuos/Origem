import { z } from 'zod';
import {
  createIdParamSchema,
  optionalTextQuery,
  paginationQueryFields,
} from './request.validator.js';

/**
 * Schema de validação da query string de listagem de produtos (`GET /api/v1/produtos`).
 */
export const listarProdutosQuerySchema = z.object({
  ...paginationQueryFields,
  technique: optionalTextQuery('technique'),
  hub: optionalTextQuery('hub'),
});

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
