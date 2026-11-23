import { AppError } from '../utils/AppError.js';
import type {
  ArmazenamentoFotosPeca,
  PecaRepository,
  ProcessadorImagemPeca,
} from './contracts/pecas.contracts.js';
import { ATELIE_ERROR_CODES } from './unconfiguredHu03.repository.js';

export const FOTO_PECA_ERROR_CODES = {
  PERSISTENCIA_INDISPONIVEL: ATELIE_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
  ARMAZENAMENTO_INDISPONIVEL: 'ARMAZENAMENTO_FOTOS_INDISPONIVEL',
  PROCESSAMENTO_IMAGEM_INDISPONIVEL: 'PROCESSAMENTO_IMAGEM_INDISPONIVEL',
} as const;

/**
 * Adaptadores padrão fail-closed: enquanto banco e Storage não
 * estiverem configurados, toda tentativa falha com 503 e NADA é gravado ou simulado.
 */
export const unconfiguredPecaRepository: PecaRepository = {
  async criarComFotos() {
    throw new AppError(
      "Persistência indisponível para 'PecaRepository.criarComFotos': as tabelas ainda não foram implantadas.",
      503,
      FOTO_PECA_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
    );
  },
  async listarPorAtelie() {
    throw new AppError(
      "Persistência indisponível para 'PecaRepository.listarPorAtelie': as tabelas ainda não foram implantadas.",
      503,
      FOTO_PECA_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
    );
  },
  async atualizarEstoque() {
    throw new AppError(
      "Persistência indisponível para 'PecaRepository.atualizarEstoque': as tabelas ainda não foram implantadas.",
      503,
      FOTO_PECA_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
    );
  },
};

export const unconfiguredProcessadorImagemPeca: ProcessadorImagemPeca = {
  async otimizar() {
    throw new AppError(
      'Processamento de imagens indisponível: o serviço de otimização de fotos ainda não foi configurado.',
      503,
      FOTO_PECA_ERROR_CODES.PROCESSAMENTO_IMAGEM_INDISPONIVEL,
    );
  },
};

export const unconfiguredArmazenamentoFotosPeca: ArmazenamentoFotosPeca = {
  async salvar() {
    throw new AppError(
      'Armazenamento de fotos indisponível: bucket e credenciais de Storage ainda não foram configurados.',
      503,
      FOTO_PECA_ERROR_CODES.ARMAZENAMENTO_INDISPONIVEL,
    );
  },
  async remover() {
    throw new AppError(
      'Armazenamento de fotos indisponível: bucket e credenciais de Storage ainda não foram configurados.',
      503,
      FOTO_PECA_ERROR_CODES.ARMAZENAMENTO_INDISPONIVEL,
    );
  },
};
