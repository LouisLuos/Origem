/**
 * Utilitários genéricos para paginação e padronização de metadados em listas no backend.
 */

export interface PaginationMeta {
  totalItens: number;
  paginaAtual: number;
  totalPaginas: number;
  itensPorPagina: number;
}

export interface PaginatedResult<T> {
  dados: T[];
  meta: PaginationMeta;
}

export interface PaginateOptions {
  page?: number;
  limit?: number;
  defaultLimit?: number;
}

/**
 * Aplica paginação em memória a uma coleção de itens e devolve o subconjunto com os metadados calculados.
 *
 * @template T Tipo dos itens da coleção
 * @param items Coleção completa a ser paginada
 * @param options Opções contendo `page`, `limit` e `defaultLimit` (padrão: 10)
 * @returns Objeto contendo o subconjunto `dados` e o objeto `meta`
 */
export function paginate<T>(items: readonly T[], options: PaginateOptions = {}): PaginatedResult<T> {
  const totalItens = items.length;
  const page = Math.max(1, Number(options.page) || 1);
  const defaultLimit = options.defaultLimit !== undefined ? Math.max(1, Number(options.defaultLimit)) : 10;
  const limit = options.limit !== undefined ? Math.max(1, Number(options.limit)) : defaultLimit;
  const totalPaginas = Math.ceil(totalItens / limit) || 1;

  const inicio = (page - 1) * limit;
  const dados = items.slice(inicio, inicio + limit);

  return {
    dados,
    meta: {
      totalItens,
      paginaAtual: page,
      totalPaginas,
      itensPorPagina: limit,
    },
  };
}
