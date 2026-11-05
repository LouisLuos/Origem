import { Prisma } from '@prisma/client'
import { Order } from '../../../domain/entities/Order'
import {
  CreateOrderData,
  IOrderRepository,
} from '../../../domain/repositories/IOrderRepository'
import { PrismaDbClient } from '../prismaClient'
import { PrismaDomainMapper } from '../mappers/PrismaDomainMapper'

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly db: PrismaDbClient) {}

  public async findAll(userEmail?: string): Promise<Order[]> {
    const normalizedEmail = userEmail?.trim().toLowerCase()
    const rows = await this.db.order.findMany({
      where: normalizedEmail ? { userEmail: normalizedEmail } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(PrismaDomainMapper.toDomainOrder)
  }

  public async findById(id: string): Promise<Order | null> {
    const row = await this.db.order.findUnique({
      where: { id },
      include: { items: true },
    })
    return row ? PrismaDomainMapper.toDomainOrder(row) : null
  }

  public async create(data: CreateOrderData): Promise<Order> {
    const created = await this.db.order.create({
      data: {
        id: data.id,
        userEmail: data.userEmail ? data.userEmail.trim().toLowerCase() : null,
        customerName: data.customerName,
        customerEmail: data.customerEmail.trim().toLowerCase(),
        shippingAddress: data.shippingAddress as unknown as Prisma.InputJsonValue,
        paymentMethod: data.paymentMethod,
        subtotal: data.subtotal,
        shippingFee: data.shippingFee,
        total: data.total,
        status: PrismaDomainMapper.toPrismaOrderStatus(data.status),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            title: item.title,
            artisanName: item.artisanName,
            imageUrl: item.imageUrl,
            imageAlt: item.imageAlt,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    })

    return PrismaDomainMapper.toDomainOrder(created)
  }
}

