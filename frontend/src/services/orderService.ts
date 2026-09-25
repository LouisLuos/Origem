import { catalogService } from './catalogService'
import type { CatalogItem } from './catalogService'
import { readStorage, simulateLatency, writeStorage } from './storage'

export const FREE_SHIPPING_THRESHOLD = 250
export const FLAT_SHIPPING = 24.9

export function calculateShipping(subtotal: number) {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING
}

export type PaymentMethod = 'pix' | 'card' | 'boleto'

export interface OrderLine {
  productId: string
  title: string
  imageUrl: string
  imageAlt: string
  artisan: string
  unitPrice: number
  quantity: number
}

export interface OrderCustomer {
  name: string
  email: string
  phone: string
  zip: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export interface Order {
  id: string
  createdAt: string
  /** E-mail da conta logada que fez o pedido (compra como visitante fica sem vínculo). */
  userEmail?: string
  customer: OrderCustomer
  paymentMethod: PaymentMethod
  lines: OrderLine[]
  subtotal: number
  shipping: number
  total: number
}

export type NewOrder = Omit<Order, 'id' | 'createdAt'>

const ORDERS_KEY = 'origem:orders'

/** Equivalente a `GET /pedidos` e `POST /pedidos`. Ao criar um pedido, baixa o estoque das peças. */
export const orderService = {
  async list(): Promise<Order[]> {
    await simulateLatency(300)
    return readStorage<Order[]>(ORDERS_KEY, [])
  },

  /** Devolve o pedido e o catálogo já com o estoque baixado. */
  async create(data: NewOrder): Promise<{ order: Order; catalog: CatalogItem[] }> {
    // Simula a aprovação do pagamento.
    await simulateLatency(1000)
    const catalog = await catalogService.reserveStock(data.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })))
    const order: Order = {
      ...data,
      id: `OR-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    }
    writeStorage(ORDERS_KEY, [order, ...readStorage<Order[]>(ORDERS_KEY, [])])
    return { order, catalog }
  },
}
