import { NotificationStatus, Prisma } from '@prisma/client'
import { Notification } from '../../../domain/entities/Notification'
import {
  CreateNotificationData,
  INotificationRepository,
} from '../../../domain/repositories/INotificationRepository'
import { PrismaDbClient } from '../prismaClient'
import { PrismaDomainMapper } from '../mappers/PrismaDomainMapper'

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly db: PrismaDbClient) {}

  public async create(data: CreateNotificationData): Promise<Notification> {
    const created = await this.db.notification.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        orderId: data.orderId,
        recipientEmail: data.recipientEmail.trim().toLowerCase(),
        type: PrismaDomainMapper.toPrismaNotificationType(data.type),
        payload: data.payload as Prisma.InputJsonValue,
        status: PrismaDomainMapper.toPrismaNotificationStatus(data.status ?? 'pending'),
        retryCount: 0,
      },
    })
    return PrismaDomainMapper.toDomainNotification(created)
  }

  public async findById(id: string): Promise<Notification | null> {
    const row = await this.db.notification.findUnique({ where: { id } })
    return row ? PrismaDomainMapper.toDomainNotification(row) : null
  }

  public async findByOrderId(orderId: string): Promise<Notification[]> {
    const rows = await this.db.notification.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(PrismaDomainMapper.toDomainNotification)
  }

  public async findPending(limit = 50): Promise<Notification[]> {
    const rows = await this.db.notification.findMany({
      where: { status: NotificationStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    return rows.map(PrismaDomainMapper.toDomainNotification)
  }

  public async recordAttemptFailure(
    id: string,
    retryCount: number,
    errorMessage: string,
  ): Promise<Notification> {
    const updated = await this.db.notification.update({
      where: { id },
      data: {
        retryCount,
        lastError: errorMessage,
      },
    })
    return PrismaDomainMapper.toDomainNotification(updated)
  }

  public async markSent(id: string, retryCount: number): Promise<Notification> {
    const updated = await this.db.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.SENT,
        retryCount,
        processedAt: new Date(),
      },
    })
    return PrismaDomainMapper.toDomainNotification(updated)
  }

  public async markFailed(
    id: string,
    retryCount: number,
    errorMessage: string,
  ): Promise<Notification> {
    const updated = await this.db.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.FAILED,
        retryCount,
        lastError: errorMessage,
        processedAt: new Date(),
      },
    })
    return PrismaDomainMapper.toDomainNotification(updated)
  }
}

