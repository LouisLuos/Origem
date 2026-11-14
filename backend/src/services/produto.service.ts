import { produtoRepository } from '../repositories/produto.repository.js';
import type { ProdutoPublico } from '../repositories/produto.repository.js';

export interface ListarProdutosQuery {
  page?: number;
  limit?: number;
  technique?: string;
  hub?: string;
}

export interface ListarProdutosResultado {
  dados: ProdutoPublico[];
  meta: {
    totalItens: number;
    paginaAtual: number;
    totalPaginas: number;
    itensPorPagina: number;
  };
}

export class ProdutoService {
  async listar(options: ListarProdutosQuery = {}): Promise<ListarProdutosResultado> {
    let produtos = await produtoRepository.findAll();

    if (options.technique) {
      const techLower = options.technique.toLowerCase();
      produtos = produtos.filter((p) => p.technique.toLowerCase() === techLower);
    }

    if (options.hub) {
      const hubLower = options.hub.toLowerCase();
      produtos = produtos.filter((p) => p.hub.toLowerCase() === hubLower);
    }

    const totalItens = produtos.length;
    const page = Math.max(1, Number(options.page) || 1);
    const limit = options.limit !== undefined ? Math.max(1, Number(options.limit)) : 10;
    const totalPaginas = Math.ceil(totalItens / limit) || 1;

    const inicio = (page - 1) * limit;
    const dados = produtos.slice(inicio, inicio + limit);

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

  async buscarPorId(id: string): Promise<ProdutoPublico | null> {
    return produtoRepository.findById(id);
  }
}

export const produtoService = new ProdutoService();
