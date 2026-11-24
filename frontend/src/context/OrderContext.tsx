'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCatalog } from '@/context/CatalogContext'
import type { ResourceStatus } from '@/hooks/useResource'
import { orderService } from '@/services/orderService'
import type {
  CheckoutResponse,
  CreateCheckoutInput,
  Order,
} from '@/services/orderService'
import { errorMessage } from '@/utils/errors'

export { orderStatusLabels, paymentLabels } from '@/services/orderService'
export type {
  CheckoutResponse,
  CheckoutShippingQuote,
  CreateCheckoutInput,
  Order,
  OrderCustomer,
  OrderLine,
  OrderStatus,
  PaymentDetails,
  PaymentMethod,
  PaymentStatus,
  ShippingOriginQuote,
  TokenizedCardInput,
} from '@/services/orderService'

export interface OrderContextValue {
  orders: Order[]
  status: ResourceStatus
  error: string | null
  reload: () => void
  placeOrder: (data: CreateCheckoutInput, idempotencyKey: string) => Promise<CheckoutResponse>
  upsertOrder: (order: Order) => void
  getOrder: (idOrCode: string) => Order | undefined
}

const OrderContext = createContext<OrderContextValue | null>(null)

/** Pedidos reais persistidos no backend PostgreSQL para o usuário autenticado. */
export function OrderProvider({ children }: { children: ReactNode }) {
  const { user, hydrated: authHydrated } = useAuth()
  const { reload: reloadCatalog } = useCatalog()
  const [orders, setOrders] = useState<Order[]>([])
  const [status, setStatus] = useState<ResourceStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  const reload = useCallback(() => {
    setReloadTick((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!authHydrated) return
    if (!user) {
      setOrders([])
      setError(null)
      setStatus('ready')
      return
    }

    let cancelled = false
    setStatus('loading')
    setError(null)

    orderService
      .listMyOrders()
      .then((lista) => {
        if (!cancelled) {
          setOrders(lista)
          setStatus('ready')
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(errorMessage(reason, 'Não foi possível carregar os pedidos.'))
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [authHydrated, user, reloadTick])

  const upsertOrder = useCallback((order: Order) => {
    setOrders((prev) => {
      const semDuplicata = prev.filter((item) => item.id !== order.id)
      return [order, ...semDuplicata]
    })
  }, [])

  const placeOrder = useCallback(
    async (data: CreateCheckoutInput, idempotencyKey: string) => {
      const resultado = await orderService.checkout(data, idempotencyKey)
      upsertOrder(resultado.pedido)
      reloadCatalog()
      return resultado
    },
    [upsertOrder, reloadCatalog],
  )

  const getOrder = useCallback(
    (idOrCode: string) => {
      const target = idOrCode.trim().toUpperCase()
      return orders.find(
        (order) =>
          order.id.toUpperCase() === target || order.codigoPedido.toUpperCase() === target,
      )
    },
    [orders],
  )

  const value = useMemo<OrderContextValue>(
    () => ({
      orders,
      status,
      error,
      reload,
      placeOrder,
      upsertOrder,
      getOrder,
    }),
    [orders, status, error, reload, placeOrder, upsertOrder, getOrder],
  )

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
}

export function useOrders() {
  const context = useContext(OrderContext)
  if (!context) {
    throw new Error('useOrders deve ser usado dentro de um OrderProvider')
  }
  return context
}
