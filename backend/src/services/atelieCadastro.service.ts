import type { AteliePersistido, AtelieCadastroRepository } from '../repositories/contracts/hu04.contracts.js';
import { MENSAGEM_ATELIE_DUPLICADO, prismaAtelieCadastroRepository } from '../repositories/prismaAtelie.repository.js';
import { AppError } from '../utils/AppError.js';
import type { CriarAtelieDados } from '../validators/atelie.validator.js';

export interface AtelieCadastroService {
  criar(usuarioId: string, dados: CriarAtelieDados): Promise<AteliePersistido>;
}

/**
 * HU-04: somente artesão titular habilitado (HU-03) cria ateliê; no MVP há no máximo um
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
  };
}

export const atelieCadastroService = createAtelieCadastroService();
