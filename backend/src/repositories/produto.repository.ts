import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ProdutoPublico {
  id: string;
  title: string;
  artisan: string;
  hub: string;
  technique: string;
  price: number;
  stock: number;
  active: boolean;
  ownerEmail: string;
  imageUrl: string;
  imageAlt: string;
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

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Mapeamento das técnicas do catálogo da IA para a taxonomia visual do Design System.
 */
const TECHNIQUE_MAP: Record<string, string> = {
  ceramica: 'Cerâmica Figurativa',
  couro: 'Couro',
  xilogravura: 'Xilogravura',
  papel_mache: 'Papel Machê',
  renda_renascenca: 'Renda Renascença',
  bordado: 'Bordado',
};

/**
 * Repositório em memória que consome os dados oficiais de catalogo.json.
 * Futuramente este repositório será substituído ou estendido pela integração Prisma/PostgreSQL.
 */
export class ProdutoRepository {
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

  private mapRawToPublic(item: RawProdutoIA): ProdutoPublico {
    return {
      id: item.id,
      title: item.nome,
      artisan: item.artesao,
      hub: item.polo,
      technique: TECHNIQUE_MAP[item.tecnica] ?? item.tecnica,
      price: item.preco,
      stock: item.estoque,
      active: true,
      ownerEmail: `${slugify(item.artesao)}@artesaos.origem.com`,
      imageUrl: '',
      imageAlt: item.nome,
    };
  }

  async findAll(): Promise<ProdutoPublico[]> {
    const filePath = this.resolveCatalogPath();
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as CatalogoIAPayload;
    return (data.produtos ?? []).map((item) => this.mapRawToPublic(item));
  }

  async findById(id: string): Promise<ProdutoPublico | null> {
    const all = await this.findAll();
    return all.find((p) => p.id === id) ?? null;
  }
}

export const produtoRepository = new ProdutoRepository();
