import type { Request, Response } from 'express'
import { OrderCheckoutService } from '../../../application/services/OrderCheckoutService'
import { DomainError } from '../../../domain/errors'
import { IOrderRepository } from '../../../domain/repositories/IOrderRepository'

export class OrderController {
  constructor(
    private readonly orderCheckoutService: OrderCheckoutService,
    private readonly orderRepository: IOrderRepository,
  ) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    const userEmail =
      typeof req.query.userEmail === 'string' && req.query.userEmail.trim()
        ? req.query.userEmail.trim()
        : undefined

    const orders = await this.orderRepository.findAll(userEmail)
    res.status(200).json({
      dados: orders.map((order) => order.toFrontendOrderDto()),
    })
  }

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id)
    const order = await this.orderRepository.findById(id)
    if (!order) {
      throw new DomainError('Pedido não encontrado.', 'ORDER_NOT_FOUND', 404)
    }
    res.status(200).json(order.toFrontendOrderDto())
  }

  /**
   * `POST /api/v1/pedidos`
   * Aceita tanto o formato aninhado do Frontend (`customer: { name, email, ... }`)
   * quanto o formato plano (`customerName`, `customerEmail`, `shippingAddress`).
   * Retorna 201 imediatamente após o commit ACID, sem aguardar o worker assíncrono (RNF-05).
   */
  public create = async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const nestedCustomer =
      typeof body.customer === 'object' && body.customer !== null
        ? (body.customer as Record<string, unknown>)
        : null

    const customerName = String(nestedCustomer?.name ?? body.customerName ?? '').trim()
    const customerEmail = String(nestedCustomer?.email ?? body.customerEmail ?? '').trim()

    const rawAddress =
      typeof body.shippingAddress === 'object' && body.shippingAddress !== null
        ? (body.shippingAddress as Record<string, unknown>)
        : nestedCustomer ?? {}

    const shippingAddress = {
      phone: String(rawAddress.phone ?? ''),
      zip: String(rawAddress.zip ?? ''),
      street: String(rawAddress.street ?? ''),
      number: String(rawAddress.number ?? ''),
      complement: String(rawAddress.complement ?? ''),
      neighborhood: String(rawAddress.neighborhood ?? ''),
      city: String(rawAddress.city ?? ''),
      state: String(rawAddress.state ?? ''),
    }

    const rawLines = Array.isArray(body.lines) ? body.lines : []
    const lines = rawLines.map((line: { productId?: unknown; quantity?: unknown }) => ({
      productId: String(line?.productId ?? ''),
      quantity: Number(line?.quantity),
    }))

    const result = await this.orderCheckoutService.checkout({
      orderId: typeof body.orderId === 'string' ? body.orderId : undefined,
      userEmail: typeof body.userEmail === 'string' ? body.userEmail : undefined,
      customerName,
      customerEmail,
      shippingAddress,
      paymentMethod: body.paymentMethod as 'pix' | 'card' | 'boleto',
      lines,
    })

    const orderDto = result.order.toFrontendOrderDto()
    res.status(201).json({
      dados: orderDto,
      pedido: orderDto,
      notificacoes: result.notifications.map((n) => ({
        id: n.id,
        orderId: n.orderId,
        status: n.status,
      })),
    })
  }
}

