import {
  Notification,
  NotificationEventType,
  NotificationStatusType,
} from '../entities/Notification'

export interface CreateNotificationData {
  id?: string
  orderId: string
  recipientEmail: string
  type: NotificationEventType
  payload: Record<string, unknown>
  status?: NotificationStatusType
}

export interface INotificationRepository {
  create(data: CreateNotificationData): Promise<Notification>
  findById(id: string): Promise<Notification | null>
  findByOrderId(orderId: string): Promise<Notification[]>
  findPending(limit?: number): Promise<Notification[]>
  recordAttemptFailure(id: string, retryCount: number, errorMessage: string): Promise<Notification>
  markSent(id: string, retryCount: number): Promise<Notification>
  markFailed(id: string, retryCount: number, errorMessage: string): Promise<Notification>
}

