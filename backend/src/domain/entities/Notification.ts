/**
 * Política fixa de resiliência (RNF-05 / Rubrica FCCPD):
 * Até 3 tentativas antes de transitar definitivamente para 'failed'.
 */
export const MAX_NOTIFICATION_RETRIES = 3

export type NotificationStatusType = 'pending' | 'sent' | 'failed'
export type NotificationEventType = 'order_confirmation' | 'artisan_new_sale'

export interface NotificationProps {
  id: string
  orderId: string
  recipientEmail: string
  type: NotificationEventType
  payload: Record<string, unknown>
  status: NotificationStatusType
  retryCount: number
  lastError?: string | null
  createdAt: Date
  processedAt?: Date | null
}

export class Notification {
  public readonly id: string
  public readonly orderId: string
  public readonly recipientEmail: string
  public readonly type: NotificationEventType
  public readonly payload: Record<string, unknown>
  public readonly status: NotificationStatusType
  public readonly retryCount: number
  public readonly lastError: string | null
  public readonly createdAt: Date
  public readonly processedAt: Date | null

  constructor(props: NotificationProps) {
    this.id = props.id
    this.orderId = props.orderId
    this.recipientEmail = props.recipientEmail.trim().toLowerCase()
    this.type = props.type
    this.payload = { ...props.payload }
    this.status = props.status
    this.retryCount = props.retryCount
    this.lastError = props.lastError ?? null
    this.createdAt = props.createdAt
    this.processedAt = props.processedAt ?? null
  }

  public canRetry(): boolean {
    return this.status === 'pending' && this.retryCount < MAX_NOTIFICATION_RETRIES
  }
}

