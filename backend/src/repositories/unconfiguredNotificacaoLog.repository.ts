import { AppError } from '../utils/AppError.js';
import type { NotificacaoLogRepository } from './contracts/notificacoes.contracts.js';

function erroPersistenciaNotificacaoIndisponivel(): AppError {
  return new AppError(
    'Serviço de auditoria de notificações indisponível neste ambiente.',
    503,
    'NOTIFICACAO_LOG_REPOSITORY_UNCONFIGURED',
  );
}

export const unconfiguredNotificacaoLogRepository: NotificacaoLogRepository = {
  async garantirRegistroIdempotente() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async vincularJobId() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async marcarProcessando() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async marcarEnviada() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async marcarFalhaTransitoria() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async marcarFalhaPermanente() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async marcarIgnorada() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async buscarPorId() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async buscarPorIdempotencyKey() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async listarPorUsuario() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async listarPorPedido() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async listarPorSubpedido() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
  async obterResumoMonitoramento() {
    throw erroPersistenciaNotificacaoIndisponivel();
  },
};
