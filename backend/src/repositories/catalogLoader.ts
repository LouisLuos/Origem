import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RawProdutoIA {
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

export interface CatalogoIAPayload {
  produtos: RawProdutoIA[];
}

/**
 * Localiza de maneira resiliente o arquivo catalogo.json em diferentes contextos de execução
 * (execução a partir da raiz do monorepo, do diretório backend/ ou via dist compilado).
 */
export function resolveCatalogPath(): string {
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

/**
 * Lê e faz o parsing do arquivo catalogo.json oficial da IA.
 */
export function loadCatalogPayload(): CatalogoIAPayload {
  const filePath = resolveCatalogPath();
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as CatalogoIAPayload;
}
