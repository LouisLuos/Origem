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
 * Calcula quantos milissegundos faltam até `expiresAtIso`, compensando desvios do relógio local.
 */
export function computeRemainingMs(
  expiresAtIso: string | null | undefined,
  serverOffsetMs = 0,
  localNowMs: number = Date.now(),
): number {
  if (!expiresAtIso) return 0
  const targetMs = Date.parse(expiresAtIso)
  if (!Number.isFinite(targetMs)) return 0
  const correctedNowMs = localNowMs + serverOffsetMs
  return Math.max(0, targetMs - correctedNowMs)
}

/**
 * Calcula os segundos inteiros restantes até `expiresAtIso` com arredondamento para cima
 * (`Math.ceil`), evitando zerar o cronômetro antes do vencimento efetivo no servidor.
 */
export function computeRemainingSeconds(
  expiresAtIso: string | null | undefined,
  serverOffsetMs = 0,
  localNowMs: number = Date.now(),
): number {
  const remainingMs = computeRemainingMs(expiresAtIso, serverOffsetMs, localNowMs)
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000)
}

/**
 * Calcula o intervalo de rechecagem quando o servidor ainda mantém a reserva ativa após o
 * disparo inicial de expiração, garantindo nova consulta logo após `expiraEm` real.
 */
export function computeExpirationRecheckDelayMs(
  expiresAtIso: string | null | undefined,
  serverOffsetMs = 0,
  localNowMs: number = Date.now(),
  bufferMs = 250,
  minDelayMs = 300,
  maxDelayMs = 15_000,
): number {
  const remainingMs = computeRemainingMs(expiresAtIso, serverOffsetMs, localNowMs)
  return Math.min(maxDelayMs, Math.max(minDelayMs, remainingMs + bufferMs))
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
 * separadamente de pedidos `PENDENTE_PAGAMENTO` ainda dentro do prazo (`activeOrderReservation`)
 * e de pedidos pendentes já vencidos que aguardam atualização/reconciliação da HU-10
 * (`expiredPendingOrderReservation`), sem que pedidos já `APROVADO` mascarem pendentes.
 */
export function selectCurrentCartReservation<T extends ReservationGroupLike>(
  groups: readonly T[],
  serverNowMs: number,
): {
  readonly activeCartReservation: T | null
  readonly activeOrderReservation: T | null
  readonly expiredPendingOrderReservation: T | null
} {
  let activeCartReservation: T | null = null
  let activeOrderReservation: T | null = null
  let expiredPendingOrderReservation: T | null = null

  const ordered = [...groups].sort(
    (a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm),
  )

  for (const group of ordered) {
    if (!activeCartReservation && isCartCheckoutReservation(group, serverNowMs)) {
      activeCartReservation = group
    }

    if (group.pedidoVinculado?.status === 'PENDENTE_PAGAMENTO') {
      if (isReservationGroupActive(group, serverNowMs)) {
        if (!activeOrderReservation) {
          activeOrderReservation = group
        }
      } else if (!expiredPendingOrderReservation) {
        expiredPendingOrderReservation = group
      }
    }
  }

  return {
    activeCartReservation,
    activeOrderReservation,
    expiredPendingOrderReservation,
  }
}

export interface OrderLikeForPendingCheck {
  readonly codigoPedido: string
  readonly status: string
  readonly pagamentoAtual?: {
    readonly expiraEm?: string | null
  } | null
}

export interface PendingCheckoutOrderClassification {
  readonly recoverableOrderCode: string | null
  readonly awaitingReconciliationOrderCode: string | null
}

/**
 * Diferencia pedidos `PENDENTE_PAGAMENTO` ainda dentro do prazo recuperável daqueles que já
 * atingiram o vencimento no relógio e aguardam expiração oficial ou reconciliação (HU-10),
 * respeitando atualizações de status já refletidas em `orders` sem assumir cancelamento local.
 */
export function classifyPendingCheckoutOrders(params: {
  readonly orders: readonly OrderLikeForPendingCheck[]
  readonly activeOrderReservation: ReservationGroupLike | null
  readonly expiredPendingOrderReservation: ReservationGroupLike | null
  readonly serverOffsetMs: number
  readonly localNowMs?: number
}): PendingCheckoutOrderClassification {
  const localNowMs = params.localNowMs ?? Date.now()
  const orderStatusByCode = new Map<string, string>()

  for (const order of params.orders) {
    const normalizedCode = order.codigoPedido.trim().toUpperCase()
    if (normalizedCode && !orderStatusByCode.has(normalizedCode)) {
      orderStatusByCode.set(normalizedCode, order.status)
    }
  }

  const isStillPendingOnOrderList = (code: string): boolean => {
    const status = orderStatusByCode.get(code.trim().toUpperCase())
    return status === undefined || status === 'PENDENTE_PAGAMENTO'
  }

  const recoverableFromOrders = params.orders.find(
    (order) =>
      order.status === 'PENDENTE_PAGAMENTO' &&
      Boolean(order.pagamentoAtual?.expiraEm) &&
      computeRemainingMs(order.pagamentoAtual?.expiraEm, params.serverOffsetMs, localNowMs) > 0,
  )

  const activeLinked = params.activeOrderReservation?.pedidoVinculado
  const recoverableFromReservation =
    activeLinked?.status === 'PENDENTE_PAGAMENTO' &&
    isStillPendingOnOrderList(activeLinked.codigoPedido) &&
    computeRemainingMs(params.activeOrderReservation?.expiraEm, params.serverOffsetMs, localNowMs) > 0
      ? activeLinked.codigoPedido
      : null

  const recoverableOrderCode =
    recoverableFromOrders?.codigoPedido ?? recoverableFromReservation ?? null

  const normalizedRecoverable = recoverableOrderCode?.trim().toUpperCase() ?? null

  const awaitingFromOrders = params.orders.find(
    (order) =>
      order.status === 'PENDENTE_PAGAMENTO' &&
      order.codigoPedido.trim().toUpperCase() !== normalizedRecoverable &&
      (!order.pagamentoAtual?.expiraEm ||
        computeRemainingMs(order.pagamentoAtual.expiraEm, params.serverOffsetMs, localNowMs) <= 0),
  )

  let awaitingFromReservation: string | null = null
  if (
    activeLinked?.status === 'PENDENTE_PAGAMENTO' &&
    activeLinked.codigoPedido.trim().toUpperCase() !== normalizedRecoverable &&
    isStillPendingOnOrderList(activeLinked.codigoPedido) &&
    computeRemainingMs(params.activeOrderReservation?.expiraEm, params.serverOffsetMs, localNowMs) <= 0
  ) {
    awaitingFromReservation = activeLinked.codigoPedido
  } else {
    const expiredLinked = params.expiredPendingOrderReservation?.pedidoVinculado
    if (
      expiredLinked?.status === 'PENDENTE_PAGAMENTO' &&
      expiredLinked.codigoPedido.trim().toUpperCase() !== normalizedRecoverable &&
      isStillPendingOnOrderList(expiredLinked.codigoPedido)
    ) {
      awaitingFromReservation = expiredLinked.codigoPedido
    }
  }

  return {
    recoverableOrderCode,
    awaitingReconciliationOrderCode:
      awaitingFromOrders?.codigoPedido ?? awaitingFromReservation ?? null,
  }
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

export interface ProductDetailStockState {
  readonly publicStock: number | undefined
  readonly reservedByCurrentUser: number
  readonly effectiveAvailable: number
  readonly remainingAddable: number
  readonly isSoldOut: boolean
  readonly isLowStock: boolean
  readonly isFullyReservedByCurrentUser: boolean
}

/**
 * Calcula disponibilidade em `ProductDetail` considerando unidades já reservadas pelo próprio
 * comprador sem mascarar o status `Esgotado` para terceiros (`reservedByCurrentUser = 0`).
 */
export function resolveProductDetailStockState(params: {
  readonly publicStock?: number
  readonly reservedByCurrentUser?: number
  readonly quantityInCart?: number
  readonly fallbackMax?: number
}): ProductDetailStockState {
  const publicStock =
    typeof params.publicStock === 'number' && Number.isFinite(params.publicStock)
      ? Math.max(0, Math.floor(params.publicStock))
      : undefined
  const reservedByCurrentUser =
    typeof params.reservedByCurrentUser === 'number' && Number.isFinite(params.reservedByCurrentUser)
      ? Math.max(0, Math.floor(params.reservedByCurrentUser))
      : 0
  const quantityInCart =
    typeof params.quantityInCart === 'number' && Number.isFinite(params.quantityInCart)
      ? Math.max(0, Math.floor(params.quantityInCart))
      : 0
  const fallbackMax = params.fallbackMax ?? 10

  const effectiveAvailable = effectiveAvailableQuantity(
    publicStock,
    reservedByCurrentUser,
    fallbackMax,
  )
  const isSoldOut = publicStock === 0 && reservedByCurrentUser === 0
  const isLowStock = publicStock !== undefined && publicStock > 0 && publicStock <= 3
  const remainingAddable =
    reservedByCurrentUser > 0
      ? Math.max(0, effectiveAvailable - quantityInCart)
      : effectiveAvailable
  const isFullyReservedByCurrentUser =
    reservedByCurrentUser > 0 && publicStock === 0 && remainingAddable === 0

  return {
    publicStock,
    reservedByCurrentUser,
    effectiveAvailable,
    remainingAddable,
    isSoldOut,
    isLowStock,
    isFullyReservedByCurrentUser,
  }
}

export interface MutableCartItem {
  id: string
  quantity: number
}

export interface CartMutationResult {
  readonly items: MutableCartItem[]
  readonly changed: boolean
}

function cloneCartItems(items: readonly CartReservationItemLike[]): MutableCartItem[] {
  return items.map((item) => ({ id: item.id, quantity: item.quantity }))
}

/** Aplica adição ao carrinho de forma pura e sinaliza se houve mudança real nos itens. */
export function applyAddCartItem(
  prev: readonly CartReservationItemLike[],
  productId: string,
  quantity: number,
  limit: number,
): CartMutationResult {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0
  const normalizedQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 0
  if (normalizedLimit <= 0 || normalizedQuantity <= 0) {
    return { items: cloneCartItems(prev), changed: false }
  }

  const existing = prev.find((item) => item.id === productId)
  const next = existing
    ? prev.map((item) =>
        item.id === productId
          ? { id: item.id, quantity: Math.min(normalizedLimit, item.quantity + normalizedQuantity) }
          : { id: item.id, quantity: item.quantity },
      )
    : [...cloneCartItems(prev), { id: productId, quantity: Math.min(normalizedLimit, normalizedQuantity) }]

  return {
    items: next,
    changed: buildItemsSignature(prev) !== buildItemsSignature(next),
  }
}

/** Aplica remoção do item de forma pura e sinaliza se houve mudança real no carrinho. */
export function applyRemoveCartItem(
  prev: readonly CartReservationItemLike[],
  productId: string,
): CartMutationResult {
  const next = prev
    .filter((item) => item.id !== productId)
    .map((item) => ({ id: item.id, quantity: item.quantity }))

  return {
    items: next,
    changed: next.length !== prev.length,
  }
}

/** Aplica alteração de quantidade de forma pura e sinaliza se houve mudança real nos itens. */
export function applySetCartItemQuantity(
  prev: readonly CartReservationItemLike[],
  productId: string,
  quantity: number,
  limit: number,
): CartMutationResult {
  if (!Number.isFinite(quantity)) {
    return { items: cloneCartItems(prev), changed: false }
  }

  const flooredQuantity = Math.floor(quantity)
  if (flooredQuantity <= 0) {
    return applyRemoveCartItem(prev, productId)
  }

  const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0
  if (normalizedLimit <= 0) {
    return { items: cloneCartItems(prev), changed: false }
  }

  const nextQuantity = Math.min(normalizedLimit, flooredQuantity)
  const next = prev.map((item) =>
    item.id === productId
      ? { id: item.id, quantity: nextQuantity }
      : { id: item.id, quantity: item.quantity },
  )

  return {
    items: next,
    changed: buildItemsSignature(prev) !== buildItemsSignature(next),
  }
}

export function doesCartMatchReservation(
  cartItems: readonly CartReservationItemLike[],
  group: Pick<ReservationGroupLike, 'itens'> | null,
): boolean {
  if (!group || cartItems.length === 0) return false
  return buildItemsSignature(cartItems) === buildReservationSignature(group)
}
