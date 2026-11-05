/**
 * Constantes e regras de frete espelhadas 100% com `frontend/src/services/orderService.ts`.
 */
export const FREE_SHIPPING_THRESHOLD = 250
export const FLAT_SHIPPING = 24.9

export function calculateShippingFee(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING
}

export type PaymentMethod = 'pix' | 'card' | 'boleto'

export type OrderStatusType = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'

export interface ShippingAddress {
  phone: string
  zip: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export interface OrderItemEntity {
  id?: string
  productId: string
  title: string
  artisanName: string
  imageUrl: string
  imageAlt: string
  quantity: number
  unitPrice: number
}

export interface OrderProps {
  id: string
  userEmail?: string | null
  customerName: string
  customerEmail: string
  shippingAddress: ShippingAddress
  paymentMethod: PaymentMethod
  subtotal: number
  shippingFee: number
  total: number
  status: OrderStatusType
  items: OrderItemEntity[]
  createdAt: Date
  updatedAt?: Date
}

export class Order {
  public readonly id: string
  public readonly userEmail: string | null
  public readonly customerName: string
  public readonly customerEmail: string
  public readonly shippingAddress: ShippingAddress
  public readonly paymentMethod: PaymentMethod
  public readonly subtotal: number
  public readonly shippingFee: number
  public readonly total: number
  public readonly status: OrderStatusType
  public readonly items: OrderItemEntity[]
  public readonly createdAt: Date
  public readonly updatedAt?: Date

  constructor(props: OrderProps) {
    this.id = props.id
    this.userEmail = props.userEmail ? props.userEmail.trim().toLowerCase() : null
    this.customerName = props.customerName
    this.customerEmail = props.customerEmail.trim().toLowerCase()
    this.shippingAddress = { ...props.shippingAddress }
    this.paymentMethod = props.paymentMethod
    this.subtotal = Number(props.subtotal.toFixed(2))
    this.shippingFee = Number(props.shippingFee.toFixed(2))
    this.total = Number(props.total.toFixed(2))
    this.status = props.status
    this.items = props.items.map((item) => ({ ...item }))
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  /**
   * Serializa para o contrato exato esperado pelo `orderService.ts` do Frontend.
   */
  public toFrontendOrderDto() {
    return {
      id: this.id,
      createdAt: this.createdAt.toISOString(),
      ...(this.userEmail ? { userEmail: this.userEmail } : {}),
      customer: {
        name: this.customerName,
        email: this.customerEmail,
        ...this.shippingAddress,
      },
      paymentMethod: this.paymentMethod,
      lines: this.items.map((item) => ({
        productId: item.productId,
        title: item.title,
        imageUrl: item.imageUrl,
        imageAlt: item.imageAlt,
        artisan: item.artisanName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
      subtotal: this.subtotal,
      shipping: this.shippingFee,
      total: this.total,
    }
  }
}

