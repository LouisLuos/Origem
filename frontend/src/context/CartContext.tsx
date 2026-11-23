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
  applyAddCartItem,
  applyRemoveCartItem,
  applySetCartItemQuantity,
  buildItemsSignature,
  computeExpirationRecheckDelayMs,
  computeServerOffsetMs,
  doesCartMatchReservation,
  effectiveAvailableQuantity,
  isCartCheckoutReservation,
  selectCurrentCartReservation,
} from '@/utils/cartReservation.util'
import {
  executeExpirationSyncWithRecheck,
  executeSafeCancelFreeReservation,
} from '@/utils/cartReservationCoordinator'
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
  /** Reserva vinculada a um pedido PENDENTE_PAGAMENTO ainda dentro do prazo recuperável (HU-10). */
  activeOrderReservation: StockReservationGroup | null
  /** Reserva vinculada a um pedido PENDENTE_PAGAMENTO cujo prazo já venceu no relógio local, aguardando reconciliação/expiração no servidor (HU-10). */
  expiredPendingOrderReservation: StockReservationGroup | null
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

interface InternalReservationSyncResult {
  readonly ok: boolean
  readonly activeCartReservation: StockReservationGroup | null
  readonly activeOrderReservation: StockReservationGroup | null
  readonly expiredPendingOrderReservation: StockReservationGroup | null
  readonly serverOffsetMs: number
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
  const [expiredPendingOrderReservation, setExpiredPendingOrderReservation] =
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
  const reservationErrorRef = useRef<ReservationFeedbackError | null>(reservationError)
  const lastSyncedUserIdRef = useRef<string | null>(null)
  const needsResyncRef = useRef<boolean>(false)
  const pendingCatalogReloadOnRefreshRef = useRef<boolean>(false)
  const refreshInFlightRef = useRef<Promise<InternalReservationSyncResult> | null>(null)
  const pendingCancelRef = useRef<Promise<boolean> | null>(null)
  const reserveInFlightRef = useRef<Promise<ReserveCartOutcome> | null>(null)
  const reserveIdempotencyRef = useRef<{ signature: string; key: string } | null>(null)
  const expirationRecheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expirationRecheckAttemptsRef = useRef<{ key: string; count: number } | null>(null)
  const mutationInFlightRef = useRef<boolean>(false)
  const handleReservationExpiredRef = useRef<() => Promise<void>>(async () => {})

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
    reservationErrorRef.current = reservationError
  }, [reservationError])

  const applyReservationError = useCallback((nextError: ReservationFeedbackError | null) => {
    reservationErrorRef.current = nextError
    setReservationError(nextError)
  }, [])

  const clearExpirationRecheckTimer = useCallback(() => {
    if (expirationRecheckTimerRef.current !== null) {
      clearTimeout(expirationRecheckTimerRef.current)
      expirationRecheckTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearExpirationRecheckTimer()
  }, [clearExpirationRecheckTimer])

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
    clearExpirationRecheckTimer()
    expirationRecheckAttemptsRef.current = null
    needsResyncRef.current = false
    pendingCatalogReloadOnRefreshRef.current = false
    reserveIdempotencyRef.current = null
    activeReservationRef.current = null
    setActiveReservation(null)
    setActiveOrderReservation(null)
    setExpiredPendingOrderReservation(null)
    setReservationExpiredNotice(false)
    applyReservationError(null)
    serverOffsetMsRef.current = 0
    setServerOffsetMs(0)
    setReservationStatus('idle')
  }, [applyReservationError, clearExpirationRecheckTimer])

  const syncReservationsFromServer = useCallback(
    async (opts?: { triggerCatalogReload?: boolean }): Promise<InternalReservationSyncResult> => {
      if (!user) {
        resetLocalReservationState()
        return {
          ok: true,
          activeCartReservation: null,
          activeOrderReservation: null,
          expiredPendingOrderReservation: null,
          serverOffsetMs: 0,
        }
      }

      if (refreshInFlightRef.current) {
        if (opts?.triggerCatalogReload) {
          pendingCatalogReloadOnRefreshRef.current = true
        }
        return refreshInFlightRef.current
      }

      if (opts?.triggerCatalogReload) {
        pendingCatalogReloadOnRefreshRef.current = true
      }

      const task = (async (): Promise<InternalReservationSyncResult> => {
        const hadActiveFree = Boolean(activeReservationRef.current)
        setReservationStatus((prev) => (prev === 'ready' ? prev : 'loading'))
        try {
          const response = await stockService.listMyReservations()
          const offset = computeServerOffsetMs(response.servidorAgora)
          serverOffsetMsRef.current = offset
          setServerOffsetMs(offset)

          const serverNowMs = Date.now() + offset
          const {
            activeCartReservation,
            activeOrderReservation: foundOrder,
            expiredPendingOrderReservation: foundExpiredOrder,
          } = selectCurrentCartReservation(response.dados, serverNowMs)

          needsResyncRef.current = false
          activeReservationRef.current = activeCartReservation
          setActiveReservation(activeCartReservation)
          setActiveOrderReservation(foundOrder)
          setExpiredPendingOrderReservation(foundExpiredOrder)
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

          if (pendingCatalogReloadOnRefreshRef.current) {
            pendingCatalogReloadOnRefreshRef.current = false
            reloadCatalog()
          }

          return {
            ok: true,
            activeCartReservation,
            activeOrderReservation: foundOrder,
            expiredPendingOrderReservation: foundExpiredOrder,
            serverOffsetMs: offset,
          }
        } catch (reason) {
          pendingCatalogReloadOnRefreshRef.current = false
          if (isApiError(reason) && reason.status === 401) {
            resetLocalReservationState()
          } else {
            setReservationStatus('error')
          }
          return {
            ok: false,
            activeCartReservation: activeReservationRef.current,
            activeOrderReservation: null,
            expiredPendingOrderReservation: null,
            serverOffsetMs: serverOffsetMsRef.current,
          }
        }
      })().finally(() => {
        refreshInFlightRef.current = null
      })

      refreshInFlightRef.current = task
      return task
    },
    [user, reloadCatalog, resetLocalReservationState],
  )

  const refreshReservations = useCallback(
    async (opts?: { triggerCatalogReload?: boolean }): Promise<void> => {
      await syncReservationsFromServer(opts)
    },
    [syncReservationsFromServer],
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

    const task = (async (): Promise<boolean> => {
      setIsMutatingReservation(true)
      applyReservationError(null)
      try {
        return await executeSafeCancelFreeReservation({
          current,
          cancelReservation: (grupoId) => stockService.cancelReservation(grupoId),
          resyncFromServer: syncReservationsFromServer,
          onCleared: () => {
            clearExpirationRecheckTimer()
            expirationRecheckAttemptsRef.current = null
            reserveIdempotencyRef.current = null
            activeReservationRef.current = null
            setActiveReservation(null)
            setReservationExpiredNotice(false)
            reloadCatalog()
          },
          onError: (err) => {
            applyReservationError(err)
          },
          onMarkNeedsResync: (value) => {
            needsResyncRef.current = value
          },
        })
      } finally {
        pendingCancelRef.current = null
        setIsMutatingReservation(false)
      }
    })()

    pendingCancelRef.current = task
    return task
  }, [
    applyReservationError,
    clearExpirationRecheckTimer,
    reloadCatalog,
    syncReservationsFromServer,
  ])

  const commitCartChangeWithReservationRelease = useCallback(
    (next: CartItem[]) => {
      const hasFreeReservation = Boolean(activeReservationRef.current)

      if (!hasFreeReservation && !needsResyncRef.current) {
        reserveIdempotencyRef.current = null
        applyReservationError(null)
        itemsRef.current = next
        setItems(next)
        return
      }

      if (
        activeReservationRef.current?.possuiPedidoAtivo ||
        activeReservationRef.current?.pedidoVinculado?.ativo
      ) {
        applyReservationError({
          status: 409,
          code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
          message:
            'Esta reserva está vinculada a um pedido ativo e não pode ser cancelada diretamente.',
        })
        return
      }

      if (
        mutationInFlightRef.current ||
        pendingCancelRef.current ||
        reserveInFlightRef.current
      ) {
        return
      }

      mutationInFlightRef.current = true
      void (async () => {
        try {
          if (needsResyncRef.current) {
            const sync = await syncReservationsFromServer({ triggerCatalogReload: true })
            if (!sync.ok || needsResyncRef.current) {
              applyReservationError({
                status: 503,
                code: 'RESERVA_RESSINCRONIZACAO_PENDENTE',
                message:
                  'Não foi possível sincronizar sua reserva com o servidor antes de alterar o carrinho.',
              })
              return
            }
          }

          if (activeReservationRef.current) {
            const canceled = await cancelCurrentFreeReservation()
            if (!canceled) {
              return
            }
          }

          reserveIdempotencyRef.current = null
          applyReservationError(null)
          itemsRef.current = next
          setItems(next)
        } finally {
          mutationInFlightRef.current = false
        }
      })()
    },
    [applyReservationError, cancelCurrentFreeReservation, syncReservationsFromServer],
  )

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const product = products.find((candidate) => candidate.id === productId)
      const reservedByUser = reservedQtyByProduct.get(productId.trim().toLowerCase()) ?? 0
      const limit = product ? availableQuantity(product, reservedByUser) : MAX_ITEM_QUANTITY
      const { items: next, changed } = applyAddCartItem(
        itemsRef.current,
        productId,
        quantity,
        limit,
      )
      if (!changed) return

      commitCartChangeWithReservationRelease(next)
    },
    [products, reservedQtyByProduct, commitCartChangeWithReservationRelease],
  )

  const removeItem = useCallback(
    (productId: string) => {
      const { items: next, changed } = applyRemoveCartItem(itemsRef.current, productId)
      if (!changed) return

      commitCartChangeWithReservationRelease(next)
    },
    [commitCartChangeWithReservationRelease],
  )

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      const product = products.find((candidate) => candidate.id === productId)
      const reservedByUser = reservedQtyByProduct.get(productId.trim().toLowerCase()) ?? 0
      const limit = product ? availableQuantity(product, reservedByUser) : MAX_ITEM_QUANTITY

      const { items: next, changed } = applySetCartItemQuantity(
        itemsRef.current,
        productId,
        quantity,
        limit,
      )
      if (!changed) return

      commitCartChangeWithReservationRelease(next)
    },
    [products, reservedQtyByProduct, commitCartChangeWithReservationRelease],
  )

  const clearCart = useCallback(() => {
    reserveIdempotencyRef.current = null
    itemsRef.current = []
    setItems([])
  }, [])

  const clearReservationError = useCallback(() => {
    applyReservationError(null)
  }, [applyReservationError])

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
        if (needsResyncRef.current) {
          const sync = await syncReservationsFromServer({ triggerCatalogReload: true })
          if (!sync.ok || needsResyncRef.current) {
            const syncErr = {
              status: 503,
              code: 'RESERVA_RESSINCRONIZACAO_PENDENTE',
              message:
                'Não foi possível confirmar o estado da sua reserva no servidor. Tente novamente em instantes.',
            }
            applyReservationError(syncErr)
            return { ok: false, ...syncErr }
          }
        }

        if (pendingCancelRef.current) {
          const canceled = await pendingCancelRef.current
          if (!canceled) {
            const pendingErr = reservationErrorRef.current ?? {
              status: 409,
              code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
              message:
                'Não foi possível confirmar a liberação da reserva anterior no servidor.',
            }
            return { ok: false, ...pendingErr }
          }
        }

        const currentItems = itemsRef.current
        if (currentItems.length === 0) {
          const msg = 'Seu carrinho está vazio.'
          applyReservationError({ status: 422, message: msg })
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
          applyReservationError(null)
          return { ok: true, reservation: currentFree }
        }

        // Se havia reserva livre diferente no servidor, cancela explicitamente antes de gerar outra.
        if (currentFree && isCartCheckoutReservation(currentFree, serverNowMs)) {
          const canceledOld = await cancelCurrentFreeReservation()
          if (!canceledOld) {
            const cancelErr = reservationErrorRef.current ?? {
              status: 503,
              code: 'RESERVA_CANCELAMENTO_FALHOU',
              message:
                'Não foi possível liberar a reserva anterior no servidor. Tente novamente após sincronizar.',
            }
            return { ok: false, ...cancelErr }
          }
        }

        const signature = buildItemsSignature(currentItems)
        if (opts?.forceNew || reserveIdempotencyRef.current?.signature !== signature) {
          reserveIdempotencyRef.current = { signature, key: crypto.randomUUID() }
        }
        const idempotencyKey = reserveIdempotencyRef.current.key

        setIsMutatingReservation(true)
        applyReservationError(null)
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
            applyReservationError({
              status: 409,
              code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
              message: msg,
            })
            await syncReservationsFromServer()
            return {
              ok: false,
              status: 409,
              code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
              message: msg,
            }
          }

          clearExpirationRecheckTimer()
          expirationRecheckAttemptsRef.current = null
          needsResyncRef.current = false
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
          applyReservationError({ status, code, message })
          if (status === 409) {
            reloadCatalog()
            void syncReservationsFromServer()
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
    [
      user,
      applyReservationError,
      cancelCurrentFreeReservation,
      clearExpirationRecheckTimer,
      syncReservationsFromServer,
      reloadCatalog,
    ],
  )

  const renewReservation = useCallback(async (): Promise<ReserveCartOutcome> => {
    clearExpirationRecheckTimer()
    expirationRecheckAttemptsRef.current = null
    reserveIdempotencyRef.current = null
    return reserveCart({ forceNew: true })
  }, [clearExpirationRecheckTimer, reserveCart])

  const cancelActiveReservation = useCallback(async (): Promise<boolean> => {
    if (!activeReservationRef.current) return false
    return cancelCurrentFreeReservation()
  }, [cancelCurrentFreeReservation])

  const handleReservationExpired = useCallback(async (): Promise<void> => {
    clearExpirationRecheckTimer()
    reserveIdempotencyRef.current = null

    const current = activeReservationRef.current
    const target = current ? { grupoId: current.grupoId, expiraEm: current.expiraEm } : null
    const attemptKey = target ? `${target.grupoId}:${target.expiraEm}` : 'none'
    const nextCount =
      expirationRecheckAttemptsRef.current?.key === attemptKey
        ? expirationRecheckAttemptsRef.current.count + 1
        : 1
    expirationRecheckAttemptsRef.current = { key: attemptKey, count: nextCount }

    await executeExpirationSyncWithRecheck({
      targetReservation: target,
      maxAttempts: 3,
      currentAttemptCount: nextCount,
      syncFromServer: syncReservationsFromServer,
      computeDelayMs: (expiresAtIso, offsetMs) =>
        computeExpirationRecheckDelayMs(expiresAtIso, offsetMs),
      scheduleRecheck: (delayMs) => {
        setReservationExpiredNotice(false)
        clearExpirationRecheckTimer()
        expirationRecheckTimerRef.current = setTimeout(() => {
          expirationRecheckTimerRef.current = null
          void handleReservationExpiredRef.current()
        }, delayMs)
      },
      onConfirmedCleared: () => {
        expirationRecheckAttemptsRef.current = null
        if (target) {
          setReservationExpiredNotice(true)
        }
      },
      onExhausted: () => {
        expirationRecheckAttemptsRef.current = null
      },
    })
  }, [clearExpirationRecheckTimer, syncReservationsFromServer])

  useEffect(() => {
    handleReservationExpiredRef.current = handleReservationExpired
  }, [handleReservationExpired])

  const completeOrderFromReservation = useCallback(() => {
    clearExpirationRecheckTimer()
    expirationRecheckAttemptsRef.current = null
    needsResyncRef.current = false
    reserveIdempotencyRef.current = null
    activeReservationRef.current = null
    setActiveReservation(null)
    setReservationExpiredNotice(false)
    applyReservationError(null)
    clearCart()
    void syncReservationsFromServer({ triggerCatalogReload: true })
  }, [applyReservationError, clearCart, clearExpirationRecheckTimer, syncReservationsFromServer])

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
      expiredPendingOrderReservation,
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
      expiredPendingOrderReservation,
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
