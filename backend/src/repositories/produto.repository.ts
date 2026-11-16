import { formatTechnique } from '../constants/taxonomy.js';
import { buildArtisanId } from '../utils/string.util.js';
import { loadCatalogPayload } from './catalogLoader.js';
import type { RawProdutoIA } from './catalogLoader.js';

export interface ProdutoPublico {
  id: string;
  title: string;
  artisan: string;
  artisanId: string;
  hub: string;
  technique: string;
  price: number;
  stock: number;
  active: boolean;
  ownerEmail?: string | null;
  imageUrl: string;
  imageAlt: string;
}

/**
 * Repositório em memória que consome os dados oficiais de catalogo.json.
 * Futuramente este repositório será substituído ou estendido pela integração Prisma/PostgreSQL.
 */
export class ProdutoRepository {
  private mapRawToPublic(item: RawProdutoIA): ProdutoPublico {
    const trimmedArtisan = item.artesao.trim();
    return {
      id: item.id,
      title: item.nome,
      artisan: trimmedArtisan,
      artisanId: buildArtisanId(trimmedArtisan),
      hub: item.polo,
      technique: formatTechnique(item.tecnica),
      price: item.preco,
      stock: item.estoque,
      active: true,
      imageUrl: '',
      imageAlt: item.nome,
    };
  }

  async findAll(): Promise<ProdutoPublico[]> {
    const data = loadCatalogPayload();
    return (data.produtos ?? []).map((item) => this.mapRawToPublic(item));
  }

  async findById(id: string): Promise<ProdutoPublico | null> {
    const all = await this.findAll();
    return all.find((p) => p.id === id) ?? null;
  }
}

export const produtoRepository = new ProdutoRepository();
