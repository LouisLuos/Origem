import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';

export interface NotificacaoProviderErrorOptions {
  readonly codigo: string;
  readonly provider: string;
  readonly transient: boolean;
  readonly statusHttp?: number;
}

/**
 * Erro tipado para adaptadores de notificação, distinguindo falhas transitórias
 * (elegíveis para retentativa exponencial no BullMQ) de falhas permanentes.
 */
export class NotificacaoProviderError extends Error {
  public readonly codigo: string;
  public readonly provider: string;
  public readonly transient: boolean;
  public readonly statusHttp?: number;

  constructor(mensagem: string, options: NotificacaoProviderErrorOptions) {
    super(sanitizarErroProvedor(mensagem));
    this.name = 'NotificacaoProviderError';
    this.codigo = options.codigo;
    this.provider = options.provider;
    this.transient = options.transient;
    this.statusHttp = options.statusHttp;
    Object.setPrototypeOf(this, NotificacaoProviderError.prototype);
  }
}

export interface EmailDispatchInput {
  readonly para: string;
  readonly assunto: string;
  readonly html: string;
  readonly texto: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string | null;
}

export interface DispatchProviderResult {
  readonly provider: string;
  readonly messageId: string | null;
}

export interface EmailProvider {
  readonly nome: string;
  readonly configurado: boolean;
  enviarEmail(input: EmailDispatchInput): Promise<DispatchProviderResult>;
}

export interface WhatsAppDispatchInput {
  readonly paraTelefone: string;
  readonly templateNome: string;
  readonly idioma: string;
  readonly parametros: readonly string[];
  readonly textoFallback: string;
  readonly consentimentoWhatsapp: boolean;
  readonly idempotencyKey: string;
  readonly correlationId?: string | null;
}

export interface WhatsAppProvider {
  readonly nome: string;
  readonly configurado: boolean;
  enviarMensagem(input: WhatsAppDispatchInput): Promise<DispatchProviderResult>;
}

/**
 * Determina se um status HTTP representa instabilidade transitória que deve sofrer retry.
 */
export function ehStatusHttpTransitorio(statusHttp: number): boolean {
  return statusHttp === 408 || statusHttp === 425 || statusHttp === 429 || (statusHttp >= 500 && statusHttp <= 599);
}

/**
 * Executa requisição JSON com timeout explícito, Idempotency-Key e classificação padronizada
 * entre falhas HTTP transitórias (ex.: 503/429/timeout/rede) e permanentes (ex.: 400/401/403).
 */
export async function postJsonComTimeout(opcoes: {
  readonly provider: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body: unknown;
  readonly timeoutMs: number;
  readonly codigoErroHttpTransitorio?: (status: number, bodyJson: unknown) => boolean;
}): Promise<{ readonly status: number; readonly json: unknown }> {
  let response: Response;
  try {
    response = await fetch(opcoes.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...opcoes.headers,
      },
      body: JSON.stringify(opcoes.body),
      signal: AbortSignal.timeout(opcoes.timeoutMs),
    });
  } catch (err) {
    const errObj = err as { name?: string; code?: string };
    const ehTimeout = errObj?.name === 'TimeoutError' || errObj?.name === 'AbortError';
    throw new NotificacaoProviderError(
      ehTimeout
        ? `Tempo limite excedido ao comunicar com o provedor ${opcoes.provider}.`
        : `Falha de rede ao comunicar com o provedor ${opcoes.provider}.`,
      {
        codigo: ehTimeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_NETWORK_ERROR',
        provider: opcoes.provider,
        transient: true,
      },
    );
  }

  let bodyJson: unknown = null;
  const textoBruto = await response.text().catch(() => '');
  if (textoBruto) {
    try {
      bodyJson = JSON.parse(textoBruto) as unknown;
    } catch {
      bodyJson = { rawText: textoBruto };
    }
  }

  if (!response.ok) {
    const transitorio =
      ehStatusHttpTransitorio(response.status) ||
      Boolean(opcoes.codigoErroHttpTransitorio?.(response.status, bodyJson));

    throw new NotificacaoProviderError(
      `Provedor ${opcoes.provider} respondeu HTTP ${response.status}.`,
      {
        codigo: `HTTP_${response.status}`,
        provider: opcoes.provider,
        transient: transitorio,
        statusHttp: response.status,
      },
    );
  }

  return { status: response.status, json: bodyJson };
}
