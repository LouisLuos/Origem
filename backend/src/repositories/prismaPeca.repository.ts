import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { isUuid } from '../utils/uuid.util.js';
import type {
  AtualizarEstoquePecaPersistidaInput,
  PecaPersistida,
  PecaRepository,
  StatusPeca,
} from './contracts/pecas.contracts.js';

interface PecaRowWithFotos {
  readonly id: string;
  readonly atelieId: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly tipologia: string;
  readonly preco: { toNumber(): number };
  readonly pesoGramas: number;
  readonly comprimentoCm: number;
  readonly larguraCm: number;
  readonly alturaCm: number;
  readonly isFragil: boolean;
  readonly quantidadeEstoque: number;
  readonly status: string;
  readonly fotos: ReadonlyArray<{ id: string; url: string; isPrincipal: boolean }>;
}

function mapPecaPersistida(peca: PecaRowWithFotos): PecaPersistida {
  return {
    id: peca.id,
    atelieId: peca.atelieId,
    titulo: peca.titulo,
    descricao: peca.descricao,
    tipologia: peca.tipologia,
    preco: peca.preco.toNumber(),
    pesoGramas: peca.pesoGramas,
    comprimentoCm: peca.comprimentoCm,
    larguraCm: peca.larguraCm,
    alturaCm: peca.alturaCm,
    isFragil: peca.isFragil,
    quantidadeEstoque: peca.quantidadeEstoque,
    status: peca.status as StatusPeca,
    fotos: peca.fotos.map((foto) => ({ id: foto.id, url: foto.url, isPrincipal: foto.isPrincipal })),
  };
}

/**
 * Implementação real (Prisma/PostgreSQL) do `PecaRepository`.
 * A criação aninhada grava `pecas` e `fotos_peca` na mesma transação (pendência P4); os CHECKs
 * do banco revalidam a cubagem física (Invariante 2) e o saldo não negativo (HU-06).
 */
export const prismaPecaRepository: PecaRepository = {
  async criarComFotos(dados): Promise<PecaPersistida> {
    const peca = await prisma.peca.create({
      data: {
        atelieId: dados.atelieId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        tipologia: dados.tipologia,
        preco: dados.preco,
        pesoGramas: dados.pesoGramas,
        comprimentoCm: dados.comprimentoCm,
        larguraCm: dados.larguraCm,
        alturaCm: dados.alturaCm,
        isFragil: dados.isFragil,
        quantidadeEstoque: dados.quantidadeEstoque,
        status: dados.status,
        fotos: {
          create: dados.fotos.map((foto, ordem) => ({
            url: foto.url,
            caminhoArmazenamento: foto.caminhoArmazenamento,
            isPrincipal: foto.isPrincipal,
            ordem,
          })),
        },
      },
      include: { fotos: { orderBy: { ordem: 'asc' } } },
    });

    return mapPecaPersistida(peca);
  },

  async listarPorAtelie(atelieId: string): Promise<PecaPersistida[]> {
    if (!isUuid(atelieId)) return [];
    const pecas = await prisma.peca.findMany({
      where: { atelieId },
      include: { fotos: { orderBy: { ordem: 'asc' } } },
      orderBy: { criadoEm: 'desc' },
    });
    return pecas.map(mapPecaPersistida);
  },

  async atualizarEstoque(dados: AtualizarEstoquePecaPersistidaInput): Promise<PecaPersistida | null> {
    if (!isUuid(dados.atelieId) || !isUuid(dados.pecaId)) return null;

    return prisma.$transaction(async (tx) => {
      const travadas = await tx.$queryRaw<
        Array<{ id: string; quantidade_estoque: number; status: StatusPeca }>
      >`
        SELECT "id", "quantidade_estoque", "status"
        FROM "pecas"
        WHERE "id" = ${dados.pecaId}::uuid
          AND "atelie_id" = ${dados.atelieId}::uuid
        FOR UPDATE
      `;

      const atual = travadas[0];
      if (!atual) {
        return null;
      }

      const novoSaldo =
        dados.modo === 'ABSOLUTO' ? dados.quantidadeEstoque : atual.quantidade_estoque + dados.delta;

      if (novoSaldo < 0) {
        throw new AppError(
          'O estoque não pode ficar negativo.',
          409,
          'ESTOQUE_INSUFICIENTE',
        );
      }

      let novoStatus: StatusPeca = atual.status;
      if (atual.status !== 'ARQUIVADA') {
        if (novoSaldo > 0 && (atual.status === 'RESERVADA' || atual.status === 'VENDIDA')) {
          novoStatus = 'DISPONIVEL';
        }
      }

      const atualizada = await tx.peca.update({
        where: { id: atual.id },
        data: {
          quantidadeEstoque: novoSaldo,
          status: novoStatus,
        },
        include: { fotos: { orderBy: { ordem: 'asc' } } },
      });

      return mapPecaPersistida(atualizada);
    });
  },
};
