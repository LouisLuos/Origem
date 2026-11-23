import { env } from '../config/env.js';
import type {
  CotacaoFrete,
  CotacaoFreteInput,
  ProvedorCotacaoFrete,
} from '../repositories/contracts/frete.contracts.js';
import { AppError } from '../utils/AppError.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';

export const FRETE_ERROR_CODES = {
  PROVEDOR_FRETE_NAO_CONFIGURADO: 'PROVEDOR_FRETE_NAO_CONFIGURADO',
  PROVEDOR_FRETE_INDISPONIVEL: 'PROVEDOR_FRETE_INDISPONIVEL',
  ORIGEM_SEM_ENDERECO_EXPEDICAO: 'ORIGEM_SEM_ENDERECO_EXPEDICAO',
  CEP_DESTINO_INVALIDO: 'CEP_DESTINO_INVALIDO',
} as const;

export interface HttpCotacaoFreteProviderConfig {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly nome?: string;
}

export interface FreteProviderValidationResult {
  readonly valido: boolean;
  readonly provider: string;
  readonly configurado: boolean;
  readonly erros: string[];
}

/**
 * Adaptador fail-closed usado enquanto nenhuma transportadora/tabela tarifária oficial
 * está configurada. Nunca inventa nem simula valor de frete.
 */
export class UnconfiguredCotacaoFreteProvider implements ProvedorCotacaoFrete {
  public readonly nome = 'unconfigured-frete';
  public readonly configurado = false;

  async cotar(_dados: CotacaoFreteInput): Promise<CotacaoFrete> {
    throw new AppError(
      'Provedor real de cotação de frete não configurado neste ambiente. Configure FRETE_PROVIDER=http_webhook e FRETE_HTTP_ENDPOINT ou defina a tabela tarifária oficial antes de concluir o checkout.',
      503,
      FRETE_ERROR_CODES.PROVEDOR_FRETE_NAO_CONFIGURADO,
    );
  }
}

/**
 * Adaptador HTTP desacoplado (ADR-001) para serviços externos de cotação por origem/destino e cubagem.
 */
export class HttpCotacaoFreteProvider implements ProvedorCotacaoFrete {
  public readonly nome: string;
  public readonly configurado = true;

  constructor(private readonly config: HttpCotacaoFreteProviderConfig) {
    this.nome = config.nome ?? 'http_webhook';
  }

  async cotar(dados: CotacaoFreteInput): Promise<CotacaoFrete> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(dados),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err) {
      throw new AppError(
        `Serviço de cotação de frete indisponível no momento (${sanitizarErroProvedor(err)}).`,
        503,
        FRETE_ERROR_CODES.PROVEDOR_FRETE_INDISPONIVEL,
      );
    }

    if (!response.ok) {
      throw new AppError(
        `Provedor de frete respondeu com status ${response.status}.`,
        503,
        FRETE_ERROR_CODES.PROVEDOR_FRETE_INDISPONIVEL,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AppError(
        'Resposta inválida do provedor de cotação de frete.',
        503,
        FRETE_ERROR_CODES.PROVEDOR_FRETE_INDISPONIVEL,
      );
    }

    const record = payload as { valorBrl?: unknown; prazoEstimadoDias?: unknown } | null;
    const valorBrl = typeof record?.valorBrl === 'number' ? record.valorBrl : Number(record?.valorBrl);
    const prazoEstimadoDias =
      typeof record?.prazoEstimadoDias === 'number'
        ? record.prazoEstimadoDias
        : Number(record?.prazoEstimadoDias);

    if (
      !Number.isFinite(valorBrl) ||
      valorBrl < 0 ||
      !Number.isFinite(prazoEstimadoDias) ||
      prazoEstimadoDias < 1
    ) {
      throw new AppError(
        'Provedor de frete retornou cotação fora do contrato esperado.',
        503,
        FRETE_ERROR_CODES.PROVEDOR_FRETE_INDISPONIVEL,
      );
    }

    return {
      valorBrl: Number(valorBrl.toFixed(2)),
      prazoEstimadoDias: Math.floor(prazoEstimadoDias),
    };
  }
}

export function validarConfiguracaoProvedorFrete(
  config: Partial<{
    FRETE_PROVIDER: 'disabled' | 'http_webhook';
    FRETE_HTTP_ENDPOINT: string;
    FRETE_HTTP_API_KEY: string;
    FRETE_TIMEOUT_MS: number;
  }> = env,
): FreteProviderValidationResult {
  const modo = config.FRETE_PROVIDER ?? 'disabled';
  const erros: string[] = [];

  if (modo === 'disabled') {
    return { valido: true, provider: 'disabled', configurado: false, erros };
  }

  if (modo === 'http_webhook') {
    if (!config.FRETE_HTTP_ENDPOINT?.trim()) {
      erros.push('FRETE_HTTP_ENDPOINT é obrigatório quando FRETE_PROVIDER=http_webhook.');
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

export function createFreteProviderFromEnv(
  config: Partial<{
    FRETE_PROVIDER: 'disabled' | 'http_webhook';
    FRETE_HTTP_ENDPOINT: string;
    FRETE_HTTP_API_KEY: string;
    FRETE_TIMEOUT_MS: number;
  }> = env,
): ProvedorCotacaoFrete {
  const validacao = validarConfiguracaoProvedorFrete(config);
  if (validacao.configurado && validacao.provider === 'http_webhook' && config.FRETE_HTTP_ENDPOINT) {
    return new HttpCotacaoFreteProvider({
      endpoint: config.FRETE_HTTP_ENDPOINT,
      apiKey: config.FRETE_HTTP_API_KEY,
      timeoutMs: config.FRETE_TIMEOUT_MS ?? env.FRETE_TIMEOUT_MS,
    });
  }

  return new UnconfiguredCotacaoFreteProvider();
}
