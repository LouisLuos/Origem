import { artesaoRepository } from '../repositories/artesao.repository.js';
import type { ArtesaoPublico } from '../repositories/artesao.repository.js';

export interface ListarArtesaosQuery {
  page?: number;
  limit?: number;
  q?: string;
  hub?: string;
  technique?: string;
}

export interface ListarArtesaosResultado {
  dados: ArtesaoPublico[];
  meta: {
    totalItens: number;
    paginaAtual: number;
    totalPaginas: number;
    itensPorPagina: number;
  };
}

export class ArtesaoService {
  async listar(options: ListarArtesaosQuery = {}): Promise<ListarArtesaosResultado> {
    let artesaos = await artesaoRepository.findAll();

    // Filtro por busca textual (nome, polo ou técnica)
    if (options.q) {
      const termo = options.q.toLowerCase().trim();
      artesaos = artesaos.filter(
        (a) =>
          a.name.toLowerCase().includes(termo) ||
          a.hub.toLowerCase().includes(termo) ||
          a.technique.toLowerCase().includes(termo),
      );
    }

    if (options.hub) {
      const hubLower = options.hub.toLowerCase().trim();
      artesaos = artesaos.filter((a) => a.hub.toLowerCase() === hubLower);
    }

    if (options.technique) {
      const techLower = options.technique.toLowerCase().trim();
      artesaos = artesaos.filter((a) => a.technique.toLowerCase() === techLower);
    }

    const totalItens = artesaos.length;
    const page = Math.max(1, Number(options.page) || 1);
    const limit = options.limit !== undefined ? Math.max(1, Number(options.limit)) : 20;
    const totalPaginas = Math.ceil(totalItens / limit) || 1;

    const inicio = (page - 1) * limit;
    const dados = artesaos.slice(inicio, inicio + limit);

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

  async buscarPorId(id: string): Promise<ArtesaoPublico | null> {
    return artesaoRepository.findById(id);
  }
}

export const artesaoService = new ArtesaoService();
