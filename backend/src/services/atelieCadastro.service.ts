import type { AteliePersistido, AtelieCadastroRepository } from '../repositories/contracts/hu04.contracts.js';
import { MENSAGEM_ATELIE_DUPLICADO, prismaAtelieCadastroRepository } from '../repositories/prismaAtelie.repository.js';
import { AppError } from '../utils/AppError.js';
import type { AtualizarAtelieDados, CriarAtelieDados } from '../validators/atelie.validator.js';

export interface AtelieCadastroService {
  criar(usuarioId: string, dados: CriarAtelieDados): Promise<AteliePersistido>;
  consultar(atelieId: string, usuarioId: string): Promise<AteliePersistido>;
  atualizar(
    atelieId: string,
    usuarioId: string,
    dados: AtualizarAtelieDados,
  ): Promise<AteliePersistido>;
}

/**
 * Somente artesão titular habilitado cria ateliê; no MVP há no máximo um
 * ateliê por artesão (Cenário 3 → 422). Ateliê e endereço são gravados atomicamente.
 */
export function createAtelieCadastroService(
  repository: AtelieCadastroRepository = prismaAtelieCadastroRepository,
): AtelieCadastroService {
  return {
    async criar(usuarioId, dados) {
      const artesaoId = await repository.findArtesaoIdPorUsuarioId(usuarioId);
      if (!artesaoId) {
        throw new AppError(
          'Apenas artesãos titulares habilitados podem cadastrar um ateliê. Conclua a habilitação de artesão primeiro.',
          403,
          'ARTESAO_NAO_HABILITADO',
        );
      }

      if (await repository.existeAteliePorArtesaoId(artesaoId)) {
        throw new AppError(MENSAGEM_ATELIE_DUPLICADO, 422, 'ATELIE_JA_CADASTRADO');
      }

      return repository.criarAtelieComEndereco({
        artesaoId,
        nomeComercial: dados.nomeComercial,
        poloCultural: dados.poloCultural,
        endereco: dados.endereco,
      });
    },

    async consultar(atelieId, usuarioId) {
      const atelie = await repository.findAteliePorIdEUsuarioId(atelieId, usuarioId);
      if (!atelie) {
        throw new AppError('Ateliê não encontrado para este titular.', 404, 'ATELIE_NAO_ENCONTRADO');
      }
      return atelie;
    },

    async atualizar(atelieId, usuarioId, dados) {
      const atualizado = await repository.atualizarAtelieComEndereco(atelieId, usuarioId, {
        nomeComercial: dados.nomeComercial,
        poloCultural: dados.poloCultural,
        endereco: dados.endereco,
      });
      if (!atualizado) {
        throw new AppError('Ateliê não encontrado para este titular.', 404, 'ATELIE_NAO_ENCONTRADO');
      }
      return atualizado;
    },
  };
}

export const atelieCadastroService = createAtelieCadastroService();
