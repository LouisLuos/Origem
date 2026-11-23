import type { DefaultJobOptions } from 'bullmq';
import { env } from '../config/env.js';

export interface NotificationQueuePolicy {
  readonly queueName: string;
  readonly prefix: string;
  readonly attempts: number;
  readonly backoffInitialMs: number;
  readonly concurrency: number;
}

export function getNotificationQueuePolicy(
  overrides?: Partial<NotificationQueuePolicy>,
): NotificationQueuePolicy {
  return {
    queueName: overrides?.queueName ?? env.NOTIFICATION_QUEUE_NAME,
    prefix: overrides?.prefix ?? env.REDIS_KEY_PREFIX,
    attempts: overrides?.attempts ?? env.NOTIFICATION_MAX_ATTEMPTS,
    backoffInitialMs: overrides?.backoffInitialMs ?? env.NOTIFICATION_BACKOFF_INITIAL_MS,
    concurrency: overrides?.concurrency ?? env.NOTIFICATION_WORKER_CONCURRENCY,
  };
}

export function buildNotificationDefaultJobOptions(
  policy: Pick<NotificationQueuePolicy, 'attempts' | 'backoffInitialMs'>,
): DefaultJobOptions {
  return {
    attempts: policy.attempts,
    backoff: {
      type: 'exponential',
      delay: policy.backoffInitialMs,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: false,
  };
}

/**
 * Calcula o instante previsto da próxima retentativa seguindo a progressão exponencial do BullMQ:
 * tentativa 1 falhou -> `delay * 2^0` (`1000 ms`), tentativa 2 falhou -> `delay * 2^1` (`2000 ms`).
 */
export function calcularProximaTentativaExponencial(
  tentativaAtual: number,
  backoffInitialMs: number,
  agora: Date = new Date(),
): Date {
  const expoente = Math.max(0, Math.trunc(tentativaAtual) - 1);
  const atrasoMs = Math.max(50, Math.round(backoffInitialMs * Math.pow(2, expoente)));
  return new Date(agora.getTime() + atrasoMs);
}
