import {
  Artisan as PrismaArtisan,
  Notification as PrismaNotification,
  NotificationStatus,
  NotificationType,
  Order as PrismaOrder,
  OrderItem as PrismaOrderItem,
  OrderStatus,
  Prisma,
  Product as PrismaProduct,
  Review as PrismaReview,
  User as PrismaUser,
  UserRole,
} from '@prisma/client'
import {
  Artisan,
  Notification,
  NotificationEventType,
  NotificationStatusType,
  Order,
  OrderStatusType,
  PaymentMethod,
  Product,
  Review,
  ShippingAddress,
  User,
  UserRoleType,
} from '../../../domain/entities'

/**
 * Linha retornada pela consulta raw parametrizada `SELECT ... FROM "product" WHERE "id" = $1 FOR UPDATE`.
 */
export interface RawLockedProductRow {
  id: string
  title: string
  artisanId: string | null
  artisanName: string
  hub: string
  technique: string
  price: Prisma.Decimal | number | string
  compareAtPrice: Prisma.Decimal | number | string | null
  imageUrl: string
  imageAlt: string
  description: string | null
  details: string[] | null
  ownerEmail: string
  stock: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

function toNumber(val: Prisma.Decimal | number | string): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return Number(val)
  return val.toNumber()
}

export class PrismaDomainMapper {
  public static toDomainProduct(row: PrismaProduct): Product {
    return new Product({
      id: row.id,
      title: row.title,
      artisanId: row.artisanId,
      artisanName: row.artisanName,
      hub: row.hub,
      technique: row.technique,
      price: row.price.toNumber(),
      compareAtPrice: row.compareAtPrice ? row.compareAtPrice.toNumber() : null,
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt,
      description: row.description,
      details: row.details ?? [],
      ownerEmail: row.ownerEmail,
      stock: row.stock,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  public static toDomainProductFromRawLock(row: RawLockedProductRow): Product {
    return new Product({
      id: row.id,
      title: row.title,
      artisanId: row.artisanId,
      artisanName: row.artisanName,
      hub: row.hub,
      technique: row.technique,
      price: toNumber(row.price),
      compareAtPrice:
        row.compareAtPrice !== null && row.compareAtPrice !== undefined
          ? toNumber(row.compareAtPrice)
          : null,
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt,
      description: row.description,
      details: Array.isArray(row.details) ? row.details : [],
      ownerEmail: row.ownerEmail,
      stock: Number(row.stock),
      active: Boolean(row.active),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  public static toDomainArtisan(row: PrismaArtisan): Artisan {
    return new Artisan({
      id: row.id,
      name: row.name,
      hub: row.hub,
      technique: row.technique,
      bio: row.bio,
      since: row.since,
      photoUrl: row.photoUrl,
      photoAlt: row.photoAlt,
      coverUrl: row.coverUrl,
      coverAlt: row.coverAlt,
      email: row.email,
      phone: row.phone,
      workshopAddress: row.workshopAddress,
      publicContactConsent: row.publicContactConsent,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  public static toDomainOrder(
    row: PrismaOrder & { items: PrismaOrderItem[] },
  ): Order {
    const statusMap: Record<OrderStatus, OrderStatusType> = {
      PENDING: 'pending',
      PAID: 'paid',
      SHIPPED: 'shipped',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled',
    }

    return new Order({
      id: row.id,
      userEmail: row.userEmail,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      shippingAddress: row.shippingAddress as unknown as ShippingAddress,
      paymentMethod: row.paymentMethod as PaymentMethod,
      subtotal: row.subtotal.toNumber(),
      shippingFee: row.shippingFee.toNumber(),
      total: row.total.toNumber(),
      status: statusMap[row.status],
      items: row.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        title: item.title,
        artisanName: item.artisanName,
        imageUrl: item.imageUrl,
        imageAlt: item.imageAlt,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  public static toPrismaOrderStatus(status: OrderStatusType): OrderStatus {
    const map: Record<OrderStatusType, OrderStatus> = {
      pending: OrderStatus.PENDING,
      paid: OrderStatus.PAID,
      shipped: OrderStatus.SHIPPED,
      delivered: OrderStatus.DELIVERED,
      cancelled: OrderStatus.CANCELLED,
    }
    return map[status]
  }

  public static toDomainNotification(row: PrismaNotification): Notification {
    const statusMap: Record<NotificationStatus, NotificationStatusType> = {
      PENDING: 'pending',
      SENT: 'sent',
      FAILED: 'failed',
    }
    const typeMap: Record<NotificationType, NotificationEventType> = {
      ORDER_CONFIRMATION: 'order_confirmation',
      ARTISAN_NEW_SALE: 'artisan_new_sale',
    }

    return new Notification({
      id: row.id,
      orderId: row.orderId,
      recipientEmail: row.recipientEmail,
      type: typeMap[row.type],
      payload: (row.payload ?? {}) as Record<string, unknown>,
      status: statusMap[row.status],
      retryCount: row.retryCount,
      lastError: row.lastError,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
    })
  }

  public static toPrismaNotificationStatus(
    status: NotificationStatusType,
  ): NotificationStatus {
    const map: Record<NotificationStatusType, NotificationStatus> = {
      pending: NotificationStatus.PENDING,
      sent: NotificationStatus.SENT,
      failed: NotificationStatus.FAILED,
    }
    return map[status]
  }

  public static toPrismaNotificationType(
    type: NotificationEventType,
  ): NotificationType {
    const map: Record<NotificationEventType, NotificationType> = {
      order_confirmation: NotificationType.ORDER_CONFIRMATION,
      artisan_new_sale: NotificationType.ARTISAN_NEW_SALE,
    }
    return map[type]
  }

  public static toDomainUser(row: PrismaUser): User {
    const roleMap: Record<UserRole, UserRoleType> = {
      BUYER: 'buyer',
      ARTISAN: 'artisan',
      ADMIN: 'admin',
    }
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.passwordHash,
      role: roleMap[row.role],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  public static toPrismaUserRole(role: UserRoleType): UserRole {
    const map: Record<UserRoleType, UserRole> = {
      buyer: UserRole.BUYER,
      artisan: UserRole.ARTISAN,
      admin: UserRole.ADMIN,
    }
    return map[role]
  }

  public static toDomainReview(row: PrismaReview): Review {
    return new Review({
      id: row.id,
      name: row.name,
      location: row.location,
      quote: row.quote,
      rating: row.rating,
      avatarUrl: row.avatarUrl,
      avatarAlt: row.avatarAlt,
      createdAt: row.createdAt,
    })
  }
}

