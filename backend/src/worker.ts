import { prisma } from './config/database.js';
import { env } from './config/env.js';
import {
  createEmailProviderFromEnv,
  validarConfiguracaoProvedorEmail,
} from './integrations/email.provider.js';
import {
  createWhatsAppProviderFromEnv,
  validarConfiguracaoProvedorWhatsapp,
} from './integrations/whatsapp.provider.js';
import { iniciarAgendadorSlaPostagem } from './jobs/checkPostageSla.job.js';
import { createNotificationProducer } from './queues/notification.queue.js';
import { createNotificationWorker } from './queues/notification.worker.js';
import { prismaNotificacaoLogRepository } from './repositories/prismaNotificacaoLog.repository.js';
import { unconfiguredSubpedidoSlaRepository } from './repositories/contracts/slaPostagem.contracts.js';

const validacaoEmail = validarConfiguracaoProvedorEmail();
const validacaoWhatsapp = validarConfiguracaoProvedorWhatsapp();
const emailProvider = createEmailProviderFromEnv();
const whatsappProvider = createWhatsAppProviderFromEnv();

const producer = createNotificationProducer({
  logRepository: prismaNotificacaoLogRepository,
});

const workerHandle = createNotificationWorker({
  emailProvider,
  whatsappProvider,
  logRepository: prismaNotificacaoLogRepository,
});

// Agendador de fiscalização SLA de postagem (executa no worker separado, sem bloquear o Express)
const agendadorSla = iniciarAgendadorSlaPostagem({
  subpedidoRepository: unconfiguredSubpedidoSlaRepository,
  producer,
});

console.info(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    evento: 'NOTIFICATION_WORKER_STARTED',
    queue: env.NOTIFICATION_QUEUE_NAME,
    prefix: env.REDIS_KEY_PREFIX,
    concurrency: env.NOTIFICATION_WORKER_CONCURRENCY,
    maxAttempts: env.NOTIFICATION_MAX_ATTEMPTS,
    backoffInitialMs: env.NOTIFICATION_BACKOFF_INITIAL_MS,
    emailProvider: emailProvider.nome,
    emailConfigurado: emailProvider.configurado,
    emailConfigValida: validacaoEmail.valido,
    emailConfigErros: validacaoEmail.erros,
    whatsappProvider: whatsappProvider.nome,
    whatsappConfigurado: whatsappProvider.configurado,
    whatsappConfigValida: validacaoWhatsapp.valido,
    whatsappConfigErros: validacaoWhatsapp.erros,
    slaSubpedidoRepoConfigurado: unconfiguredSubpedidoSlaRepository.configurado,
  }),
);

let encerrando = false;

async function handleShutdown(signal: string): Promise<void> {
  if (encerrando) return;
  encerrando = true;

  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      evento: 'NOTIFICATION_WORKER_SHUTDOWN',
      signal,
    }),
  );

  agendadorSla.parar();
  await Promise.allSettled([workerHandle.close(), producer.fechar(), prisma.$disconnect()]);
  process.exit(0);
}

process.on('SIGTERM', () => {
  void handleShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void handleShutdown('SIGINT');
});
