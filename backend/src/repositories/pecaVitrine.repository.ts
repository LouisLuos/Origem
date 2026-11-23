import { prisma } from '../config/database.js';
import { isUuid } from '../utils/uuid.util.js';
import type { ProdutoPublico } from './produto.repository.js';

/**
 * Leitura pública das peças publicadas no banco ( → vitrine), adaptadas ao contrato
 * `ProdutoPublico` já consumido pelo frontend. Somente peças `DISPONIVEL` são expostas, e nenhum
 * dado do titular além do nome público é lido.
 */
export interface FontePecasVitrine {
  listarPublicadas(): Promise<ProdutoPublico[]>;
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
      artesao: { select: { id: true, usuario: { select: { nome: true } } } },
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
  atelie: { poloCultural: string; artesao: { id: string; usuario: { nome: string } } };
  fotos: { url: string; isPrincipal: boolean }[];
};

export function mapPecaParaProdutoPublico(peca: PecaVitrineRegistro): ProdutoPublico {
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
    artisanId: peca.atelie.artesao.id,
    hub: peca.atelie.poloCultural,
    technique: peca.tipologia,
    price: peca.preco.toNumber(),
    stock: estoqueVisivel,
    active: true,
    imageUrl: principal?.url ?? '',
    imageAlt: peca.titulo,
    description: peca.descricao,
    gallery: galeria,
  };
}

export const prismaFontePecasVitrine: FontePecasVitrine = {
  async listarPublicadas() {
    const pecas = await prisma.peca.findMany({
      where: { status: { in: ['DISPONIVEL', 'RESERVADA', 'VENDIDA'] } },
      select: selecaoVitrine,
      orderBy: { criadoEm: 'desc' },
    });
    return pecas.map(mapPecaParaProdutoPublico);
  },

  async buscarPublicadaPorId(id) {
    if (!isUuid(id)) return null;
    const peca = await prisma.peca.findFirst({
      where: { id, status: { in: ['DISPONIVEL', 'RESERVADA', 'VENDIDA'] } },
      select: selecaoVitrine,
    });
    return peca ? mapPecaParaProdutoPublico(peca) : null;
  },
};
