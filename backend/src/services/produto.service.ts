import { produtoRepository } from '../repositories/produto.repository.js';
import type { ProdutoPublico } from '../repositories/produto.repository.js';
import { paginate } from '../utils/pagination.util.js';
import type { PaginatedResult } from '../utils/pagination.util.js';

export interface ListarProdutosQuery {
  page?: number;
  limit?: number;
  technique?: string;
  hub?: string;
}

export type ListarProdutosResultado = PaginatedResult<ProdutoPublico>;

export class ProdutoService {
  async listar(options: ListarProdutosQuery = {}): Promise<ListarProdutosResultado> {
    let produtos = await produtoRepository.findAll();

    if (options.technique) {
      const techLower = options.technique.trim().toLowerCase();
      produtos = produtos.filter((p) => p.technique.toLowerCase() === techLower);
    }

    if (options.hub) {
      const hubLower = options.hub.trim().toLowerCase();
      produtos = produtos.filter((p) => p.hub.toLowerCase() === hubLower);
    }

    return paginate(produtos, {
      page: options.page,
      limit: options.limit,
      defaultLimit: 10,
    });
  }

  async buscarPorId(id: string): Promise<ProdutoPublico | null> {
    return produtoRepository.findById(id);
  }
}

export const produtoService = new ProdutoService();
