import { prisma } from '../config/database.js';
import { isUuid } from '../utils/uuid.util.js';
import type {
  DadosEnderecoComprador,
  EnderecoComprador,
  EnderecoCompradorRepository,
} from './contracts/hu11.contracts.js';

const selecaoEndereco = {
  id: true,
  cep: true,
  logradouro: true,
  numero: true,
  complemento: true,
  bairro: true,
  cidade: true,
  uf: true,
  criadoEm: true,
} as const;

function mapEndereco(registro: {
  id: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  criadoEm: Date;
}): EnderecoComprador {
  return {
    id: registro.id,
    cep: registro.cep,
    logradouro: registro.logradouro,
    numero: registro.numero,
    ...(registro.complemento ? { complemento: registro.complemento } : {}),
    bairro: registro.bairro,
    cidade: registro.cidade,
    uf: registro.uf,
    criadoEm: registro.criadoEm.toISOString(),
  };
}

function colunas(dados: DadosEnderecoComprador) {
  return {
    cep: dados.cep,
    logradouro: dados.logradouro,
    numero: dados.numero,
    complemento: dados.complemento ?? null,
    bairro: dados.bairro,
    cidade: dados.cidade,
    uf: dados.uf,
  };
}

/** Endereços do comprador: vinculados ao usuário e nunca a um ateliê. */
export const prismaEnderecoCompradorRepository: EnderecoCompradorRepository = {
  async listarPorUsuario(usuarioId) {
    if (!isUuid(usuarioId)) return [];
    const registros = await prisma.endereco.findMany({
      where: { usuarioId, atelieId: null },
      select: selecaoEndereco,
      orderBy: { criadoEm: 'asc' },
    });
    return registros.map(mapEndereco);
  },

  async criarRespeitandoLimite(usuarioId, dados, limite) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "usuarios" WHERE "id" = ${usuarioId}::uuid FOR UPDATE`;
      const total = await tx.endereco.count({ where: { usuarioId, atelieId: null } });
      if (total >= limite) return { status: 'LIMITE_ATINGIDO' as const };

      const criado = await tx.endereco.create({
        data: { ...colunas(dados), usuarioId },
        select: selecaoEndereco,
      });
      return { status: 'CRIADO' as const, endereco: mapEndereco(criado) };
    });
  },

  async atualizar(usuarioId, enderecoId, dados) {
    if (!isUuid(usuarioId) || !isUuid(enderecoId)) return null;
    const { count } = await prisma.endereco.updateMany({
      where: { id: enderecoId, usuarioId, atelieId: null },
      data: colunas(dados),
    });
    if (count === 0) return null;
    const atualizado = await prisma.endereco.findUnique({
      where: { id: enderecoId },
      select: selecaoEndereco,
    });
    return atualizado ? mapEndereco(atualizado) : null;
  },

  async remover(usuarioId, enderecoId) {
    if (!isUuid(usuarioId) || !isUuid(enderecoId)) return false;
    // Pedidos guardam `endereco_entrega_snapshot`; a FK é ON DELETE SET NULL, então o histórico permanece.
    const { count } = await prisma.endereco.deleteMany({
      where: { id: enderecoId, usuarioId, atelieId: null },
    });
    return count > 0;
  },
};
