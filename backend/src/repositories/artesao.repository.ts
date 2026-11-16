import { formatTechnique } from '../constants/taxonomy.js';
import { buildArtisanId, slugify } from '../utils/string.util.js';
import { loadCatalogPayload } from './catalogLoader.js';

// Re-exporta slugify para compatibilidade retroativa
export { slugify };

export interface ArtesaoPublico {
  id: string;
  name: string;
  hub: string;
  technique: string;
  bio: string;
  since: number | null;
  photoUrl: string;
  photoAlt: string;
  coverUrl: string;
  coverAlt: string;
  email: string | null;
}

/**
 * Repositório em memória que extrai os artesãos verificáveis a partir de catalogo.json.
 * Não inventa dados cadastrais inexistentes (fotos, biografias, e-mails).
 */
export class ArtesaoRepository {
  async findAll(): Promise<ArtesaoPublico[]> {
    const data = loadCatalogPayload();

    // Agrupa e extrai artesãos únicos preservando a primeira ocorrência
    const seen = new Map<string, ArtesaoPublico>();

    for (const item of data.produtos ?? []) {
      const trimmedName = item.artesao.trim();
      if (!seen.has(trimmedName)) {
        seen.set(trimmedName, {
          id: buildArtisanId(trimmedName),
          name: trimmedName,
          hub: item.polo,
          technique: formatTechnique(item.tecnica),
          bio: '',
          since: null,
          photoUrl: '',
          photoAlt: trimmedName,
          coverUrl: '',
          coverAlt: trimmedName,
          email: null,
        });
      }
    }

    return Array.from(seen.values());
  }

  async findById(id: string): Promise<ArtesaoPublico | null> {
    const all = await this.findAll();
    return all.find((artisan) => artisan.id === id) ?? null;
  }
}

export const artesaoRepository = new ArtesaoRepository();
