export const RESERVA_TTL_MINUTOS = 15;
export const RESERVA_TTL_MS = RESERVA_TTL_MINUTOS * 60 * 1000;

export type StatusReserva = 'ATIVA' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA';

export const RESERVA_ERROR_CODES = {
  ESTOQUE_INSUFICIENTE: 'ESTOQUE_INSUFICIENTE',
  PECA_INDISPONIVEL: 'PECA_INDISPONIVEL',
  CHAVE_IDEMPOTENCIA_CONFLITO: 'CHAVE_IDEMPOTENCIA_CONFLITO',
  RESERVA_TRANSICAO_INVALIDA: 'RESERVA_TRANSICAO_INVALIDA',
  PECA_NAO_PERSISTIDA: 'PECA_NAO_PERSISTIDA',
  RESERVA_DADOS_INVALIDOS: 'RESERVA_DADOS_INVALIDOS',
  PERSISTENCIA_INDISPONIVEL: 'PERSISTENCIA_INDISPONIVEL',
} as const;

export interface ItemReservaSolicitado {
  readonly pecaId: string;
  readonly quantidade: number;
}

export interface CriarGrupoReservaInput {
  readonly usuarioId: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly itens: readonly ItemReservaSolicitado[];
  readonly agora?: Date;
  readonly expiraEm?: Date;
}

export interface ReservaItemPersistido {
  readonly id: string;
  readonly grupoId: string;
  readonly usuarioId: string;
  readonly pecaId: string;
  readonly quantidade: number;
  readonly status: StatusReserva;
  readonly idempotencyKey: string;
  readonly criadoEm: string;
  readonly expiraEm: string;
  readonly atualizadoEm: string;
  readonly finalizadoEm: string | null;
  readonly estoqueDevolvidoEm: string | null;
}

export interface GrupoReservaResultado {
  readonly grupoId: string;
  readonly usuarioId: string;
  readonly idempotencyKey: string;
  readonly idempotente: boolean;
  readonly criadoEm: string;
  readonly expiraEm: string;
  readonly ttlMinutos: number;
  readonly itens: readonly ReservaItemPersistido[];
}

export interface CancelamentoReservaResultado {
  readonly grupoId: string;
  readonly usuarioId: string;
  readonly jaFinalizada: boolean;
  readonly itensCancelados: number;
  readonly unidadesDevolvidas: number;
  readonly itens: readonly ReservaItemPersistido[];
}

export interface ConfirmacaoReservaResultado {
  readonly grupoId: string;
  readonly usuarioId: string;
  readonly jaConfirmada: boolean;
  readonly itensConfirmados: number;
  readonly itens: readonly ReservaItemPersistido[];
}

export interface ExpiracaoReservasResultado {
  readonly reservasExpiradas: number;
  readonly unidadesDevolvidas: number;
  readonly pecasAtualizadas: number;
}

export interface ReservaEstoqueRepository {
  criarGrupoReserva(input: CriarGrupoReservaInput): Promise<GrupoReservaResultado>;
  listarReservasUsuario(usuarioId: string): Promise<GrupoReservaResultado[]>;
  cancelarPorGrupo(
    grupoId: string,
    usuarioId: string,
    agora?: Date,
  ): Promise<CancelamentoReservaResultado>;
  cancelarReservaItem(
    reservaId: string,
    usuarioId: string,
    agora?: Date,
  ): Promise<CancelamentoReservaResultado>;
  confirmarPorGrupo(
    grupoId: string,
    usuarioId: string,
    agora?: Date,
  ): Promise<ConfirmacaoReservaResultado>;
  expirarReservasVencidas(agora?: Date): Promise<ExpiracaoReservasResultado>;
}
