import {
  MAX_NOTIFICATION_RETRIES,
  Notification,
} from '../../domain/entities/Notification'
import { INotificationRepository } from '../../domain/repositories/INotificationRepository'
import { INotificationDispatcher } from './OrderCheckoutService'

/**
 * Porta de entrega externa (ex: provedor SMTP/Push ou simulador determinístico).
 */
export interface INotificationTransport {
  send(notification: Notification): Promise<void>
}

export interface NotificationWorkerOptions {
  /** Intervalo fixo entre retentativas em milissegundos (padrão: 300ms — RNF-05 / FCCPD). */
  retryIntervalMs?: number
  /** Latência simulada de envio externo em background (padrão: 50ms). */
  simulatedSendDelayMs?: number
  /** Intervalo de varredura de recuperação de itens 'pending' órfãos (padrão: 10s). */
  recoveryPollIntervalMs?: number
  /** Suprime logs verbosos em suítes de teste silenciosas se desejado. */
  silentLogs?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Transporte padrão simulado: suporta falha determinística quando `orderId` contém
 * `"FAIL"` ou `"simulate-failure"` para comprovação de resiliência (3 retries -> 'failed').
 */
export class DefaultSimulatedNotificationTransport implements INotificationTransport {
  constructor(private readonly simulatedDelayMs: number) {}

  public async send(notification: Notification): Promise<void> {
    if (this.simulatedDelayMs > 0) {
      await sleep(this.simulatedDelayMs)
    }

    if (
      notification.orderId.toUpperCase().includes('FAIL') ||
      notification.orderId.includes('simulate-failure')
    ) {
      throw new Error('Falha simulada no provedor externo de notificações.')
    }
  }
}

/**
 * Worker Assíncrono de Mensageria Durável (RNF-05 / Rubrica FCCPD).
 *
 * Garantias:
 * 1. Desacoplamento Total: `dispatchAsync` agenda o processamento via `setImmediate`,
 *    garantindo que o endpoint HTTP de checkout retorne `201 Created` antes da execução.
 * 2. Deduplicação em voo (`inFlightIds`): impede processamento duplicado concorrente.
 * 3. Política Estrita de Retentativas: até 3 tentativas (`MAX_NOTIFICATION_RETRIES = 3`)
 *    com intervalo fixo (`retryIntervalMs`), sem perda de registros.
 * 4. Persistência Final: transita para `'sent'` em sucesso ou `'failed'` após esgotar as 3 tentativas.
 */
export class NotificationWorkerService implements INotificationDispatcher {
  private readonly retryIntervalMs: number
  private readonly recoveryPollIntervalMs: number
  private readonly silentLogs: boolean
  private readonly transport: INotificationTransport
  private readonly inFlightIds = new Set<string>()
  private readonly activeTasks = new Set<Promise<void>>()
  private pollTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly notificationRepository: INotificationRepository,
    options: NotificationWorkerOptions = {},
    customTransport?: INotificationTransport,
  ) {
    this.retryIntervalMs = options.retryIntervalMs ?? 300
    const simulatedSendDelayMs = options.simulatedSendDelayMs ?? 50
    this.recoveryPollIntervalMs = options.recoveryPollIntervalMs ?? 10_000
    this.silentLogs = options.silentLogs ?? false
    this.transport =
      customTransport ?? new DefaultSimulatedNotificationTransport(simulatedSendDelayMs)
  }

  private logInfo(message: string, meta?: Record<string, unknown>): void {
    if (this.silentLogs) return
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        component: 'NotificationWorker',
        message,
        ...meta,
      }),
    )
  }

  private logWarn(message: string, meta?: Record<string, unknown>): void {
    if (this.silentLogs) return
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        component: 'NotificationWorker',
        message,
        ...meta,
      }),
    )
  }

  /**
   * Enfileira notificações recém-comitadas para execução imediata em segundo plano
   * sem bloquear o ciclo de resposta HTTP do Express.
   */
  public dispatchAsync(notificationIds: string[]): void {
    for (const id of notificationIds) {
      if (this.inFlightIds.has(id)) continue
      this.inFlightIds.add(id)

      const task = new Promise<void>((resolve) => {
        setImmediate(async () => {
          try {
            await this.processSingleNotification(id)
          } finally {
            this.inFlightIds.delete(id)
            resolve()
          }
        })
      })

      this.activeTasks.add(task)
      task.finally(() => {
        this.activeTasks.delete(task)
      })
    }
  }

  /**
   * Processa uma única notificação aplicando até 3 tentativas com intervalo fixo.
   */
  public async processSingleNotification(notificationId: string): Promise<void> {
    const notification = await this.notificationRepository.findById(notificationId)
    if (!notification || notification.status !== 'pending') {
      return
    }

    let attempt = notification.retryCount
    let lastErrorMessage = 'Erro desconhecido no envio da notificação.'

    while (attempt < MAX_NOTIFICATION_RETRIES) {
      attempt += 1
      try {
        await this.transport.send(notification)
        await this.notificationRepository.markSent(notification.id, attempt)
        this.logInfo('Notificação entregue com sucesso e marcada como sent.', {
          notificationId: notification.id,
          orderId: notification.orderId,
          attempt,
        })
        return
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : String(err)
        this.logWarn('Falha ao processar tentativa de notificação.', {
          notificationId: notification.id,
          orderId: notification.orderId,
          attempt,
          maxRetries: MAX_NOTIFICATION_RETRIES,
          error: lastErrorMessage,
        })

        if (attempt < MAX_NOTIFICATION_RETRIES) {
          await this.notificationRepository.recordAttemptFailure(
            notification.id,
            attempt,
            lastErrorMessage,
          )
          if (this.retryIntervalMs > 0) {
            await sleep(this.retryIntervalMs)
          }
        }
      }
    }

    await this.notificationRepository.markFailed(
      notification.id,
      attempt,
      lastErrorMessage,
    )
    this.logWarn('Notificação esgotou as 3 tentativas e foi preservada como failed.', {
      notificationId: notification.id,
      orderId: notification.orderId,
      attempts: attempt,
    })
  }

  /**
   * Varre notificações 'pending' remanescentes no banco (ex: pós-reinício do processo).
   */
  public async drainPendingQueue(batchSize = 50): Promise<void> {
    const pendingList = await this.notificationRepository.findPending(batchSize)
    if (pendingList.length === 0) return
    this.dispatchAsync(pendingList.map((n) => n.id))
  }

  /**
   * Aguarda todas as tarefas atualmente agendadas em background terminarem (útil em graceful shutdown e testes).
   */
  public async waitForIdle(): Promise<void> {
    while (this.activeTasks.size > 0) {
      await Promise.allSettled(Array.from(this.activeTasks))
    }
  }

  public startRecoveryPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      this.drainPendingQueue().catch((err) => {
        this.logWarn('Erro na varredura periódica da fila notification.', {
          error: err instanceof Error ? err.message : String(err),
        })
      })
    }, this.recoveryPollIntervalMs)
    this.pollTimer.unref()
  }

  public stopRecoveryPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}

