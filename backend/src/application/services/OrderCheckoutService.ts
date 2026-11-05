import {
  calculateShippingFee,
  Notification,
  Order,
  OrderItemEntity,
  Product,
} from '../../domain/entities'
import { IUnitOfWork } from '../../domain/repositories'
import { CreateOrderRequestInput, CreateOrderRequestSchema } from '../dtos/CreateOrderDto'
import { StockReservationService } from './StockReservationService'

/**
 * Porta opcional para disparo não-bloqueante (fire-and-forget) do worker de notificações
 * após o commit da transação de checkout (Fase 3 / RNF-05).
 */
export interface INotificationDispatcher {
  dispatchAsync(notificationIds: string[]): void
}

export interface CheckoutResult {
  order: Order
  notifications: Notification[]
  reservedProducts: Product[]
}

/**
 * Caso de Uso de Checkout Transacional e Desacoplamento Assíncrono (RNF-01 + RNF-05 / FCCPD).
 *
 * Fluxo garantido:
 * 1. Inicia transação ACID no PostgreSQL.
 * 2. Bloqueia cada produto com `SELECT ... FOR UPDATE` e decrementa o estoque atomicamente.
 * 3. Calcula subtotal, frete e total com base nos preços oficiais persistidos no banco.
 * 4. Grava o Pedido (`orders`), Itens (`order_item`) e Tarefas de Notificação (`notification`)
 *    com status inicial `'pending'` (Transactional Outbox Pattern — zero perda de mensagens).
 * 5. Comita a transação e responde imediatamente ao cliente SEM aguardar envio externo de e-mail.
 */
export class OrderCheckoutService {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly stockReservationService: StockReservationService,
    private readonly notificationDispatcher?: INotificationDispatcher,
  ) {}

  public async checkout(rawInput: CreateOrderRequestInput): Promise<CheckoutResult> {
    const input = CreateOrderRequestSchema.parse(rawInput)

    const result = await this.unitOfWork.executeInTransaction(async (txRepos) => {
      // 1. Reserva e baixa de estoque sob Lock Pessimista (SELECT ... FOR UPDATE)
      const updatedProductsMap = await this.stockReservationService.reserveWithinTransaction(
        txRepos,
        input.lines,
      )

      // 2. Monta os itens imutáveis (snapshot) preservando a ordem original do carrinho
      // Consolidamos quantidades caso o cliente tenha enviado linhas repetidas
      const quantityByProduct = new Map<string, number>()
      for (const line of input.lines) {
        quantityByProduct.set(
          line.productId,
          (quantityByProduct.get(line.productId) ?? 0) + line.quantity,
        )
      }

      const orderItems: OrderItemEntity[] = []
      let subtotal = 0

      for (const [productId, quantity] of quantityByProduct.entries()) {
        const product = updatedProductsMap.get(productId)!
        subtotal += product.price * quantity
        orderItems.push({
          productId: product.id,
          title: product.title,
          artisanName: product.artisanName,
          imageUrl: product.imageUrl,
          imageAlt: product.imageAlt,
          quantity,
          unitPrice: product.price,
        })
      }

      const roundedSubtotal = Number(subtotal.toFixed(2))
      const shippingFee = calculateShippingFee(roundedSubtotal)
      const total = Number((roundedSubtotal + shippingFee).toFixed(2))
      const orderId =
        input.orderId ?? `OR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

      // 3. Persiste o pedido e seus itens
      const order = await txRepos.orders.create({
        id: orderId,
        userEmail: input.userEmail ?? null,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        shippingAddress: input.shippingAddress,
        paymentMethod: input.paymentMethod,
        subtotal: roundedSubtotal,
        shippingFee,
        total,
        status: 'paid',
        items: orderItems,
      })

      // 4. Persiste notificação durável como 'pending' na mesma transação ACID (RNF-05)
      const buyerNotification = await txRepos.notifications.create({
        orderId: order.id,
        recipientEmail: order.customerEmail,
        type: 'order_confirmation',
        status: 'pending',
        payload: {
          orderId: order.id,
          customerName: order.customerName,
          total: order.total,
          itemCount: order.items.reduce((acc, item) => acc + item.quantity, 0),
        },
      })

      return {
        order,
        notifications: [buyerNotification],
        reservedProducts: Array.from(updatedProductsMap.values()),
      }
    })

    // 5. Disparo assíncrono não-bloqueante APÓS o COMMIT da transação (zero espera HTTP!)
    if (this.notificationDispatcher) {
      this.notificationDispatcher.dispatchAsync(result.notifications.map((n) => n.id))
    }

    return result
  }
}

