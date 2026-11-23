import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import {
  NotificacaoProviderError,
  postJsonComTimeout,
  type DispatchProviderResult,
  type EmailDispatchInput,
  type EmailProvider,
} from './notificacaoProvider.contracts.js';

export interface SmtpEmailProviderConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user?: string;
  readonly pass?: string;
  readonly from: string;
  readonly timeoutMs: number;
}

export interface HttpEmailProviderConfig {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly from: string;
  readonly timeoutMs: number;
  readonly nome?: string;
}

const CODIGOS_REDE_SMTP_TRANSITORIOS = new Set([
  'ECONNECTION',
  'ETIMEDOUT',
  'ESOCKET',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'EAI_AGAIN',
  'EDNS',
]);

function classificarErroSmtp(err: unknown): {
  readonly codigo: string;
  readonly transient: boolean;
  readonly statusHttp?: number;
  readonly mensagem: string;
} {
  const errObj = err as {
    code?: string;
    responseCode?: number;
    message?: string;
  };
  const codigoRede = typeof errObj?.code === 'string' ? errObj.code.toUpperCase() : '';
  const responseCode = typeof errObj?.responseCode === 'number' ? errObj.responseCode : undefined;

  if (responseCode !== undefined) {
    // Em SMTP, 4xx (421, 450, 451, 452) indica falha transitória; 5xx indica rejeição permanente.
    const transitorio = responseCode >= 400 && responseCode < 500;
    return {
      codigo: `SMTP_${responseCode}`,
      transient: transitorio,
      statusHttp: responseCode,
      mensagem: errObj?.message ?? `Erro SMTP ${responseCode}`,
    };
  }

  const transitorio = CODIGOS_REDE_SMTP_TRANSITORIOS.has(codigoRede);
  return {
    codigo: codigoRede || 'SMTP_SEND_ERROR',
    transient: transitorio,
    mensagem: errObj?.message ?? 'Falha ao enviar e-mail via SMTP.',
  };
}

function criarMessageIdDeterministico(idempotencyKey: string, from: string): string {
  const matchDominio = from.match(/@([a-zA-Z0-9.-]+)/);
  const dominio = matchDominio?.[1] ?? 'origem.local';
  const chaveLimpa = idempotencyKey.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `<${chaveLimpa}@${dominio}>`;
}

export class UnconfiguredEmailProvider implements EmailProvider {
  public readonly nome = 'unconfigured-email';
  public readonly configurado = false;

  async enviarEmail(_input: EmailDispatchInput): Promise<DispatchProviderResult> {
    throw new NotificacaoProviderError(
      'Provedor real de e-mail não configurado neste ambiente (configure EMAIL_PROVIDER e credenciais SMTP ou HTTP no backend/.env).',
      {
        codigo: 'PROVEDOR_EMAIL_NAO_CONFIGURADO',
        provider: this.nome,
        transient: false,
      },
    );
  }
}

export class SmtpEmailProvider implements EmailProvider {
  public readonly nome = 'smtp';
  public readonly configurado = true;
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpEmailProviderConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.pass
          ? { user: config.user, pass: config.pass }
          : undefined,
      connectionTimeout: config.timeoutMs,
      greetingTimeout: config.timeoutMs,
      socketTimeout: config.timeoutMs,
    });
  }

  async enviarEmail(input: EmailDispatchInput): Promise<DispatchProviderResult> {
    const messageId = criarMessageIdDeterministico(input.idempotencyKey, this.config.from);
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: input.para,
        subject: input.assunto,
        text: input.texto,
        html: input.html,
        messageId,
        headers: {
          'X-Idempotency-Key': input.idempotencyKey,
          ...(input.correlationId ? { 'X-Correlation-Id': input.correlationId } : {}),
        },
      });

      return {
        provider: this.nome,
        messageId: info.messageId || messageId,
      };
    } catch (err) {
      const classificado = classificarErroSmtp(err);
      throw new NotificacaoProviderError(classificado.mensagem, {
        codigo: classificado.codigo,
        provider: this.nome,
        transient: classificado.transient,
        statusHttp: classificado.statusHttp,
      });
    }
  }
}

export class HttpEmailProvider implements EmailProvider {
  public readonly nome: string;
  public readonly configurado = true;

  constructor(private readonly config: HttpEmailProviderConfig) {
    this.nome = config.nome ?? 'http_webhook';
  }

  async enviarEmail(input: EmailDispatchInput): Promise<DispatchProviderResult> {
    const headers: Record<string, string> = {
      'Idempotency-Key': input.idempotencyKey,
      ...(input.correlationId ? { 'X-Correlation-Id': input.correlationId } : {}),
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const { json } = await postJsonComTimeout({
      provider: this.nome,
      url: this.config.endpoint,
      headers,
      timeoutMs: this.config.timeoutMs,
      body: {
        from: this.config.from,
        to: input.para,
        subject: input.assunto,
        html: input.html,
        text: input.texto,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const record = json as { id?: unknown; messageId?: unknown } | null;
    const messageId =
      typeof record?.messageId === 'string'
        ? record.messageId
        : typeof record?.id === 'string'
          ? record.id
          : null;

    return {
      provider: this.nome,
      messageId,
    };
  }
}

export function createEmailProviderFromEnv(
  config: Partial<{
    EMAIL_PROVIDER: 'disabled' | 'smtp' | 'http_webhook';
    EMAIL_FROM: string;
    SMTP_HOST: string;
    SMTP_PORT: number;
    SMTP_SECURE: boolean;
    SMTP_USER: string;
    SMTP_PASS: string;
    EMAIL_HTTP_ENDPOINT: string;
    EMAIL_HTTP_API_KEY: string;
    NOTIFICATION_PROVIDER_TIMEOUT_MS: number;
  }> = env,
): EmailProvider {
  const modo = config.EMAIL_PROVIDER ?? 'disabled';
  const from = config.EMAIL_FROM ?? env.EMAIL_FROM;
  const timeoutMs = config.NOTIFICATION_PROVIDER_TIMEOUT_MS ?? env.NOTIFICATION_PROVIDER_TIMEOUT_MS;

  if (modo === 'smtp' && config.SMTP_HOST) {
    return new SmtpEmailProvider({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT ?? env.SMTP_PORT,
      secure: config.SMTP_SECURE ?? env.SMTP_SECURE,
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
      from,
      timeoutMs,
    });
  }

  if (modo === 'http_webhook' && config.EMAIL_HTTP_ENDPOINT) {
    return new HttpEmailProvider({
      endpoint: config.EMAIL_HTTP_ENDPOINT,
      apiKey: config.EMAIL_HTTP_API_KEY,
      from,
      timeoutMs,
    });
  }

  return new UnconfiguredEmailProvider();
}
