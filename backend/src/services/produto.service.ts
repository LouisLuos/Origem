import { matchesTechniqueTaxonomy } from '../constants/taxonomy.js';
import {
  produtoRepository as defaultProdutoRepository,
  type ProdutoPublico,
  type ProdutoRepositoryPort,
} from '../repositories/produto.repository.js';
import { paginate, type PaginatedResult } from '../utils/pagination.util.js';

export interface ListarProdutosQuery {
  page?: number;
  limit?: number;
  technique?: string;
  hub?: string;
  q?: string;
  apenasDisponiveis?: boolean;
}

export type ListarProdutosResultado = PaginatedResult<ProdutoPublico>;

const STOPWORDS_PT = new Set([
  'a',
  'as',
  'o',
  'os',
  'de',
  'da',
  'das',
  'do',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'e',
  'com',
  'para',
  'por',
]);

function normalizeTextForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Tokeniza consulta textual FTS em português ignorando pontuação e stopwords,
 * aplicando stemming leve de sufixos plurais ('s') para harmonizar com o dicionário
 * `portuguese` do PostgreSQL (`to_tsvector('portuguese', ...)`).
 */
export function extrairTokensBuscaFts(query: string): string[] {
  const normalized = normalizeTextForSearch(query);
  if (!normalized) return [];

  return normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOPWORDS_PT.has(token));
}

function tokenMatchesText(token: string, normalizedTarget: string): boolean {
  if (normalizedTarget.includes(token)) return true;
  if (token.endsWith('s') && token.length > 3) {
    const singular = token.slice(0, -1);
    if (normalizedTarget.includes(singular)) return true;
  }
  return false;
}

/**
 * Calcula o score de relevância textual FTS (compatível com pesos A=1.0 para título
 * e B=0.4 para descrição do `ts_rank` no PostgreSQL). Retorna 0 se algum termo obrigatório
 * da consulta não estiver presente no documento (`plainto_tsquery` semântica AND).
 */
export function calcularRelevanciaFts(produto: ProdutoPublico, query: string): number {
  if (produto.relevanceScore !== undefined && produto.relevanceScore > 0) {
    return produto.relevanceScore;
  }

  const tokens = extrairTokensBuscaFts(query);
  if (tokens.length === 0) return 0;

  const tituloNorm = normalizeTextForSearch(produto.title);
  const descricaoNorm = normalizeTextForSearch(produto.description ?? '');
  const documentoCompleto = `${tituloNorm} ${descricaoNorm}`;

  let score = 0;

  for (const token of tokens) {
    const inTitle = tokenMatchesText(token, tituloNorm);
    const inDesc = tokenMatchesText(token, descricaoNorm);

    if (!inTitle && !inDesc && !tokenMatchesText(token, documentoCompleto)) {
      return 0;
    }

    if (inTitle) score += 1.0;
    if (inDesc) score += 0.4;
  }

  // Bônus quando a frase exata aparece no título
  const fraseNorm = normalizeTextForSearch(query);
  if (fraseNorm && tituloNorm.includes(fraseNorm)) {
    score += 0.5;
  }

  return Number(score.toFixed(6));
}

export class ProdutoService {
  constructor(private readonly repository: ProdutoRepositoryPort = defaultProdutoRepository) {}

  async listar(options: ListarProdutosQuery = {}): Promise<ListarProdutosResultado> {
    const temFiltroCombinado = Boolean(options.technique && options.hub);
    const temBuscaTextual = Boolean(options.q && options.q.trim().length > 0);
    // Cenário 1 e 2 da HU-07 exigem exibir apenas peças disponíveis nas buscas/filtragens combinadas
    const exigirDisponibilidade =
      options.apenasDisponiveis ?? (temFiltroCombinado || temBuscaTextual);

    let produtos = await this.repository.findAll({
      technique: options.technique,
      hub: options.hub,
      q: options.q,
      apenasDisponiveis: exigirDisponibilidade,
    });

    if (exigirDisponibilidade) {
      produtos = produtos.filter(
        (p) => p.active && p.stock > 0 && (p.status === undefined || p.status === 'DISPONIVEL'),
      );
    }

    if (options.technique) {
      produtos = produtos.filter((p) => matchesTechniqueTaxonomy(p.technique, options.technique!));
    }

    if (options.hub) {
      const hubNorm = normalizeTextForSearch(options.hub);
      produtos = produtos.filter((p) => normalizeTextForSearch(p.hub) === hubNorm);
    }

    if (temBuscaTextual && options.q) {
      const ranqueados = produtos
        .map((produto) => ({
          produto,
          score: calcularRelevanciaFts(produto, options.q!),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      produtos = ranqueados.map(({ produto, score }) => ({
        ...produto,
        relevanceScore: score,
      }));
    }

    return paginate(produtos, {
      page: options.page,
      limit: options.limit,
      defaultLimit: 10,
    });
  }

  async buscarPorId(id: string): Promise<ProdutoPublico | null> {
    return this.repository.findById(id);
  }
}

export function createProdutoService(
  repository: ProdutoRepositoryPort = defaultProdutoRepository,
): ProdutoService {
  return new ProdutoService(repository);
}

export const produtoService = createProdutoService();
