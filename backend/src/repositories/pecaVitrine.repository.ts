import { expandTechniqueAliases } from '../constants/taxonomy.js';
import { buildArtisanId } from '../utils/string.util.js';
import { isUuid } from '../utils/uuid.util.js';
import type { ProdutoPublico } from './produto.repository.js';

async function getPrisma() {
  const { prisma } = await import('../config/database.js');
  return prisma;
}

export interface FiltroVitrinePecas {
  readonly technique?: string;
  readonly hub?: string;
  readonly q?: string;
  readonly apenasDisponiveis?: boolean;
}

/**
 * Leitura pública das peças publicadas no banco (HU-05 / HU-07 → vitrine), adaptadas ao contrato
 * `ProdutoPublico` já consumido pelo frontend.
 */
export interface FontePecasVitrine {
  listarPublicadas(filtro?: FiltroVitrinePecas): Promise<ProdutoPublico[]>;
  buscarPublicadaPorId(id: string): Promise<ProdutoPublico | null>;
}

const selecaoVitrine = {
  id: true,
  atelieId: true,
  titulo: true,
  descricao: true,
  tipologia: true,
  preco: true,
  quantidadeEstoque: true,
  status: true,
  atelie: {
    select: {
      poloCultural: true,
      artesao: { select: { usuario: { select: { nome: true } } } },
    },
  },
  fotos: { select: { url: true, isPrincipal: true }, orderBy: { ordem: 'asc' } },
} as const;

type PecaVitrineRegistro = {
  id: string;
  atelieId: string;
  titulo: string;
  descricao: string;
  tipologia: string;
  preco: { toNumber(): number };
  quantidadeEstoque: number;
  status: string;
  atelie: { poloCultural: string; artesao: { usuario: { nome: string } } };
  fotos: { url: string; isPrincipal: boolean }[];
};

export function mapPecaParaProdutoPublico(
  peca: PecaVitrineRegistro,
  relevanceScore?: number,
): ProdutoPublico {
  const artesao = peca.atelie.artesao.usuario.nome.trim();
  const principal = peca.fotos.find((foto) => foto.isPrincipal) ?? peca.fotos[0];
  const galeria = principal
    ? [principal.url, ...peca.fotos.filter((foto) => foto !== principal).map((foto) => foto.url)]
    : [];
  const estoqueVisivel = peca.status === 'DISPONIVEL' ? peca.quantidadeEstoque : 0;
  return {
    id: peca.id,
    atelieId: peca.atelieId,
    status: peca.status,
    title: peca.titulo,
    artisan: artesao,
    artisanId: buildArtisanId(artesao),
    hub: peca.atelie.poloCultural,
    technique: peca.tipologia,
    price: peca.preco.toNumber(),
    stock: estoqueVisivel,
    active: true,
    imageUrl: principal?.url ?? '',
    imageAlt: peca.titulo,
    description: peca.descricao,
    gallery: galeria,
    ...(relevanceScore !== undefined ? { relevanceScore } : {}),
  };
}

/**
 * Executa busca Full-Text Search (FTS) em português no PostgreSQL utilizando o índice GIN
 * `to_tsvector('portuguese', coalesce("titulo", '') || ' ' || coalesce("descricao", ''))`
 * e ordena por relevância textual (`ts_rank`) — HU-07 Cenário 2.
 */
async function buscarIdsPorFtsNoPostgres(
  termoBusca: string,
  filtro: FiltroVitrinePecas,
): Promise<Array<{ id: string; rank: number }>> {
  const exigirDisponiveis = Boolean(filtro.apenasDisponiveis);
  const hubFiltro = filtro.hub?.trim() ? filtro.hub.trim() : null;
  const usaFiltroTipologia = Boolean(filtro.technique?.trim());
  const aliasesLower = usaFiltroTipologia
    ? expandTechniqueAliases(filtro.technique!).map((t) => t.toLowerCase())
    : [];

  const prisma = await getPrisma();
  const rows = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
    SELECT
      p."id",
      ts_rank(
        setweight(to_tsvector('portuguese', coalesce(p."titulo", '')), 'A') ||
        setweight(to_tsvector('portuguese', coalesce(p."descricao", '')), 'B'),
        plainto_tsquery('portuguese', ${termoBusca})
      )::float8 AS "rank"
    FROM "pecas" p
    INNER JOIN "atelies" a ON a."id" = p."atelie_id"
    WHERE to_tsvector('portuguese', coalesce(p."titulo", '') || ' ' || coalesce(p."descricao", ''))
          @@ plainto_tsquery('portuguese', ${termoBusca})
      AND p."status" IN ('DISPONIVEL'::"StatusPeca", 'RESERVADA'::"StatusPeca", 'VENDIDA'::"StatusPeca")
      AND (${exigirDisponiveis}::boolean = false OR (p."status" = 'DISPONIVEL'::"StatusPeca" AND p."quantidade_estoque" > 0))
      AND (${hubFiltro}::text IS NULL OR LOWER(a."polo_cultural") = LOWER(${hubFiltro}))
      AND (${usaFiltroTipologia}::boolean = false OR LOWER(p."tipologia") = ANY(${aliasesLower}::text[]))
    ORDER BY "rank" DESC, p."criado_em" DESC
  `;

  return rows;
}

export const prismaFontePecasVitrine: FontePecasVitrine = {
  async listarPublicadas(filtro: FiltroVitrinePecas = {}) {
    const prisma = await getPrisma();
    const termoBusca = filtro.q?.trim();

    if (termoBusca) {
      const ranqueados = await buscarIdsPorFtsNoPostgres(termoBusca, filtro);
      if (ranqueados.length === 0) {
        return [];
      }

      const ids = ranqueados.map((r) => r.id);
      const pecas = (await prisma.peca.findMany({
        where: { id: { in: ids } },
        select: selecaoVitrine,
      })) as unknown as PecaVitrineRegistro[];

      const pecasPorId = new Map<string, PecaVitrineRegistro>(
        pecas.map((p: PecaVitrineRegistro) => [p.id, p]),
      );
      const resultadoOrdenado: ProdutoPublico[] = [];

      for (const item of ranqueados) {
        const registro = pecasPorId.get(item.id);
        if (registro) {
          resultadoOrdenado.push(mapPecaParaProdutoPublico(registro, Number(item.rank)));
        }
      }

      return resultadoOrdenado;
    }

    const aliasesTipologia = filtro.technique
      ? expandTechniqueAliases(filtro.technique)
      : undefined;

    const pecas = (await prisma.peca.findMany({
      where: {
        ...(filtro.apenasDisponiveis
          ? { status: 'DISPONIVEL', quantidadeEstoque: { gt: 0 } }
          : { status: { in: ['DISPONIVEL', 'RESERVADA', 'VENDIDA'] } }),
        ...(aliasesTipologia
          ? {
              OR: aliasesTipologia.map((alias) => ({
                tipologia: { equals: alias, mode: 'insensitive' as const },
              })),
            }
          : {}),
        ...(filtro.hub
          ? {
              atelie: {
                poloCultural: { equals: filtro.hub.trim(), mode: 'insensitive' as const },
              },
            }
          : {}),
      },
      select: selecaoVitrine,
      orderBy: { criadoEm: 'desc' },
    })) as unknown as PecaVitrineRegistro[];

    return pecas.map((peca: PecaVitrineRegistro) => mapPecaParaProdutoPublico(peca));
  },

  async buscarPublicadaPorId(id) {
    if (!isUuid(id)) return null;
    const prisma = await getPrisma();
    const peca = (await prisma.peca.findFirst({
      where: { id, status: { in: ['DISPONIVEL', 'RESERVADA', 'VENDIDA'] } },
      select: selecaoVitrine,
    })) as unknown as PecaVitrineRegistro | null;
    return peca ? mapPecaParaProdutoPublico(peca) : null;
  },
};
