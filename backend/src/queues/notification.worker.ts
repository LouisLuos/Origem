import { Worker } from 'bullmq';
import { createBullMqConnectionOptions, type RedisConfigInput } from '../cache/redis.client.js';
import { getNotificationQueuePolicy, type NotificationQueuePolicy } from '../config/queue.js';
import type {
  EmailProvider,
  WhatsAppProvider,
} from '../integrations/notificacaoProvider.contracts.js';
import type { NotificacaoLogRepository } from '../repositories/contracts/notificacoes.contracts.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';
import {
  createNotificationJobProcessor,
  type NotificationJobProcessResult,
} from './notification.processor.js';
import type { NotificationJobData } from './notification.queue.js';

export interface NotificationWorkerHandle {
  readonly worker: Worker<NotificationJobData, NotificationJobProcessResult>;
  close(): Promise<void>;
}

export function createNotificationWorker(opcoes: {
  readonly emailProvider: EmailProvider;
  readonly whatsappProvider: WhatsAppProvider;
  readonly logRepository?: NotificacaoLogRepository;
  readonly redisConfig?: RedisConfigInput;
  readonly policy?: Partial<NotificationQueuePolicy>;
  readonly logger?: (registro: Record<string, unknown>) => void;
}): NotificationWorkerHandle {
  const policy = getNotificationQueuePolicy(opcoes.policy);
  const log = opcoes.logger ?? ((registro) => console.info(JSON.stringify(registro)));
  const processador = createNotificationJobProcessor({
    emailProvider: opcoes.emailProvider,
    whatsappProvider: opcoes.whatsappProvider,
    logRepository: opcoes.logRepository,
    defaultBackoffInitialMs: policy.backoffInitialMs,
  });

  const worker = new Worker<NotificationJobData, NotificationJobProcessResult>(
    policy.queueName,
    processador,
    {
      connection: createBullMqConnectionOptions(opcoes.redisConfig),
      prefix: policy.prefix,
      concurrency: policy.concurrency,
    },
  );

  worker.on('completed', (job, resultado) => {
    log({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      evento: 'NOTIFICATION_JOB_COMPLETED',
      jobId: job.id ?? null,
      logNotificacaoId: job.data.logNotificacaoId,
      canal: job.data.canal,
      template: job.data.template,
      attemptsMade: job.attemptsMade + 1,
      skipped: Boolean(resultado?.skipped),
      provider: resultado?.provider ?? null,
    });
  });

  worker.on('failed', (job, err) => {
    log({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      evento: 'NOTIFICATION_JOB_FAILED',
      jobId: job?.id ?? null,
      logNotificacaoId: job?.data?.logNotificacaoId ?? null,
      canal: job?.data?.canal ?? null,
      template: job?.data?.template ?? null,
      attemptsMade: job ? job.attemptsMade : null,
      maxAttempts: job?.opts?.attempts ?? policy.attempts,
      erro: sanitizarErroProvedor(err),
    });
  });

  worker.on('error', (err) => {
    log({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      evento: 'NOTIFICATION_WORKER_ERROR',
      erro: sanitizarErroProvedor(err),
    });
  });

  return {
    worker,
    async close(): Promise<void> {
      await worker.close();
    },
  };
}
