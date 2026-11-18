import { AppError } from '../utils/AppError.js';
import type { AuthIdentityProvider } from './contracts/auth.contracts.js';
import type {
  AtelieAutorizacaoRepository,
  AtelieFinanceiroRepository,
  CuradorVinculoRepository,
  HabilitacaoArtesaoRepository,
} from './contracts/hu03.contracts.js';

export const HU03_ERROR_CODES = {
  PERSISTENCIA_INDISPONIVEL: 'PERSISTENCIA_INDISPONIVEL',
  AUTENTICACAO_INDISPONIVEL: 'AUTENTICACAO_INDISPONIVEL',
  ACESSO_FINANCEIRO_BLOQUEADO: 'ACESSO_FINANCEIRO_BLOQUEADO',
  ACESSO_ATELIE_NEGADO: 'ACESSO_ATELIE_NEGADO',
} as const;

export function createPersistenceUnavailableError(operacao: string): AppError {
  return new AppError(
    `Persistência indisponível para '${operacao}': a estrutura de banco da tarefa T-ART-01 ainda não foi implantada.`,
    503,
    HU03_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
  );
}

/**
 * Adaptador padrão fail-closed enquanto a autenticação real da HU-01 não está conectada.
 * Nunca emite nem valida identidades simuladas em produção.
 */
export const unconfiguredAuthIdentityProvider: AuthIdentityProvider = {
  async verify() {
    return {
      status: 'PROVIDER_UNAVAILABLE',
      reason: 'Serviço de autenticação real (HU-01) ainda não integrado ao backend.',
    };
  },
};

export const unconfiguredHabilitacaoArtesaoRepository: HabilitacaoArtesaoRepository = {
  async findUsuarioPorId() {
    throw createPersistenceUnavailableError('HabilitacaoArtesaoRepository.findUsuarioPorId');
  },
  async findArtesaoPorUsuarioId() {
    throw createPersistenceUnavailableError('HabilitacaoArtesaoRepository.findArtesaoPorUsuarioId');
  },
  async habilitarArtesaoComPapel() {
    throw createPersistenceUnavailableError('HabilitacaoArtesaoRepository.habilitarArtesaoComPapel');
  },
};

export const unconfiguredAtelieAutorizacaoRepository: AtelieAutorizacaoRepository = {
  async findRelacionamentoUsuarioAtelie() {
    throw createPersistenceUnavailableError('AtelieAutorizacaoRepository.findRelacionamentoUsuarioAtelie');
  },
  async listRelacionamentosUsuario() {
    throw createPersistenceUnavailableError('AtelieAutorizacaoRepository.listRelacionamentosUsuario');
  },
};

export const unconfiguredAtelieFinanceiroRepository: AtelieFinanceiroRepository = {
  async findDadosFinanceirosPorAtelie() {
    throw createPersistenceUnavailableError('AtelieFinanceiroRepository.findDadosFinanceirosPorAtelie');
  },
  async atualizarChavePixCriptografada() {
    throw createPersistenceUnavailableError('AtelieFinanceiroRepository.atualizarChavePixCriptografada');
  },
};

export const unconfiguredCuradorVinculoRepository: CuradorVinculoRepository = {
  async findUsuarioPorEmail() {
    throw createPersistenceUnavailableError('CuradorVinculoRepository.findUsuarioPorEmail');
  },
  async findVinculo() {
    throw createPersistenceUnavailableError('CuradorVinculoRepository.findVinculo');
  },
  async listVinculosPorAtelie() {
    throw createPersistenceUnavailableError('CuradorVinculoRepository.listVinculosPorAtelie');
  },
  async vincularCuradorNoAtelie() {
    throw createPersistenceUnavailableError('CuradorVinculoRepository.vincularCuradorNoAtelie');
  },
  async desvincularCuradorDoAtelie() {
    throw createPersistenceUnavailableError('CuradorVinculoRepository.desvincularCuradorDoAtelie');
  },
};
