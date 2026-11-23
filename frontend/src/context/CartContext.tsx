'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCatalog } from '@/context/CatalogContext'
import type { CatalogItem } from '@/context/CatalogContext'
import { isApiError } from '@/services/api'
import { cartService } from '@/services/cartService'
import type { CartItem } from '@/services/cartService'
import { stockService, type StockReservationGroup } from '@/services/stockService'
import {
  buildItemsSignature,
  computeServerOffsetMs,
  doesCartMatchReservation,
  effectiveAvailableQuantity,
  isCartCheckoutReservation,
  selectCurrentCartReservation,
} from '@/utils/cartReservation.util'
import { errorMessage } from '@/utils/errors'

export type { CartItem }

/** Limite fallback usado apenas quando o estoque da peça ainda não foi informado. */
export const MAX_ITEM_QUANTITY = 10

/** Quantas unidades da peça cabem no carrinho considerando estoque público + reserva ativa do próprio comprador. */
export function availableQuantity(product: { stock?: number }, reservedByCurrentUser = 0) {
  return effectiveAvailableQuantity(product.stock, reservedByCurrentUser, MAX_ITEM_QUANTITY)
}

export interface CartLine {
  product: CatalogItem
  quantity: number
}

export interface ReservationFeedbackError {
  readonly status?: number
  readonly code?: string
  readonly message: string
}

export type ReserveCartOutcome =
  | { readonly ok: true; readonly reservation: StockReservationGroup }
  | {
      readonly ok: false
      readonly status?: number
      readonly code?: string
      readonly message: string
    }

export interface CartContextValue {
  items: CartItem[]
  /** Itens do carrinho com os dados da peça no catálogo. */
  lines: CartLine[]
  /** `false` no HTML do servidor e na hidratação, enquanto o carrinho não foi lido do navegador. */
  hydrated: boolean
  itemCount: number
  addItem: (productId: string, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  /** Reserva transacional livre ativa do comprador para este carrinho/checkout (HU-09/HU-06). */
  activeReservation: StockReservationGroup | null
  /** Reserva vinculada a um pedido ainda ativo (ex.: Pix PENDENTE_PAGAMENTO da HU-10). */
  activeOrderReservation: StockReservationGroup | null
  reservationStatus: 'idle' | 'loading' | 'ready' | 'error'
  isMutatingReservation: boolean
  reservationExpiredNotice: boolean
  serverOffsetMs: number
  reservationError: ReservationFeedbackError | null
  reservedQtyByProduct: ReadonlyMap<string, number>
  clearReservationError: () => void
  refreshReservations: (opts?: { triggerCatalogReload?: boolean }) => Promise<void>
  reserveCart: (opts?: { forceNew?: boolean }) => Promise<ReserveCartOutcome>
  renewReservation: () => Promise<ReserveCartOutcome>
  cancelActiveReservation: () => Promise<boolean>
  handleReservationExpired: () => Promise<void>
  completeOrderFromReservation: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

/**
 * Estado global do carrinho e sincronização transacional da reserva real no PostgreSQL
 * compartilhada entre vitrine, `/carrinho` e `/checkout` (HU-09 + HU-06 + HU-10).
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, hydrated: authHydrated } = useAuth()
  const { products, status: catalogStatus, reload: reloadCatalog } = useCatalog()

  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  const [activeReservation, setActiveReservation] = useState<StockReservationGroup | null>(null)
  const [activeOrderReservation, setActiveOrderReservation] =
    useState<StockReservationGroup | null>(null)
  const [reservationStatus, setReservationStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [isMutatingReservation, setIsMutatingReservation] = useState(false)
  const [reservationExpiredNotice, setReservationExpiredNotice] = useState(false)
  const [serverOffsetMs, setServerOffsetMs] = useState(0)
  const [reservationError, setReservationError] = useState<ReservationFeedbackError | null>(null)

  const itemsRef = useRef<CartItem[]>(items)
  const activeReservationRef = useRef<StockReservationGroup | null>(activeReservation)
  const serverOffsetMsRef = useRef<number>(serverOffsetMs)
  const lastSyncedUserIdRef = useRef<string | null>(null)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const pendingCancelRef = useRef<Promise<boolean> | null>(null)
  const reserveInFlightRef = useRef<Promise<ReserveCartOutcome> | null>(null)
  const reserveIdempotencyRef = useRef<{ signature: string; key: string } | null>(null)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    activeReservationRef.current = activeReservation
  }, [activeReservation])

  useEffect(() => {
    serverOffsetMsRef.current = serverOffsetMs
  }, [serverOffsetMs])

  useEffect(() => {
    const loaded = cartService.load()
    itemsRef.current = loaded
    setItems(loaded)
    setHydrated(true)
  }, [])

  // Só grava depois de ler: senão o estado inicial vazio apagaria o carrinho salvo.
  useEffect(() => {
    if (hydrated) cartService.save(items)
  }, [items, hydrated])

  // Peças removidas ou arquivadas saem do carrinho para a contagem não divergir da vitrine.
  useEffect(() => {
    if (!hydrated || catalogStatus !== 'ready') return
    setItems((prev) => {
      const kept = prev.filter((item) => products.some((product) => product.id === item.id))
      return kept.length === prev.length ? prev : kept
    })
  }, [hydrated, catalogStatus, products])

  const reservedQtyByProduct = useMemo(() => {
    const map = new Map<string, number>()
    if (
      !activeReservation ||
      activeReservation.possuiPedidoAtivo ||
      activeReservation.pedidoVinculado?.ativo
    ) {
      return map
    }
    for (const item of activeReservation.itens) {
      if (item.status !== 'ATIVA') continue
      const key = item.pecaId.trim().toLowerCase()
      map.set(key, (map.get(key) ?? 0) + Math.max(0, Math.floor(item.quantidade)))
    }
    return map
  }, [activeReservation])

  const resetLocalReservationState = useCallback(() => {
    reserveIdempotencyRef.current = null
    activeReservationRef.current = null
    setActiveReservation(null)
    setActiveOrderReservation(null)
    setReservationExpiredNotice(false)
    setReservationError(null)
    serverOffsetMsRef.current = 0
    setServerOffsetMs(0)
    setReservationStatus('idle')
  }, [])

  const refreshReservations = useCallback(
    async (opts?: { triggerCatalogReload?: boolean }): Promise<void> => {
      if (!user) {
        resetLocalReservationState()
        return
      }

      if (refreshInFlightRef.current) {
        return refreshInFlightRef.current
      }

      const task = (async () => {
        const hadActiveFree = Boolean(activeReservationRef.current)
        setReservationStatus((prev) => (prev === 'ready' ? prev : 'loading'))
        try {
          const response = await stockService.listMyReservations()
          const offset = computeServerOffsetMs(response.servidorAgora)
          serverOffsetMsRef.current = offset
          setServerOffsetMs(offset)

          const serverNowMs = Date.now() + offset
          const { activeCartReservation, activeOrderReservation: foundOrder } =
            selectCurrentCartReservation(response.dados, serverNowMs)

          activeReservationRef.current = activeCartReservation
          setActiveReservation(activeCartReservation)
          setActiveOrderReservation(foundOrder)
          setReservationStatus('ready')

          if (activeCartReservation) {
            setReservationExpiredNotice(false)
            if (itemsRef.current.length === 0) {
              const restored = activeCartReservation.itens.map((it) => ({
                id: it.pecaId,
                quantity: it.quantidade,
              }))
              if (restored.length > 0) {
                itemsRef.current = restored
                setItems(restored)
              }
            }
          } else if (hadActiveFree) {
            reserveIdempotencyRef.current = null
            setReservationExpiredNotice(true)
          }

          if (opts?.triggerCatalogReload) {
            reloadCatalog()
          }
        } catch (reason) {
          if (isApiError(reason) && reason.status === 401) {
            resetLocalReservationState()
            return
          }
          setReservationStatus('error')
        }
      })().finally(() => {
        refreshInFlightRef.current = null
      })

      refreshInFlightRef.current = task
      return task
    },
    [user, reloadCatalog, resetLocalReservationState],
  )

  // Hidratação única das reservas reais no login / F5 (nunca cria reserva automaticamente).
  useEffect(() => {
    if (!authHydrated) return
    if (!user) {
      lastSyncedUserIdRef.current = null
      resetLocalReservationState()
      return
    }

    if (lastSyncedUserIdRef.current === user.id) return
    lastSyncedUserIdRef.current = user.id
    void refreshReservations()
  }, [authHydrated, user, refreshReservations, resetLocalReservationState])

  const cancelCurrentFreeReservation = useCallback(async (): Promise<boolean> => {
    if (pendingCancelRef.current) {
      return pendingCancelRef.current
    }

    const current = activeReservationRef.current
    if (!current) {
      return true
    }

    if (current.possuiPedidoAtivo || current.pedidoVinculado?.ativo) {
      setReservationError({
        status: 409,
        code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
        message: 'Esta reserva está vinculada a um pedido ativo e não pode ser cancelada diretamente.',
      })
      return false
    }

    reserveIdempotencyRef.current = null
    activeReservationRef.current = null
    setActiveReservation(null)
    setReservationExpiredNotice(false)

    const task = (async (): Promise<boolean> => {
      setIsMutatingReservation(true)
      setReservationError(null)
      try {
        await stockService.cancelReservation(current.grupoId)
        reloadCatalog()
        return true
      } catch (reason) {
        const status = isApiError(reason) ? reason.status : undefined
        const code = isApiError(reason) ? reason.code : undefined
        if (code === 'RESERVA_VINCULADA_A_PEDIDO_ATIVO') {
          setReservationError({
            status,
            code,
            message: errorMessage(
              reason,
              'A reserva já possui um pedido ativo e não pode ser alterada.',
            ),
          })
          await refreshReservations()
          return false
        }
        reloadCatalog()
        return true
      } finally {
        pendingCancelRef.current = null
        setIsMutatingReservation(false)
      }
    })()

    pendingCancelRef.current = task
    return task
  }, [reloadCatalog, refreshReservations])

  const mutateCartAndReleaseFreeReservation = useCallback(
    (updater: (prev: CartItem[]) => CartItem[]) => {
      reserveIdempotencyRef.current = null
      setReservationError(null)
      setItems((prev) => {
        const next = updater(prev)
        itemsRef.current = next
        return next
      })
      if (
        activeReservationRef.current &&
        !activeReservationRef.current.possuiPedidoAtivo &&
        !activeReservationRef.current.pedidoVinculado?.ativo
      ) {
        void cancelCurrentFreeReservation()
      }
    },
    [cancelCurrentFreeReservation],
  )

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const product = products.find((candidate) => candidate.id === productId)
      const reservedByUser = reservedQtyByProduct.get(productId.trim().toLowerCase()) ?? 0
      const limit = product ? availableQuantity(product, reservedByUser) : MAX_ITEM_QUANTITY
      if (limit === 0) return

      mutateCartAndReleaseFreeReservation((prev) => {
        const existing = prev.find((item) => item.id === productId)
        if (existing) {
          return prev.map((item) =>
            item.id === productId
              ? { ...item, quantity: Math.min(limit, item.quantity + quantity) }
              : item,
          )
        }
        return [...prev, { id: productId, quantity: Math.min(limit, quantity) }]
      })
    },
    [products, reservedQtyByProduct, mutateCartAndReleaseFreeReservation],
  )

  const removeItem = useCallback(
    (productId: string) => {
      mutateCartAndReleaseFreeReservation((prev) => prev.filter((item) => item.id !== productId))
    },
    [mutateCartAndReleaseFreeReservation],
  )

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      const product = products.find((candidate) => candidate.id === productId)
      const reservedByUser = reservedQtyByProduct.get(productId.trim().toLowerCase()) ?? 0
      const limit = product ? availableQuantity(product, reservedByUser) : MAX_ITEM_QUANTITY

      mutateCartAndReleaseFreeReservation((prev) => {
        if (quantity <= 0) {
          return prev.filter((item) => item.id !== productId)
        }
        if (limit <= 0) {
          return prev
        }
        const nextQuantity = Math.min(limit, Math.floor(quantity))
        return prev.map((item) =>
          item.id === productId ? { ...item, quantity: nextQuantity } : item,
        )
      })
    },
    [products, reservedQtyByProduct, mutateCartAndReleaseFreeReservation],
  )

  const clearCart = useCallback(() => {
    reserveIdempotencyRef.current = null
    itemsRef.current = []
    setItems([])
  }, [])

  const clearReservationError = useCallback(() => {
    setReservationError(null)
  }, [])

  const reserveCart = useCallback(
    async (opts?: { forceNew?: boolean }): Promise<ReserveCartOutcome> => {
      if (!user) {
        return {
          ok: false,
          status: 401,
          message: 'Faça login para reservar os itens e continuar para o pagamento.',
        }
      }

      if (reserveInFlightRef.current) {
        return reserveInFlightRef.current
      }

      const task = (async (): Promise<ReserveCartOutcome> => {
        if (pendingCancelRef.current) {
          const canceled = await pendingCancelRef.current
          if (!canceled) {
            return {
              ok: false,
              status: 409,
              code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
              message:
                'Não foi possível liberar a reserva anterior porque há um pedido ativo vinculado.',
            }
          }
        }

        const currentItems = itemsRef.current
        if (currentItems.length === 0) {
          const msg = 'Seu carrinho está vazio.'
          setReservationError({ status: 422, message: msg })
          return { ok: false, status: 422, message: msg }
        }

        const serverNowMs = Date.now() + serverOffsetMsRef.current
        const currentFree = activeReservationRef.current

        // Reutiliza o mesmo grupoId quando o carrinho não mudou e a reserva segue ativa no servidor.
        if (
          !opts?.forceNew &&
          currentFree &&
          isCartCheckoutReservation(currentFree, serverNowMs) &&
          doesCartMatchReservation(currentItems, currentFree)
        ) {
          setReservationExpiredNotice(false)
          setReservationError(null)
          return { ok: true, reservation: currentFree }
        }

        // Se havia reserva livre diferente no servidor, cancela explicitamente antes de gerar outra.
        if (currentFree && isCartCheckoutReservation(currentFree, serverNowMs)) {
          const canceledOld = await cancelCurrentFreeReservation()
          if (!canceledOld) {
            return {
              ok: false,
              status: 409,
              code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
              message:
                'Existe um pedido ativo para sua reserva anterior. Retome ou finalize o pedido em aberto.',
            }
          }
        }

        const signature = buildItemsSignature(currentItems)
        if (opts?.forceNew || reserveIdempotencyRef.current?.signature !== signature) {
          reserveIdempotencyRef.current = { signature, key: crypto.randomUUID() }
        }
        const idempotencyKey = reserveIdempotencyRef.current.key

        setIsMutatingReservation(true)
        setReservationError(null)
        try {
          const created = await stockService.reserveStock(
            currentItems.map((line) => ({ productId: line.id, quantity: line.quantity })),
            idempotencyKey,
          )

          if (created.servidorAgora) {
            const nextOffset = computeServerOffsetMs(created.servidorAgora)
            serverOffsetMsRef.current = nextOffset
            setServerOffsetMs(nextOffset)
          }

          if (created.possuiPedidoAtivo || created.pedidoVinculado?.ativo) {
            reserveIdempotencyRef.current = null
            const msg = `A reserva já está vinculada ao pedido ${created.pedidoVinculado?.codigoPedido ?? ''}.`
            setReservationError({ status: 409, code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO', message: msg })
            await refreshReservations()
            return {
              ok: false,
              status: 409,
              code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
              message: msg,
            }
          }

          activeReservationRef.current = created
          setActiveReservation(created)
          setReservationExpiredNotice(false)
          setReservationStatus('ready')
          reloadCatalog()
          return { ok: true, reservation: created }
        } catch (reason) {
          // Nunca reutiliza indefinidamente a mesma chave após falha/conflito/expiração
          reserveIdempotencyRef.current = null
          const status = isApiError(reason) ? reason.status : undefined
          const code = isApiError(reason) ? reason.code : undefined
          const message = errorMessage(reason, 'Não foi possível reservar os itens selecionados.')
          setReservationError({ status, code, message })
          if (status === 409) {
            reloadCatalog()
            void refreshReservations()
          }
          return { ok: false, status, code, message }
        } finally {
          setIsMutatingReservation(false)
        }
      })().finally(() => {
        reserveInFlightRef.current = null
      })

      reserveInFlightRef.current = task
      return task
    },
    [user, cancelCurrentFreeReservation, refreshReservations, reloadCatalog],
  )

  const renewReservation = useCallback(async (): Promise<ReserveCartOutcome> => {
    reserveIdempotencyRef.current = null
    return reserveCart({ forceNew: true })
  }, [reserveCart])

  const cancelActiveReservation = useCallback(async (): Promise<boolean> => {
    if (!activeReservationRef.current) return false
    return cancelCurrentFreeReservation()
  }, [cancelCurrentFreeReservation])

  const handleReservationExpired = useCallback(async (): Promise<void> => {
    reserveIdempotencyRef.current = null
    setReservationExpiredNotice(true)
    await refreshReservations({ triggerCatalogReload: true })
  }, [refreshReservations])

  const completeOrderFromReservation = useCallback(() => {
    reserveIdempotencyRef.current = null
    activeReservationRef.current = null
    setActiveReservation(null)
    setReservationExpiredNotice(false)
    setReservationError(null)
    clearCart()
    void refreshReservations({ triggerCatalogReload: true })
  }, [clearCart, refreshReservations])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      lines: items.flatMap((item) => {
        const product = products.find((candidate) => candidate.id === item.id)
        return product ? [{ product, quantity: item.quantity }] : []
      }),
      hydrated,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      addItem,
      removeItem,
      setQuantity,
      clearCart,
      activeReservation,
      activeOrderReservation,
      reservationStatus,
      isMutatingReservation,
      reservationExpiredNotice,
      serverOffsetMs,
      reservationError,
      reservedQtyByProduct,
      clearReservationError,
      refreshReservations,
      reserveCart,
      renewReservation,
      cancelActiveReservation,
      handleReservationExpired,
      completeOrderFromReservation,
    }),
    [
      items,
      products,
      hydrated,
      addItem,
      removeItem,
      setQuantity,
      clearCart,
      activeReservation,
      activeOrderReservation,
      reservationStatus,
      isMutatingReservation,
      reservationExpiredNotice,
      serverOffsetMs,
      reservationError,
      reservedQtyByProduct,
      clearReservationError,
      refreshReservations,
      reserveCart,
      renewReservation,
      cancelActiveReservation,
      handleReservationExpired,
      completeOrderFromReservation,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart deve ser usado dentro de um CartProvider')
  }
  return context
}
