import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useCatalog } from '@/context/CatalogContext'
import { useResource } from '@/hooks/useResource'
import type { ResourceStatus } from '@/hooks/useResource'
import { orderService } from '@/services/orderService'
import type { NewOrder, Order } from '@/services/orderService'

export { FREE_SHIPPING_THRESHOLD, FLAT_SHIPPING, calculateShipping } from '@/services/orderService'
export type {
  NewOrder,
  Order,
  OrderCustomer,
  OrderLine,
  PaymentMethod,
} from '@/services/orderService'

export interface OrderContextValue {
  orders: Order[]
  status: ResourceStatus
  error: string | null
  reload: () => void
  /** Cria o pedido (baixando o estoque). Rejeita com `Error` se alguma peça não tiver saldo. */
  placeOrder: (data: NewOrder) => Promise<Order>
  getOrder: (id: string) => Order | undefined
}

const OrderContext = createContext<OrderContextValue | null>(null)

/** Pedidos feitos neste navegador, carregados e gravados via `orderService`. */
export function OrderProvider({ children }: { children: ReactNode }) {
  const { replaceAll } = useCatalog()
  const { data: orders, setData, status, error, reload } = useResource(orderService.list, [] as Order[])

  const value = useMemo<OrderContextValue>(
    () => ({
      orders,
      status,
      error,
      reload,
      placeOrder: async (data) => {
        const { order, catalog } = await orderService.create(data)
        setData((prev) => [order, ...prev])
        replaceAll(catalog)
        return order
      },
      getOrder: (id) => orders.find((order) => order.id === id),
    }),
    [orders, status, error, reload, setData, replaceAll],
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
