import type { CatalogItem } from './catalogTypes'
import { stockService } from './stockService'
import { readStorage, writeStorage } from './storage'

export const FREE_SHIPPING_THRESHOLD = 250
export const FLAT_SHIPPING = 24.9

export function calculateShipping(subtotal: number) {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING
}

export type PaymentMethod = 'pix' | 'card' | 'boleto'

export const paymentLabels: Record<PaymentMethod, string> = {
  pix: 'Pix',
  card: 'Cartão de crédito',
  boleto: 'Boleto',
}

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
    return readStorage<Order[]>(ORDERS_KEY, [])
  },

  /** Devolve o pedido e o catálogo vazio caso não haja integração HU-10 ativa (checkout real usa reserva de estoque). */
  async create(data: NewOrder): Promise<{ order: Order; catalog: CatalogItem[] }> {
    await stockService.reserveStock(
      data.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    )
    const order: Order = {
      ...data,
      id: `OR-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    }
    writeStorage(ORDERS_KEY, [order, ...readStorage<Order[]>(ORDERS_KEY, [])])
    return { order, catalog: [] }
  },
}
