import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

interface RawProdutoIA {
  id: string;
  nome: string;
  artesao: string;
  tecnica: string;
  polo: string;
  categoria?: string;
  preco: number;
  estoque: number;
  pedidos?: number;
}

interface CatalogoIAPayload {
  produtos: RawProdutoIA[];
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const TECHNIQUE_MAP: Record<string, string> = {
  ceramica: 'Cerâmica Figurativa',
  couro: 'Couro',
  xilogravura: 'Xilogravura',
  papel_mache: 'Papel Machê',
  renda_renascenca: 'Renda Renascença',
  bordado: 'Bordado',
};

/**
 * Repositório em memória que extrai os artesãos verificáveis a partir de catalogo.json.
 * Não inventa dados cadastrais inexistentes (fotos, biografias, e-mails).
 */
export class ArtesaoRepository {
  private resolveCatalogPath(): string {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidatePaths = [
      path.resolve(currentDir, '../../../ia-recomendador/dados/catalogo.json'),
      path.resolve(process.cwd(), '../ia-recomendador/dados/catalogo.json'),
      path.resolve(process.cwd(), 'ia-recomendador/dados/catalogo.json'),
    ];

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error('Arquivo catalogo.json não encontrado nas localizações esperadas.');
  }

  async findAll(): Promise<ArtesaoPublico[]> {
    const filePath = this.resolveCatalogPath();
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as CatalogoIAPayload;

    // Agrupa e extrai artesãos únicos preservando a primeira ocorrência
    const seen = new Map<string, ArtesaoPublico>();

    for (const item of data.produtos ?? []) {
      const trimmedName = item.artesao.trim();
      if (!seen.has(trimmedName)) {
        const stableId = `art-${slugify(trimmedName)}`;
        seen.set(trimmedName, {
          id: stableId,
          name: trimmedName,
          hub: item.polo,
          technique: TECHNIQUE_MAP[item.tecnica] ?? item.tecnica,
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
