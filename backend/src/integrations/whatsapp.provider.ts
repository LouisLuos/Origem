import { env } from '../config/env.js';
import { normalizarTelefoneWhatsappE164 } from '../utils/notificationPrivacy.util.js';
import {
  NotificacaoProviderError,
  postJsonComTimeout,
  type DispatchProviderResult,
  type WhatsAppDispatchInput,
  type WhatsAppProvider,
} from './notificacaoProvider.contracts.js';

export interface MetaWhatsAppCloudConfig {
  readonly baseUrl: string;
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly defaultLanguage: string;
  readonly timeoutMs: number;
}

export interface HttpWhatsAppProviderConfig {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly defaultLanguage: string;
  readonly timeoutMs: number;
  readonly nome?: string;
}

const META_CODIGOS_TRANSITORIOS = new Set([2, 4, 17, 130429, 131016, 131048, 131056]);

function validarElegibilidadeWhatsApp(
  provider: string,
  input: WhatsAppDispatchInput,
): string {
  if (!input.consentimentoWhatsapp) {
    throw new NotificacaoProviderError(
      'Envio por WhatsApp bloqueado por ausência de consentimento explícito do destinatário.',
      {
        codigo: 'WHATSAPP_SEM_CONSENTIMENTO',
        provider,
        transient: false,
      },
    );
  }

  const e164 = normalizarTelefoneWhatsappE164(input.paraTelefone);
  if (!e164) {
    throw new NotificacaoProviderError(
      'Número de telefone WhatsApp inválido para envio transacional.',
      {
        codigo: 'TELEFONE_WHATSAPP_INVALIDO',
        provider,
        transient: false,
      },
    );
  }

  return e164;
}

function extrairMetaErrorCode(bodyJson: unknown): number | null {
  const record = bodyJson as { error?: { code?: unknown } } | null;
  return typeof record?.error?.code === 'number' ? record.error.code : null;
}

export class UnconfiguredWhatsAppProvider implements WhatsAppProvider {
  public readonly nome = 'unconfigured-whatsapp';
  public readonly configurado = false;

  async enviarMensagem(input: WhatsAppDispatchInput): Promise<DispatchProviderResult> {
    validarElegibilidadeWhatsApp(this.nome, input);
    throw new NotificacaoProviderError(
      'Provedor oficial de WhatsApp Business não configurado neste ambiente (configure WHATSAPP_PROVIDER, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN).',
      {
        codigo: 'PROVEDOR_WHATSAPP_NAO_CONFIGURADO',
        provider: this.nome,
        transient: false,
      },
    );
  }
}

/**
 * Adaptador oficial para a Meta WhatsApp Business Cloud API (`POST /{phoneNumberId}/messages`).
 * Não utiliza automação não oficial de WhatsApp Web.
 */
export class MetaWhatsAppCloudProvider implements WhatsAppProvider {
  public readonly nome = 'meta_cloud';
  public readonly configurado = true;

  constructor(private readonly config: MetaWhatsAppCloudConfig) {}

  async enviarMensagem(input: WhatsAppDispatchInput): Promise<DispatchProviderResult> {
    const e164 = validarElegibilidadeWhatsApp(this.nome, input);
    const endpoint = `${this.config.baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(this.config.phoneNumberId)}/messages`;
    const idioma = input.idioma || this.config.defaultLanguage;

    const { json } = await postJsonComTimeout({
      provider: this.nome,
      url: endpoint,
      timeoutMs: this.config.timeoutMs,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'X-Idempotency-Key': input.idempotencyKey,
        ...(input.correlationId ? { 'X-Correlation-Id': input.correlationId } : {}),
      },
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: e164.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: input.templateNome,
          language: { code: idioma },
          components:
            input.parametros.length > 0
              ? [
                  {
                    type: 'body',
                    parameters: input.parametros.map((texto) => ({
                      type: 'text',
                      text: texto,
                    })),
                  },
                ]
              : undefined,
        },
      },
      codigoErroHttpTransitorio: (_status, bodyJson) => {
        const metaCode = extrairMetaErrorCode(bodyJson);
        return metaCode !== null && META_CODIGOS_TRANSITORIOS.has(metaCode);
      },
    });

    const record = json as { messages?: Array<{ id?: unknown }> } | null;
    const messageId =
      typeof record?.messages?.[0]?.id === 'string' ? record.messages[0].id : null;

    return {
      provider: this.nome,
      messageId,
    };
  }
}

export class HttpWhatsAppProvider implements WhatsAppProvider {
  public readonly nome: string;
  public readonly configurado = true;

  constructor(private readonly config: HttpWhatsAppProviderConfig) {
    this.nome = config.nome ?? 'http_webhook';
  }

  async enviarMensagem(input: WhatsAppDispatchInput): Promise<DispatchProviderResult> {
    const e164 = validarElegibilidadeWhatsApp(this.nome, input);
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
        to: e164,
        templateName: input.templateNome,
        language: input.idioma || this.config.defaultLanguage,
        parameters: input.parametros,
        textFallback: input.textoFallback,
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

export interface WhatsAppConfigValidationResult {
  readonly valido: boolean;
  readonly provider: string;
  readonly configurado: boolean;
  readonly erros: string[];
}

export function validarConfiguracaoProvedorWhatsapp(
  config: Partial<{
    WHATSAPP_PROVIDER: 'disabled' | 'meta_cloud' | 'http_webhook';
    WHATSAPP_API_BASE_URL: string;
    WHATSAPP_PHONE_NUMBER_ID: string;
    WHATSAPP_ACCESS_TOKEN: string;
    WHATSAPP_HTTP_ENDPOINT: string;
  }> = env,
): WhatsAppConfigValidationResult {
  const modo = config.WHATSAPP_PROVIDER ?? 'disabled';
  const erros: string[] = [];

  if (modo === 'disabled') {
    return { valido: true, provider: 'disabled', configurado: false, erros };
  }

  if (modo === 'meta_cloud') {
    if (!config.WHATSAPP_PHONE_NUMBER_ID?.trim()) {
      erros.push('WHATSAPP_PHONE_NUMBER_ID é obrigatório quando WHATSAPP_PROVIDER=meta_cloud.');
    }
    if (!config.WHATSAPP_ACCESS_TOKEN?.trim()) {
      erros.push('WHATSAPP_ACCESS_TOKEN é obrigatório quando WHATSAPP_PROVIDER=meta_cloud.');
    }
    const baseUrl = (config.WHATSAPP_API_BASE_URL ?? env.WHATSAPP_API_BASE_URL).trim();
    if (!/^https?:\/\/.+/.test(baseUrl)) {
      erros.push('WHATSAPP_API_BASE_URL deve ser uma URL HTTP/HTTPS válida.');
    }
    return {
      valido: erros.length === 0,
      provider: 'meta_cloud',
      configurado: erros.length === 0,
      erros,
    };
  }

  if (modo === 'http_webhook') {
    if (!config.WHATSAPP_HTTP_ENDPOINT?.trim()) {
      erros.push('WHATSAPP_HTTP_ENDPOINT é obrigatório quando WHATSAPP_PROVIDER=http_webhook.');
    }
    return {
      valido: erros.length === 0,
      provider: 'http_webhook',
      configurado: erros.length === 0,
      erros,
    };
  }

  return { valido: true, provider: 'disabled', configurado: false, erros };
}

export function createWhatsAppProviderFromEnv(
  config: Partial<{
    WHATSAPP_PROVIDER: 'disabled' | 'meta_cloud' | 'http_webhook';
    WHATSAPP_API_BASE_URL: string;
    WHATSAPP_PHONE_NUMBER_ID: string;
    WHATSAPP_ACCESS_TOKEN: string;
    WHATSAPP_DEFAULT_LANGUAGE: string;
    WHATSAPP_HTTP_ENDPOINT: string;
    WHATSAPP_HTTP_API_KEY: string;
    NOTIFICATION_PROVIDER_TIMEOUT_MS: number;
  }> = env,
): WhatsAppProvider {
  const validacao = validarConfiguracaoProvedorWhatsapp(config);
  const defaultLanguage = config.WHATSAPP_DEFAULT_LANGUAGE ?? env.WHATSAPP_DEFAULT_LANGUAGE;
  const timeoutMs = config.NOTIFICATION_PROVIDER_TIMEOUT_MS ?? env.NOTIFICATION_PROVIDER_TIMEOUT_MS;

  if (
    validacao.configurado &&
    validacao.provider === 'meta_cloud' &&
    config.WHATSAPP_PHONE_NUMBER_ID &&
    config.WHATSAPP_ACCESS_TOKEN
  ) {
    return new MetaWhatsAppCloudProvider({
      baseUrl: config.WHATSAPP_API_BASE_URL ?? env.WHATSAPP_API_BASE_URL,
      phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: config.WHATSAPP_ACCESS_TOKEN,
      defaultLanguage,
      timeoutMs,
    });
  }

  if (validacao.configurado && validacao.provider === 'http_webhook' && config.WHATSAPP_HTTP_ENDPOINT) {
    return new HttpWhatsAppProvider({
      endpoint: config.WHATSAPP_HTTP_ENDPOINT,
      apiKey: config.WHATSAPP_HTTP_API_KEY,
      defaultLanguage,
      timeoutMs,
    });
  }

  return new UnconfiguredWhatsAppProvider();
}
