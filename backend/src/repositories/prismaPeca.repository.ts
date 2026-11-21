import { prisma } from '../config/database.js';
import type { PecaPersistida, PecaRepository, StatusPeca } from './contracts/pecas.contracts.js';

/**
 * Implementação real (Prisma/PostgreSQL) do `PecaRepository` (T-PEC-01/02).
 * A criação aninhada grava `pecas` e `fotos_peca` na mesma transação (pendência P4); os CHECKs
 * do banco revalidam a cubagem física (Invariante 2).
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
      status: peca.status as StatusPeca,
      fotos: peca.fotos.map((foto) => ({ id: foto.id, url: foto.url, isPrincipal: foto.isPrincipal })),
    };
  },
};
