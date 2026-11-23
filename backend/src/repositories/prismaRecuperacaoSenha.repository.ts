import { prisma } from '../config/database.js';
import type { RecuperacaoSenhaRepository } from './contracts/hu02.contracts.js';

export const prismaRecuperacaoSenhaRepository: RecuperacaoSenhaRepository = {
  async buscarUsuarioAtivoPorEmail(email) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, nome: true, email: true, status: true },
    });
    if (!usuario || usuario.status !== 'ATIVO') return null;
    return { id: usuario.id, nome: usuario.nome, email: usuario.email };
  },

  async registrarSolicitacao({ usuarioId, tokenHash, expiraEm, agora }) {
    return prisma.$transaction(async (tx) => {
      await tx.recuperacaoSenha.updateMany({
        where: { usuarioId, usadoEm: null },
        data: { usadoEm: agora },
      });
      return tx.recuperacaoSenha.create({
        data: { usuarioId, tokenHash, expiraEm },
        select: { id: true },
      });
    });
  },

  async redefinirSenha({ tokenHash, senhaHash, agora }) {
    return prisma.$transaction(async (tx) => {
      const recuperacao = await tx.recuperacaoSenha.findUnique({
        where: { tokenHash },
        select: { id: true, usuarioId: true },
      });
      if (!recuperacao) return 'TOKEN_INVALIDO';

      // Atualização condicional: entre pedidos simultâneos com o mesmo token, só um consome.
      const { count } = await tx.recuperacaoSenha.updateMany({
        where: { id: recuperacao.id, usadoEm: null, expiraEm: { gt: agora } },
        data: { usadoEm: agora },
      });
      if (count === 0) return 'TOKEN_INVALIDO';

      await tx.usuario.update({
        where: { id: recuperacao.usuarioId },
        data: { senhaHash, sessoesValidasDesde: agora },
      });
      await tx.recuperacaoSenha.updateMany({
        where: { usuarioId: recuperacao.usuarioId, usadoEm: null },
        data: { usadoEm: agora },
      });
      return 'REDEFINIDA';
    });
  },
};
