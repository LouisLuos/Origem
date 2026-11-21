import { AppError } from '../utils/AppError.js';
import type {
  ArmazenamentoFotosPeca,
  PecaRepository,
  ProcessadorImagemPeca,
} from './contracts/pecas.contracts.js';
import { HU03_ERROR_CODES } from './unconfiguredHu03.repository.js';

export const HU05_ERROR_CODES = {
  PERSISTENCIA_INDISPONIVEL: HU03_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
  ARMAZENAMENTO_INDISPONIVEL: 'ARMAZENAMENTO_FOTOS_INDISPONIVEL',
  PROCESSAMENTO_IMAGEM_INDISPONIVEL: 'PROCESSAMENTO_IMAGEM_INDISPONIVEL',
} as const;

/**
 * Adaptadores padrão fail-closed da HU-05: enquanto banco (T-PEC-01) e Storage (T-PEC-03) não
 * estiverem configurados, toda tentativa falha com 503 e NADA é gravado ou simulado.
 */
export const unconfiguredPecaRepository: PecaRepository = {
  async criarComFotos() {
    throw new AppError(
      "Persistência indisponível para 'PecaRepository.criarComFotos': as tabelas da tarefa T-PEC-01 ainda não foram implantadas.",
      503,
      HU05_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
    );
  },
};

export const unconfiguredProcessadorImagemPeca: ProcessadorImagemPeca = {
  async otimizar() {
    throw new AppError(
      'Processamento de imagens indisponível: o serviço de otimização de fotos (T-PEC-03) ainda não foi configurado.',
      503,
      HU05_ERROR_CODES.PROCESSAMENTO_IMAGEM_INDISPONIVEL,
    );
  },
};

export const unconfiguredArmazenamentoFotosPeca: ArmazenamentoFotosPeca = {
  async salvar() {
    throw new AppError(
      'Armazenamento de fotos indisponível: bucket e credenciais de Storage (T-PEC-03) ainda não foram configurados.',
      503,
      HU05_ERROR_CODES.ARMAZENAMENTO_INDISPONIVEL,
    );
  },
  async remover() {
    throw new AppError(
      'Armazenamento de fotos indisponível: bucket e credenciais de Storage (T-PEC-03) ainda não foram configurados.',
      503,
      HU05_ERROR_CODES.ARMAZENAMENTO_INDISPONIVEL,
    );
  },
};
