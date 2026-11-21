import { formatTechnique } from '../constants/taxonomy.js';
import { buildArtisanId } from '../utils/string.util.js';
import { loadCatalogPayload } from './catalogLoader.js';
import type { RawProdutoIA } from './catalogLoader.js';
import { prismaFontePecasVitrine, type FontePecasVitrine } from './pecaVitrine.repository.js';

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
  /** Presente nas peças publicadas pela HU-05. */
  description?: string;
  /** Fotos da peça, com a capa primeiro (peças publicadas pela HU-05). */
  gallery?: string[];
}

/**
 * Vitrine pública: combina as peças publicadas no PostgreSQL (HU-05) com o catálogo legado de
 * catalogo.json, preservado por compatibilidade (IA recomendadora e IDs `p01`...). Os IDs não
 * colidem: peças do banco usam UUID.
 */
export class ProdutoRepository {
  constructor(private readonly fontePecas: FontePecasVitrine = prismaFontePecasVitrine) {}

  private async listarPecasPublicadas(): Promise<ProdutoPublico[]> {
    try {
      return await this.fontePecas.listarPublicadas();
    } catch (err) {
      // Indisponibilidade do banco não derruba a vitrine legada; o erro fica registrado.
      console.error('❌ Falha ao carregar peças publicadas para a vitrine:', {
        erro: err instanceof Error ? err.message : typeof err,
      });
      return [];
    }
  }

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

  private findAllLegado(): ProdutoPublico[] {
    const data = loadCatalogPayload();
    return (data.produtos ?? []).map((item) => this.mapRawToPublic(item));
  }

  async findAll(): Promise<ProdutoPublico[]> {
    const publicadas = await this.listarPecasPublicadas();
    return [...publicadas, ...this.findAllLegado()];
  }

  async findById(id: string): Promise<ProdutoPublico | null> {
    const legado = this.findAllLegado().find((p) => p.id === id);
    if (legado) return legado;
    return this.fontePecas.buscarPublicadaPorId(id);
  }
}

export const produtoRepository = new ProdutoRepository();
