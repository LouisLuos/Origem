export interface CartReservationItemLike {
  readonly id: string
  readonly quantity: number
}

export interface ReservedItemLike {
  readonly pecaId: string
  readonly quantidade: number
  readonly status: 'ATIVA' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA'
}

export interface LinkedOrderLike {
  readonly pedidoId: string
  readonly codigoPedido: string
  readonly status: string
  readonly ativo: boolean
}

export interface ReservationGroupLike {
  readonly grupoId: string
  readonly criadoEm: string
  readonly expiraEm: string
  readonly servidorAgora?: string
  readonly possuiPedidoAtivo?: boolean
  readonly pedidoVinculado?: LinkedOrderLike | null
  readonly itens: readonly ReservedItemLike[]
}

/**
 * Calcula a diferença em milissegundos entre o relógio do servidor e o relógio local do navegador.
 */
export function computeServerOffsetMs(
  servidorAgoraIso: string | undefined,
  localNowMs: number = Date.now(),
): number {
  if (!servidorAgoraIso) return 0
  const parsed = Date.parse(servidorAgoraIso)
  return Number.isFinite(parsed) ? parsed - localNowMs : 0
}

/**
 * Calcula os segundos restantes até `expiresAtIso`, compensando desvios do relógio local.
 */
export function computeRemainingSeconds(
  expiresAtIso: string | null | undefined,
  serverOffsetMs = 0,
  localNowMs: number = Date.now(),
): number {
  if (!expiresAtIso) return 0
  const targetMs = Date.parse(expiresAtIso)
  if (!Number.isFinite(targetMs)) return 0
  const correctedNowMs = localNowMs + serverOffsetMs
  return Math.max(0, Math.floor((targetMs - correctedNowMs) / 1000))
}

/**
 * Gera assinatura determinística dos itens do carrinho para controle de idempotência e igualdade.
 */
export function buildItemsSignature(items: readonly CartReservationItemLike[]): string {
  const grouped = new Map<string, number>()
  for (const item of items) {
    const id = item.id.trim().toLowerCase()
    const qty = Math.max(0, Math.floor(item.quantity))
    if (!id || qty <= 0) continue
    grouped.set(id, (grouped.get(id) ?? 0) + qty)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, qty]) => `${id}:${qty}`)
    .join('|')
}

export function buildReservationSignature(group: Pick<ReservationGroupLike, 'itens'>): string {
  return buildItemsSignature(
    group.itens.map((item) => ({
      id: item.pecaId,
      quantity: item.quantidade,
    })),
  )
}

export function isReservationGroupActive(
  group: Pick<ReservationGroupLike, 'expiraEm' | 'itens'>,
  serverNowMs: number,
): boolean {
  if (!group.itens || group.itens.length === 0) return false
  if (group.itens.some((item) => item.status !== 'ATIVA')) return false
  const expiresAtMs = Date.parse(group.expiraEm)
  return Number.isFinite(expiresAtMs) && expiresAtMs > serverNowMs
}

export function isCartCheckoutReservation(
  group: ReservationGroupLike,
  serverNowMs: number,
): boolean {
  if (group.possuiPedidoAtivo || group.pedidoVinculado?.ativo) {
    return false
  }
  return isReservationGroupActive(group, serverNowMs)
}

/**
 * Seleciona a reserva ativa mais recente disponível para carrinho/checkout
 * separadamente de reservas já vinculadas a pedidos ativos (HU-10).
 */
export function selectCurrentCartReservation<T extends ReservationGroupLike>(
  groups: readonly T[],
  serverNowMs: number,
): {
  readonly activeCartReservation: T | null
  readonly activeOrderReservation: T | null
} {
  let activeCartReservation: T | null = null
  let activeOrderReservation: T | null = null

  const ordered = [...groups].sort(
    (a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm),
  )

  for (const group of ordered) {
    if (!activeOrderReservation && (group.possuiPedidoAtivo || group.pedidoVinculado?.ativo)) {
      activeOrderReservation = group
    }
    if (!activeCartReservation && isCartCheckoutReservation(group, serverNowMs)) {
      activeCartReservation = group
    }
  }

  return { activeCartReservation, activeOrderReservation }
}

export function buildReservedQuantityMap(
  group: ReservationGroupLike | null,
  serverNowMs: number,
): Map<string, number> {
  const result = new Map<string, number>()
  if (!group || !isCartCheckoutReservation(group, serverNowMs)) {
    return result
  }

  for (const item of group.itens) {
    const key = item.pecaId.trim().toLowerCase()
    result.set(key, (result.get(key) ?? 0) + Math.max(0, Math.floor(item.quantidade)))
  }
  return result
}

/**
 * Soma ao estoque público as unidades já reservadas pelo próprio comprador nesta sessão,
 * evitando falso bloqueio de peça única (`stock = 0` no catálogo porque ele mesmo reservou).
 */
export function effectiveAvailableQuantity(
  productStock: number | undefined,
  reservedByCurrentUser = 0,
  fallbackMax = 10,
): number {
  const ownReserved = Number.isFinite(reservedByCurrentUser)
    ? Math.max(0, Math.floor(reservedByCurrentUser))
    : 0

  if (typeof productStock === 'number' && Number.isFinite(productStock)) {
    return Math.max(0, Math.floor(productStock)) + ownReserved
  }

  return Math.max(fallbackMax, ownReserved)
}

export function doesCartMatchReservation(
  cartItems: readonly CartReservationItemLike[],
  group: Pick<ReservationGroupLike, 'itens'> | null,
): boolean {
  if (!group || cartItems.length === 0) return false
  return buildItemsSignature(cartItems) === buildReservationSignature(group)
}
