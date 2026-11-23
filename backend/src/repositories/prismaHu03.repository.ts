import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { isUuid } from '../utils/uuid.util.js';
import type {
  AtelieAutorizacaoRepository,
  AtelieFinanceiroRepository,
  CuradorVinculoPersistido,
  CuradorVinculoRepository,
  HabilitacaoArtesaoRepository,
  RelacionamentoUsuarioAtelie,
  StatusAtelie,
  StatusUsuario,
  TipoChavePix,
} from './contracts/hu03.contracts.js';

/**
 * Implementações reais (Prisma/PostgreSQL) dos contratos da .
 * - L1: papéis inseridos de forma idempotente (UNIQUE usuario_id + papel).
 * - L2: o papel global CURADOR é removido apenas quando não restar nenhum vínculo.
 * - L3: operações compostas executadas em `prisma.$transaction`.
 */

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toStatusAtelie(status: string): StatusAtelie {
  return status === 'SUSPENSO' ? 'SUSPENSO' : 'ATIVO';
}

function toRelacionamento(
  atelie: { id: string; nomeComercial: string; status: string; artesao: { usuarioId: string } },
  usuarioId: string,
  ehCuradorVinculado: boolean,
): RelacionamentoUsuarioAtelie {
  return {
    atelieId: atelie.id,
    nomeComercial: atelie.nomeComercial,
    statusAtelie: toStatusAtelie(atelie.status),
    ehTitular: atelie.artesao.usuarioId === usuarioId,
    ehCuradorVinculado,
  };
}

export const prismaHabilitacaoArtesaoRepository: HabilitacaoArtesaoRepository = {
  async findUsuarioPorId(usuarioId) {
    if (!isUuid(usuarioId)) return null;
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nome: true, email: true, status: true },
    });
    return usuario ? { ...usuario, status: usuario.status as StatusUsuario } : null;
  },

  async findArtesaoPorUsuarioId(usuarioId) {
    if (!isUuid(usuarioId)) return null;
    const artesao = await prisma.artesao.findUnique({ where: { usuarioId } });
    return artesao
      ? {
          id: artesao.id,
          usuarioId: artesao.usuarioId,
          biografiaCultural: artesao.biografiaCultural,
          tipoChavePix: artesao.tipoChavePix as TipoChavePix,
          chavePixCriptografada: artesao.chavePixCriptografada,
          criadoEm: artesao.criadoEm.toISOString(),
          atualizadoEm: artesao.atualizadoEm.toISOString(),
        }
      : null;
  },

  async habilitarArtesaoComPapel(dados) {
    try {
      const artesao = await prisma.$transaction(async (tx) => {
        const criado = await tx.artesao.create({
          data: {
            usuarioId: dados.usuarioId,
            biografiaCultural: dados.biografiaCultural,
            tipoChavePix: dados.tipoChavePix,
            chavePixCriptografada: dados.chavePixCriptografada,
          },
        });
        await tx.usuarioPapel.upsert({
          where: { usuarioId_papel: { usuarioId: dados.usuarioId, papel: 'ARTESAO' } },
          create: { usuarioId: dados.usuarioId, papel: 'ARTESAO' },
          update: {},
        });
        return criado;
      });
      return {
        id: artesao.id,
        usuarioId: artesao.usuarioId,
        biografiaCultural: artesao.biografiaCultural,
        tipoChavePix: artesao.tipoChavePix as TipoChavePix,
        chavePixCriptografada: artesao.chavePixCriptografada,
        criadoEm: artesao.criadoEm.toISOString(),
        atualizadoEm: artesao.atualizadoEm.toISOString(),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('Este usuário já possui perfil de artesão titular habilitado.', 409);
      }
      throw error;
    }
  },
};

const atelieComTitular = {
  id: true,
  nomeComercial: true,
  status: true,
  artesao: { select: { usuarioId: true } },
} as const;

export const prismaAtelieAutorizacaoRepository: AtelieAutorizacaoRepository = {
  async findRelacionamentoUsuarioAtelie(usuarioId, atelieId) {
    if (!isUuid(usuarioId) || !isUuid(atelieId)) return null;
    const atelie = await prisma.atelie.findUnique({
      where: { id: atelieId },
      select: { ...atelieComTitular, curadores: { where: { usuarioId }, select: { id: true } } },
    });
    if (!atelie) return null;
    const relacionamento = toRelacionamento(atelie, usuarioId, atelie.curadores.length > 0);
    return relacionamento.ehTitular || relacionamento.ehCuradorVinculado ? relacionamento : null;
  },

  async listRelacionamentosUsuario(usuarioId) {
    if (!isUuid(usuarioId)) return [];
    const atelies = await prisma.atelie.findMany({
      where: { OR: [{ artesao: { usuarioId } }, { curadores: { some: { usuarioId } } }] },
      select: { ...atelieComTitular, curadores: { where: { usuarioId }, select: { id: true } } },
      orderBy: { criadoEm: 'asc' },
    });
    return atelies.map((atelie) => toRelacionamento(atelie, usuarioId, atelie.curadores.length > 0));
  },
};

export const prismaAtelieFinanceiroRepository: AtelieFinanceiroRepository = {
  async findDadosFinanceirosPorAtelie(atelieId) {
    if (!isUuid(atelieId)) return null;
    const atelie = await prisma.atelie.findUnique({
      where: { id: atelieId },
      select: { id: true, artesao: true },
    });
    if (!atelie) return null;
    return {
      atelieId: atelie.id,
      artesaoId: atelie.artesao.id,
      titularUsuarioId: atelie.artesao.usuarioId,
      tipoChavePix: atelie.artesao.tipoChavePix as TipoChavePix,
      chavePixCriptografada: atelie.artesao.chavePixCriptografada,
      atualizadoEm: atelie.artesao.atualizadoEm.toISOString(),
    };
  },

  async atualizarChavePixCriptografada(atelieId, chavePixCriptografada, tipoChavePix) {
    const atelie = isUuid(atelieId)
      ? await prisma.atelie.findUnique({ where: { id: atelieId }, select: { artesaoId: true } })
      : null;
    if (!atelie) {
      throw new AppError('Ateliê ou perfil financeiro não encontrado.', 404);
    }
    const artesao = await prisma.artesao.update({
      where: { id: atelie.artesaoId },
      data: { chavePixCriptografada, tipoChavePix },
    });
    return {
      atelieId,
      artesaoId: artesao.id,
      tipoChavePix: artesao.tipoChavePix as TipoChavePix,
      atualizadoEm: artesao.atualizadoEm.toISOString(),
    };
  },
};

function toVinculo(vinculo: {
  id: string;
  atelieId: string;
  usuarioId: string;
  criadoEm: Date;
  usuario: { nome: string; email: string };
}): CuradorVinculoPersistido {
  return {
    vinculoId: vinculo.id,
    atelieId: vinculo.atelieId,
    usuarioId: vinculo.usuarioId,
    nome: vinculo.usuario.nome,
    email: vinculo.usuario.email,
    criadoEm: vinculo.criadoEm.toISOString(),
  };
}

const vinculoComUsuario = { usuario: { select: { nome: true, email: true } } } as const;

export const prismaCuradorVinculoRepository: CuradorVinculoRepository = {
  async findUsuarioPorEmail(emailNormalizado) {
    const usuario = await prisma.usuario.findUnique({
      where: { email: emailNormalizado },
      select: { id: true, nome: true, email: true, status: true },
    });
    return usuario ? { ...usuario, status: usuario.status as StatusUsuario } : null;
  },

  async findVinculo(atelieId, usuarioId) {
    if (!isUuid(atelieId) || !isUuid(usuarioId)) return null;
    const vinculo = await prisma.atelieCurador.findUnique({
      where: { atelieId_usuarioId: { atelieId, usuarioId } },
      include: vinculoComUsuario,
    });
    return vinculo ? toVinculo(vinculo) : null;
  },

  async listVinculosPorAtelie(atelieId) {
    if (!isUuid(atelieId)) return [];
    const vinculos = await prisma.atelieCurador.findMany({
      where: { atelieId },
      include: vinculoComUsuario,
      orderBy: { criadoEm: 'asc' },
    });
    return vinculos.map(toVinculo);
  },

  async vincularCuradorNoAtelie(atelieId, curadorUsuarioId) {
    try {
      const vinculo = await prisma.$transaction(async (tx) => {
        const criado = await tx.atelieCurador.create({
          data: { atelieId, usuarioId: curadorUsuarioId },
          include: vinculoComUsuario,
        });
        await tx.usuarioPapel.upsert({
          where: { usuarioId_papel: { usuarioId: curadorUsuarioId, papel: 'CURADOR' } },
          create: { usuarioId: curadorUsuarioId, papel: 'CURADOR' },
          update: {},
        });
        return criado;
      });
      return toVinculo(vinculo);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('Este usuário já está vinculado como curador deste ateliê.', 409);
      }
      throw error;
    }
  },

  async desvincularCuradorDoAtelie(atelieId, curadorUsuarioId) {
    if (!isUuid(atelieId) || !isUuid(curadorUsuarioId)) return false;
    return prisma.$transaction(async (tx) => {
      const removido = await tx.atelieCurador.deleteMany({
        where: { atelieId, usuarioId: curadorUsuarioId },
      });
      if (removido.count === 0) return false;

      const restantes = await tx.atelieCurador.count({ where: { usuarioId: curadorUsuarioId } });
      if (restantes === 0) {
        await tx.usuarioPapel.deleteMany({ where: { usuarioId: curadorUsuarioId, papel: 'CURADOR' } });
      }
      return true;
    });
  },
};
