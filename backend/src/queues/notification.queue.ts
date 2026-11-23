import { Queue, type JobsOptions } from 'bullmq';
import { createBullMqConnectionOptions, type RedisConfigInput } from '../cache/redis.client.js';
import {
  buildNotificationDefaultJobOptions,
  getNotificationQueuePolicy,
  type NotificationQueuePolicy,
} from '../config/queue.js';
import type {
  CanalNotificacao,
  NotificacaoLogRepository,
  StatusNotificacao,
  TemplateNotificacaoId,
} from '../repositories/contracts/notificacoes.contracts.js';
import { prismaNotificacaoLogRepository } from '../repositories/prismaNotificacaoLog.repository.js';
import type { PayloadTemplateNotificacao } from '../templates/notificacoes/index.js';
import {
  construirChaveIdempotenciaNotificacao,
  mascararDestinatario,
  normalizarTelefoneWhatsappE164,
  sanitizarErroProvedor,
} from '../utils/notificationPrivacy.util.js';

export interface NotificationJobData {
  readonly logNotificacaoId: string;
  readonly eventoOrigem: string;
  readonly canal: CanalNotificacao;
  readonly template: TemplateNotificacaoId;
  readonly destinatarioReal: string;
  readonly consentimentoWhatsapp?: boolean;
  readonly idiomaWhatsapp?: string;
  readonly payloadTemplate: PayloadTemplateNotificacao;
  readonly idempotencyKey: string;
  readonly correlationId?: string | null;
}

export interface EnfileirarNotificacaoInput {
  readonly eventoOrigem: string;
  readonly canal: CanalNotificacao;
  readonly destinatarioReal: string;
  readonly consentimentoWhatsapp?: boolean;
  readonly idiomaWhatsapp?: string;
  readonly pedidoId?: string | null;
  readonly subpedidoId?: string | null;
  readonly usuarioId?: string | null;
  readonly atelieId?: string | null;
  readonly payloadTemplate: PayloadTemplateNotificacao;
  readonly idempotencyKey?: string;
  readonly correlationId?: string | null;
}

export interface EnfileirarNotificacaoResultado {
  readonly logId: string;
  readonly jobId: string | null;
  readonly status: StatusNotificacao;
  readonly duplicada: boolean;
  readonly enfileirada: boolean;
}

export interface NotificationQueueClient {
  add(name: string, data: NotificationJobData, opts?: JobsOptions): Promise<{ id?: string }>;
  close(): Promise<void>;
}

export interface NotificationProducer {
  enfileirar(input: EnfileirarNotificacaoInput): Promise<EnfileirarNotificacaoResultado>;
  fechar(): Promise<void>;
}

export function createBullMqNotificationQueue(opcoes?: {
  readonly redisConfig?: RedisConfigInput;
  readonly policy?: Partial<NotificationQueuePolicy>;
}): Queue<NotificationJobData> {
  const policy = getNotificationQueuePolicy(opcoes?.policy);
  return new Queue<NotificationJobData>(policy.queueName, {
    connection: createBullMqConnectionOptions(opcoes?.redisConfig),
    prefix: policy.prefix,
    defaultJobOptions: buildNotificationDefaultJobOptions(policy),
  });
}

function sanitizarJobIdBullMq(chave: string): string {
  // BullMQ v5/v6 rejeita `:` em jobId customizado
  return chave.replace(/:/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
}

export function createNotificationProducer(deps?: {
  readonly queue?: NotificationQueueClient;
  readonly logRepository?: NotificacaoLogRepository;
  readonly policy?: Partial<NotificationQueuePolicy>;
  readonly redisConfig?: RedisConfigInput;
}): NotificationProducer {
  const policy = getNotificationQueuePolicy(deps?.policy);
  const logRepository = deps?.logRepository ?? prismaNotificacaoLogRepository;
  let queuePropria: Queue<NotificationJobData> | null = null;
  const queue: NotificationQueueClient =
    deps?.queue ??
    (() => {
      queuePropria = createBullMqNotificationQueue({
        redisConfig: deps?.redisConfig,
        policy,
      });
      return queuePropria;
    })();

  return {
    async enfileirar(input: EnfileirarNotificacaoInput): Promise<EnfileirarNotificacaoResultado> {
      const idempotencyKey = sanitizarJobIdBullMq(
        input.idempotencyKey ??
          construirChaveIdempotenciaNotificacao(input.eventoOrigem, [
            input.pedidoId,
            input.subpedidoId,
            input.usuarioId,
            input.atelieId,
            input.canal,
            input.payloadTemplate.template,
          ]),
      );

      const destinatarioMascarado = mascararDestinatario(input.canal, input.destinatarioReal);

      let statusInicial: 'ENFILEIRADA' | 'IGNORADA' = 'ENFILEIRADA';
      let motivoIgnoradaCodigo: string | null = null;
      let motivoIgnoradaSanitizado: string | null = null;

      if (input.canal === 'WHATSAPP') {
        if (!input.consentimentoWhatsapp) {
          statusInicial = 'IGNORADA';
          motivoIgnoradaCodigo = 'WHATSAPP_SEM_CONSENTIMENTO';
          motivoIgnoradaSanitizado =
            'Envio por WhatsApp ignorado por ausência de consentimento explícito do destinatário.';
        } else if (!normalizarTelefoneWhatsappE164(input.destinatarioReal)) {
          statusInicial = 'IGNORADA';
          motivoIgnoradaCodigo = 'TELEFONE_WHATSAPP_INVALIDO';
          motivoIgnoradaSanitizado =
            'Envio por WhatsApp ignorado devido a telefone inválido para padrão E.164.';
        }
      }

      const { log, criado } = await logRepository.garantirRegistroIdempotente({
        eventoOrigem: input.eventoOrigem,
        pedidoId: input.pedidoId ?? null,
        subpedidoId: input.subpedidoId ?? null,
        usuarioId: input.usuarioId ?? null,
        atelieId: input.atelieId ?? null,
        destinatarioMascarado,
        canal: input.canal,
        template: input.payloadTemplate.template,
        maxTentativas: policy.attempts,
        idempotencyKey,
        correlationId: input.correlationId ?? null,
        statusInicial,
        motivoIgnoradaCodigo,
        motivoIgnoradaSanitizado,
      });

      if (statusInicial === 'IGNORADA') {
        return {
          logId: log.id,
          jobId: null,
          status: log.status,
          duplicada: !criado,
          enfileirada: false,
        };
      }

      if (!criado && (log.status === 'ENVIADA' || log.status === 'IGNORADA' || log.jobId)) {
        return {
          logId: log.id,
          jobId: log.jobId ?? idempotencyKey,
          status: log.status,
          duplicada: true,
          enfileirada: false,
        };
      }

      try {
        const job = await queue.add(
          `notificacao.${input.payloadTemplate.template.toLowerCase()}`,
          {
            logNotificacaoId: log.id,
            eventoOrigem: input.eventoOrigem,
            canal: input.canal,
            template: input.payloadTemplate.template,
            destinatarioReal: input.destinatarioReal,
            consentimentoWhatsapp: input.consentimentoWhatsapp,
            idiomaWhatsapp: input.idiomaWhatsapp,
            payloadTemplate: input.payloadTemplate,
            idempotencyKey,
            correlationId: input.correlationId ?? null,
          },
          {
            jobId: idempotencyKey,
            attempts: policy.attempts,
            backoff: {
              type: 'exponential',
              delay: policy.backoffInitialMs,
            },
          },
        );

        const jobId = job.id ?? idempotencyKey;
        await logRepository.vincularJobId(log.id, jobId);

        return {
          logId: log.id,
          jobId,
          status: log.status,
          duplicada: !criado,
          enfileirada: true,
        };
      } catch (err) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            evento: 'NOTIFICATION_ENQUEUE_FAILED',
            logId: log.id,
            canal: input.canal,
            template: input.payloadTemplate.template,
            erro: sanitizarErroProvedor(err),
          }),
        );
        throw err;
      }
    },

    async fechar(): Promise<void> {
      if (queuePropria) {
        await queuePropria.close();
        queuePropria = null;
      } else {
        await queue.close();
      }
    },
  };
}
