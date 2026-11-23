import type {
  CancelamentoReservaResultado,
  ConfirmacaoReservaResultado,
  ExpiracaoReservasResultado,
  GrupoReservaResultado,
  ReservaEstoqueRepository,
} from '../repositories/contracts/reservas.contracts.js';
import { prismaReservaEstoqueRepository } from '../repositories/prismaReserva.repository.js';
import { unconfiguredReservaEstoqueRepository } from '../repositories/unconfiguredReservas.repository.js';
import type { CriacaoReservaValidada } from '../validators/reserva.validator.js';

export interface ReservaEstoqueService {
  reservar(usuarioId: string, entrada: CriacaoReservaValidada): Promise<GrupoReservaResultado>;
  listarMinhas(usuarioId: string): Promise<GrupoReservaResultado[]>;
  cancelarGrupo(grupoId: string, usuarioId: string): Promise<CancelamentoReservaResultado>;
  cancelarItem(reservaId: string, usuarioId: string): Promise<CancelamentoReservaResultado>;
  confirmarGrupo(grupoId: string, usuarioId: string): Promise<ConfirmacaoReservaResultado>;
  expirarVencidas(agora?: Date): Promise<ExpiracaoReservasResultado>;
}

export interface ReservaEstoqueServiceDeps {
  readonly repository?: ReservaEstoqueRepository;
}

export function createReservaEstoqueService(
  deps?: ReservaEstoqueServiceDeps,
): ReservaEstoqueService {
  const repository = deps?.repository ?? unconfiguredReservaEstoqueRepository;

  return {
    async reservar(usuarioId, entrada) {
      return repository.criarGrupoReserva({
        usuarioId,
        idempotencyKey: entrada.idempotencyKey,
        payloadHash: entrada.payloadHash,
        itens: entrada.itens,
      });
    },

    async listarMinhas(usuarioId) {
      return repository.listarReservasUsuario(usuarioId);
    },

    async cancelarGrupo(grupoId, usuarioId) {
      return repository.cancelarPorGrupo(grupoId, usuarioId);
    },

    async cancelarItem(reservaId, usuarioId) {
      return repository.cancelarReservaItem(reservaId, usuarioId);
    },

    async confirmarGrupo(grupoId, usuarioId) {
      return repository.confirmarPorGrupo(grupoId, usuarioId);
    },

    async expirarVencidas(agora) {
      return repository.expirarReservasVencidas(agora);
    },
  };
}

export const reservaEstoqueService: ReservaEstoqueService = createReservaEstoqueService({
  repository: prismaReservaEstoqueRepository,
});
