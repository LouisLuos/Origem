import { catalogRequest } from './catalogRequest'
import type { StockReservation } from './catalogTypes'

export type ReservationStatus = 'ATIVA' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA'

export type LinkedOrderStatus =
  | 'PENDENTE_PAGAMENTO'
  | 'APROVADO'
  | 'RECUSADO'
  | 'EXPIRADO'
  | 'CANCELADO'
  | 'RECONCILIACAO_ESTORNO'

export interface LinkedReservationOrder {
  readonly pedidoId: string
  readonly codigoPedido: string
  readonly status: LinkedOrderStatus
  readonly ativo: boolean
}

export interface ReservedStockItem {
  readonly id: string
  readonly grupoId: string
  readonly usuarioId: string
  readonly pecaId: string
  readonly quantidade: number
  readonly status: ReservationStatus
  readonly idempotencyKey: string
  readonly criadoEm: string
  readonly expiraEm: string
  readonly atualizadoEm: string
  readonly finalizadoEm: string | null
  readonly estoqueDevolvidoEm: string | null
}

export interface StockReservationGroup {
  readonly grupoId: string
  readonly usuarioId: string
  readonly idempotencyKey: string
  readonly idempotente: boolean
  readonly criadoEm: string
  readonly expiraEm: string
  readonly ttlMinutos: number
  readonly servidorAgora?: string
  readonly possuiPedidoAtivo?: boolean
  readonly pedidoVinculado?: LinkedReservationOrder | null
  readonly itens: readonly ReservedStockItem[]
}

export interface ListMyReservationsResponse {
  readonly servidorAgora: string
  readonly dados: readonly StockReservationGroup[]
}

export interface StockReservationCancellation {
  readonly grupoId: string
  readonly usuarioId: string
  readonly jaFinalizada: boolean
  readonly itensCancelados: number
  readonly unidadesDevolvidas: number
  readonly itens: readonly ReservedStockItem[]
}

/** Reservas transacionais de estoque integradas ao backend real (PostgreSQL/Prisma). */
export const stockService = {
  /** Reserva unidades no PostgreSQL por 15 minutos com idempotência e proteção ACID contra overselling. */
  async reserveStock(
    lines: StockReservation[],
    idempotencyKey?: string,
  ): Promise<StockReservationGroup> {
    return catalogRequest<StockReservationGroup>('/estoque/reservas', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({ lines }),
    })
  },

  /** Cancela uma reserva ativa do usuário autenticado e devolve as unidades ao estoque. */
  async cancelReservation(grupoId: string): Promise<StockReservationCancellation> {
    return catalogRequest<StockReservationCancellation>(
      `/estoque/reservas/${encodeURIComponent(grupoId)}/cancelar`,
      { method: 'POST' },
    )
  },

  /** Lista as reservas recentes do comprador autenticado junto com o relógio oficial do servidor. */
  async listMyReservations(): Promise<ListMyReservationsResponse> {
    const response = await catalogRequest<{
      servidorAgora?: string
      dados?: StockReservationGroup[]
    }>('/estoque/reservas/minhas')
    return {
      servidorAgora: response.servidorAgora ?? new Date().toISOString(),
      dados: Array.isArray(response.dados) ? response.dados : [],
    }
  },
}
