import { artesaoRepository } from '../repositories/artesao.repository.js';
import type { ArtesaoPublico } from '../repositories/artesao.repository.js';
import { paginate } from '../utils/pagination.util.js';
import type { PaginatedResult } from '../utils/pagination.util.js';

export interface ListarArtesaosQuery {
  page?: number;
  limit?: number;
  q?: string;
  hub?: string;
  technique?: string;
}

export type ListarArtesaosResultado = PaginatedResult<ArtesaoPublico>;

export class ArtesaoService {
  async listar(options: ListarArtesaosQuery = {}): Promise<ListarArtesaosResultado> {
    let artesaos = await artesaoRepository.findAll();

    // Filtro por busca textual (nome, polo ou técnica)
    if (options.q) {
      const termo = options.q.trim().toLowerCase();
      artesaos = artesaos.filter(
        (a) =>
          a.name.toLowerCase().includes(termo) ||
          a.hub.toLowerCase().includes(termo) ||
          a.technique.toLowerCase().includes(termo),
      );
    }

    if (options.hub) {
      const hubLower = options.hub.trim().toLowerCase();
      artesaos = artesaos.filter((a) => a.hub.toLowerCase() === hubLower);
    }

    if (options.technique) {
      const techLower = options.technique.trim().toLowerCase();
      artesaos = artesaos.filter((a) => a.technique.toLowerCase() === techLower);
    }

    return paginate(artesaos, {
      page: options.page,
      limit: options.limit,
      defaultLimit: 20,
    });
  }

  async buscarPorId(id: string): Promise<ArtesaoPublico | null> {
    return artesaoRepository.findById(id);
  }
}

export const artesaoService = new ArtesaoService();
