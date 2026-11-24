import { AppError } from '../utils/AppError.js';
import {
  RESERVA_ERROR_CODES,
  type ReservaEstoqueRepository,
} from './contracts/reservas.contracts.js';

function erroPersistencia(operacao: string): never {
  throw new AppError(
    `Persistência indisponível para '${operacao}': o repositório de reservas não foi configurado.`,
    503,
    RESERVA_ERROR_CODES.PERSISTENCIA_INDISPONIVEL,
  );
}

/**
 * Adaptador fail-closed padrão caso o repositório Prisma não seja injetado.
 */
export const unconfiguredReservaEstoqueRepository: ReservaEstoqueRepository = {
  async criarGrupoReserva() {
    erroPersistencia('ReservaEstoqueRepository.criarGrupoReserva');
  },
  async listarReservasUsuario() {
    erroPersistencia('ReservaEstoqueRepository.listarReservasUsuario');
  },
  async cancelarPorGrupo() {
    erroPersistencia('ReservaEstoqueRepository.cancelarPorGrupo');
  },
  async cancelarReservaItem() {
    erroPersistencia('ReservaEstoqueRepository.cancelarReservaItem');
  },
  async confirmarPorGrupo() {
    erroPersistencia('ReservaEstoqueRepository.confirmarPorGrupo');
  },
  async expirarReservasVencidas() {
    erroPersistencia('ReservaEstoqueRepository.expirarReservasVencidas');
  },
};
