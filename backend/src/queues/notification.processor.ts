import { UnrecoverableError, type Job } from 'bullmq';
import { calcularProximaTentativaExponencial } from '../config/queue.js';
import { env } from '../config/env.js';
import {
  NotificacaoProviderError,
  type EmailProvider,
  type WhatsAppProvider,
} from '../integrations/notificacaoProvider.contracts.js';
import type { NotificacaoLogRepository } from '../repositories/contracts/notificacoes.contracts.js';
import { prismaNotificacaoLogRepository } from '../repositories/prismaNotificacaoLog.repository.js';
import { renderizarTemplateNotificacao } from '../templates/notificacoes/index.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';
import type { NotificationJobData } from './notification.queue.js';

export interface NotificationProcessorDeps {
  readonly emailProvider: EmailProvider;
  readonly whatsappProvider: WhatsAppProvider;
  readonly logRepository?: NotificacaoLogRepository;
  readonly defaultBackoffInitialMs?: number;
}

export interface NotificationJobProcessResult {
  readonly skipped?: boolean;
  readonly enviado: boolean;
  readonly provider?: string;
  readonly messageId?: string | null;
}

const CODIGOS_ERRO_TRANSITORIO_GENERICO = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
]);

function resolverDelayInicialBackoff(job: Pick<Job<NotificationJobData>, 'opts'>, fallbackMs: number): number {
  const backoff = job.opts?.backoff;
  if (typeof backoff === 'object' && backoff !== null && typeof backoff.delay === 'number') {
    return backoff.delay;
  }
  if (typeof backoff === 'number' && Number.isFinite(backoff)) {
    return backoff;
  }
  return fallbackMs;
}

function classificarErroProcessamento(err: unknown): {
  readonly transient: boolean;
  readonly codigo: string | null;
  readonly provider: string | null;
  readonly erroSanitizado: string;
} {
  if (err instanceof NotificacaoProviderError) {
    return {
      transient: err.transient,
      codigo: err.codigo,
      provider: err.provider,
      erroSanitizado: sanitizarErroProvedor(err.message),
    };
  }

  const errObj = err as { code?: unknown };
  const codigo = typeof errObj?.code === 'string' ? errObj.code.toUpperCase() : null;
  const transient = codigo !== null && CODIGOS_ERRO_TRANSITORIO_GENERICO.has(codigo);

  return {
    transient,
    codigo: codigo ?? 'NOTIFICATION_PROCESSING_ERROR',
    provider: null,
    erroSanitizado: sanitizarErroProvedor(err),
  };
}

export function createNotificationJobProcessor(deps: NotificationProcessorDeps) {
  const logRepository = deps.logRepository ?? prismaNotificacaoLogRepository;
  const defaultBackoffInitialMs =
    deps.defaultBackoffInitialMs ?? env.NOTIFICATION_BACKOFF_INITIAL_MS;

  return async function processarJobNotificacao(
    job: Pick<Job<NotificationJobData>, 'id' | 'data' | 'attemptsMade' | 'opts'>,
  ): Promise<NotificationJobProcessResult> {
    const {
      logNotificacaoId,
      canal,
      destinatarioReal,
      consentimentoWhatsapp,
      idiomaWhatsapp,
      payloadTemplate,
      idempotencyKey,
      correlationId,
    } = job.data;

    const tentativaAtual = job.attemptsMade + 1;
    const maxTentativas = job.opts?.attempts ?? env.NOTIFICATION_MAX_ATTEMPTS;

    const controle = await logRepository.marcarProcessando(logNotificacaoId, tentativaAtual);
    if (!controle.podeProcessar) {
      return {
        skipped: true,
        enviado: controle.log?.status === 'ENVIADA',
      };
    }

    let renderizado;
    try {
      renderizado = renderizarTemplateNotificacao(payloadTemplate);
    } catch (err) {
      const erroSanitizado = sanitizarErroProvedor(err);
      await logRepository.marcarFalhaPermanente(logNotificacaoId, {
        erroCodigo: 'TEMPLATE_PAYLOAD_INVALIDO',
        erroSanitizado,
      });
      throw new UnrecoverableError(erroSanitizado);
    }

    try {
      if (canal === 'EMAIL') {
        const resultado = await deps.emailProvider.enviarEmail({
          para: destinatarioReal,
          assunto: renderizado.assunto,
          html: renderizado.html,
          texto: renderizado.texto,
          idempotencyKey,
          correlationId,
        });

        await logRepository.marcarEnviada(logNotificacaoId, {
          provedor: resultado.provider,
          provedorMensagemId: resultado.messageId,
        });

        return {
          enviado: true,
          provider: resultado.provider,
          messageId: resultado.messageId,
        };
      }

      const resultado = await deps.whatsappProvider.enviarMensagem({
        paraTelefone: destinatarioReal,
        templateNome:
          renderizado.whatsappTemplateNome ?? `origem_${payloadTemplate.template.toLowerCase()}`,
        idioma: idiomaWhatsapp ?? env.WHATSAPP_DEFAULT_LANGUAGE,
        parametros: renderizado.whatsappParametros ?? [],
        textoFallback: renderizado.whatsappTexto ?? renderizado.texto,
        consentimentoWhatsapp: Boolean(consentimentoWhatsapp),
        idempotencyKey,
        correlationId,
      });

      await logRepository.marcarEnviada(logNotificacaoId, {
        provedor: resultado.provider,
        provedorMensagemId: resultado.messageId,
      });

      return {
        enviado: true,
        provider: resultado.provider,
        messageId: resultado.messageId,
      };
    } catch (err) {
      const infoErro = classificarErroProcessamento(err);
      const atingiuLimite = tentativaAtual >= maxTentativas;

      if (!infoErro.transient || atingiuLimite) {
        await logRepository.marcarFalhaPermanente(logNotificacaoId, {
          erroCodigo: infoErro.codigo,
          erroSanitizado: infoErro.erroSanitizado,
          provedor: infoErro.provider,
        });

        if (!infoErro.transient) {
          throw new UnrecoverableError(infoErro.erroSanitizado);
        }

        throw new Error(infoErro.erroSanitizado);
      }

      const delayInicialMs = resolverDelayInicialBackoff(job, defaultBackoffInitialMs);
      const proximaTentativaEm = calcularProximaTentativaExponencial(tentativaAtual, delayInicialMs);

      await logRepository.marcarFalhaTransitoria(logNotificacaoId, {
        erroCodigo: infoErro.codigo,
        erroSanitizado: infoErro.erroSanitizado,
        proximaTentativaEm,
      });

      throw new Error(infoErro.erroSanitizado);
    }
  };
}
