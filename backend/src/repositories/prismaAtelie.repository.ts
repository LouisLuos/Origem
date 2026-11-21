import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { isUuid } from '../utils/uuid.util.js';
import type { AtelieCadastroRepository } from './contracts/hu04.contracts.js';

export const MENSAGEM_ATELIE_DUPLICADO =
  'Você já possui um ateliê cadastrado. No MVP, cada artesão titular pode ter apenas um ateliê.';

/** Implementação real (Prisma/PostgreSQL) do cadastro de ateliê da HU-04. */
export const prismaAtelieCadastroRepository: AtelieCadastroRepository = {
  async findArtesaoIdPorUsuarioId(usuarioId) {
    if (!isUuid(usuarioId)) return null;
    const artesao = await prisma.artesao.findUnique({ where: { usuarioId }, select: { id: true } });
    return artesao?.id ?? null;
  },

  async existeAteliePorArtesaoId(artesaoId) {
    return (await prisma.atelie.count({ where: { artesaoId } })) > 0;
  },

  async criarAtelieComEndereco(dados) {
    try {
      // Criação aninhada: o Prisma grava ateliê e endereço na mesma transação.
      const atelie = await prisma.atelie.create({
        data: {
          artesaoId: dados.artesaoId,
          nomeComercial: dados.nomeComercial,
          poloCultural: dados.poloCultural,
          endereco: {
            create: {
              cep: dados.endereco.cep,
              logradouro: dados.endereco.logradouro,
              numero: dados.endereco.numero,
              complemento: dados.endereco.complemento ?? null,
              bairro: dados.endereco.bairro,
              cidade: dados.endereco.cidade,
              uf: dados.endereco.uf,
            },
          },
        },
        include: { endereco: true },
      });
      const endereco = atelie.endereco;
      if (!endereco) throw new Error('Endereço do ateliê não foi persistido.');
      return {
        id: atelie.id,
        artesaoId: atelie.artesaoId,
        nomeComercial: atelie.nomeComercial,
        poloCultural: atelie.poloCultural,
        status: atelie.status === 'SUSPENSO' ? 'SUSPENSO' : 'ATIVO',
        endereco: {
          cep: endereco.cep,
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          ...(endereco.complemento ? { complemento: endereco.complemento } : {}),
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          uf: endereco.uf,
        },
        criadoEm: atelie.criadoEm.toISOString(),
      };
    } catch (error) {
      // Corrida entre duas submissões simultâneas: o UNIQUE de artesao_id garante a regra.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(MENSAGEM_ATELIE_DUPLICADO, 422, 'ATELIE_JA_CADASTRADO');
      }
      throw error;
    }
  },
};
