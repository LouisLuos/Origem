import crypto from 'node:crypto';
import type { StatusPagamento } from './contracts/pagamentoEnums.contracts.js';

export type MetodoPagamentoGateway = 'PIX' | 'CARTAO_CREDITO';
export type AmbienteGateway = 'sandbox' | 'production';
export type NomeGatewayPagamento = 'pagarme_v5' | 'mercado_pago' | 'http_sandbox' | 'disabled';

export const PAGAMENTO_ERROR_CODES = {
  PROVEDOR_PAGAMENTO_NAO_CONFIGURADO: 'PROVEDOR_PAGAMENTO_NAO_CONFIGURADO',
  GATEWAY_INDISPONIVEL: 'GATEWAY_INDISPONIVEL',
  GATEWAY_TIMEOUT_RESULTADO_DESCONHECIDO: 'GATEWAY_TIMEOUT_RESULTADO_DESCONHECIDO',
  GATEWAY_REQUISICAO_INVALIDA: 'GATEWAY_REQUISICAO_INVALIDA',
  GATEWAY_EXPIRACAO_INCOMPATIVEL: 'GATEWAY_EXPIRACAO_INCOMPATIVEL',
  WEBHOOK_ASSINATURA_INVALIDA: 'WEBHOOK_ASSINATURA_INVALIDA',
  WEBHOOK_PAYLOAD_INVALIDO: 'WEBHOOK_PAYLOAD_INVALIDO',
  DADOS_SENSIVEIS_CARTAO_PROIBIDOS: 'DADOS_SENSIVEIS_CARTAO_PROIBIDOS',
  RESERVA_EXPIRADA: 'RESERVA_EXPIRADA',
  CONFLITO_IDEMPOTENCIA: 'CONFLITO_IDEMPOTENCIA',
  PEDIDO_ATIVO_EXISTENTE: 'PEDIDO_ATIVO_EXISTENTE',
  PEDIDO_NAO_ENCONTRADO: 'PEDIDO_NAO_ENCONTRADO',
  PAGAMENTO_NAO_LOCALIZADO: 'PAGAMENTO_NAO_LOCALIZADO',
} as const;

export class PaymentGatewayError extends Error {
  public readonly codigo: string;
  public readonly statusHttp: number;
  public readonly gateway: string;
  public readonly transient: boolean;
  public readonly resultadoDesconhecido: boolean;

  constructor(
    message: string,
    options: {
      readonly codigo: string;
      readonly statusHttp: number;
      readonly gateway: string;
      readonly transient: boolean;
      readonly resultadoDesconhecido: boolean;
    },
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
    this.codigo = options.codigo;
    this.statusHttp = options.statusHttp;
    this.gateway = options.gateway;
    this.transient = options.transient;
    this.resultadoDesconhecido = options.resultadoDesconhecido;
    Object.setPrototypeOf(this, PaymentGatewayError.prototype);
  }
}

export interface CompradorGatewayInput {
  readonly usuarioId: string;
  readonly nome: string;
  readonly email: string;
  readonly cpfCnpj: string;
  readonly telefone: string;
}

export interface EnderecoEntregaGatewayInput {
  readonly cep: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento?: string;
  readonly bairro: string;
  readonly cidade: string;
  readonly uf: string;
}

export interface ItemGatewayInput {
  readonly pecaId: string;
  readonly titulo: string;
  readonly quantidade: number;
  readonly precoUnitarioCentavos: number;
}

export interface CriarPagamentoBaseInput {
  readonly pedidoId: string;
  readonly pagamentoId: string;
  readonly codigoPedido: string;
  readonly reservaGrupoId: string;
  readonly idempotencyKey: string;
  readonly valorCentavos: number;
  readonly valorFreteCentavos: number;
  readonly expiraEm: Date;
  readonly agora?: Date;
  readonly comprador: CompradorGatewayInput;
  readonly enderecoEntrega: EnderecoEntregaGatewayInput;
  readonly itens: readonly ItemGatewayInput[];
  readonly webhookUrl?: string;
}

export type CriarPagamentoPixInput = CriarPagamentoBaseInput;

export interface CriarPagamentoCartaoInput extends CriarPagamentoBaseInput {
  /** Token efêmero gerado no frontend (Pagar.me/Mercado Pago); nunca PAN ou CVV. */
  readonly cardToken: string;
  readonly parcelas: number;
  readonly bandeira?: string;
  readonly ultimosDigitos?: string;
}

export interface ResultadoCriacaoPagamentoGateway {
  readonly gateway: string;
  readonly ambiente: AmbienteGateway;
  readonly metodo: MetodoPagamentoGateway;
  readonly externalPaymentId: string;
  readonly status: Extract<StatusPagamento, 'PENDENTE' | 'APROVADO' | 'RECUSADO'>;
  readonly gatewayStatusRaw: string;
  readonly gatewayStatusDetail?: string;
  readonly pixCopiaECola?: string;
  readonly pixQrCodeBase64?: string;
  readonly pixTicketUrl?: string;
  readonly gatewayExpiraEm?: Date;
  readonly cartaoBandeira?: string;
  readonly cartaoUltimosDigitos?: string;
  readonly erroSanitizado?: string;
}

export interface StatusPagamentoGatewayConsulta {
  readonly gateway: string;
  readonly externalPaymentId: string;
  readonly status: StatusPagamento;
  readonly gatewayStatusRaw: string;
  readonly gatewayStatusDetail?: string;
  readonly cartaoBandeira?: string;
  readonly cartaoUltimosDigitos?: string;
  readonly motivoRecusaSanitizado?: string;
}

export interface WebhookHttpInput {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly query: Readonly<Record<string, string | string[] | undefined>>;
  readonly rawBody: Buffer;
  readonly body: unknown;
}

export interface WebhookEventoNormalizado {
  readonly gateway: string;
  readonly assinaturaValida: boolean;
  readonly motivoAssinaturaInvalida?: string;
  readonly eventoExternoId?: string;
  readonly tipoEvento?: string;
  readonly externalPaymentId?: string;
  readonly pedidoIdMetadata?: string;
  readonly pagamentoIdMetadata?: string;
  readonly statusSugerido?: StatusPagamento;
  readonly resumoPayload: Record<string, unknown>;
}

/**
 * Porta desacoplada para provedores de pagamento (Pix e Cartão tokenizado).
 */
export interface PaymentGatewayPort {
  readonly nome: string;
  readonly ambiente: AmbienteGateway;
  readonly configurado: boolean;
  readonly pixMinExpirationSeconds: number;
  criarPagamentoPix(input: CriarPagamentoPixInput): Promise<ResultadoCriacaoPagamentoGateway>;
  criarPagamentoCartao(input: CriarPagamentoCartaoInput): Promise<ResultadoCriacaoPagamentoGateway>;
  consultarPagamento(externalPaymentId: string): Promise<StatusPagamentoGatewayConsulta>;
  cancelarPagamento?(externalPaymentId: string): Promise<void>;
  validarEInterpretarWebhook(input: WebhookHttpInput): WebhookEventoNormalizado;
}

export function compararSegredosTimingSafe(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function extrairHeaderSimples(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  nome: string,
): string | undefined {
  const valor = headers[nome.toLowerCase()] ?? headers[nome];
  if (typeof valor === 'string') {
    const trimmed = valor.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(valor) && typeof valor[0] === 'string') {
    const trimmed = valor[0].trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export async function executarHttpGatewayJson(params: {
  readonly gateway: string;
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly timeoutMs: number;
}): Promise<{ readonly status: number; readonly json: unknown }> {
  let response: Response;
  const mutating = params.method === 'POST' || params.method === 'DELETE';

  try {
    response = await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
      signal: AbortSignal.timeout(params.timeoutMs),
    });
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new PaymentGatewayError(
      isTimeout
        ? `Tempo limite excedido na comunicação com ${params.gateway}.`
        : `Falha de rede ao comunicar com ${params.gateway}.`,
      {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_TIMEOUT_RESULTADO_DESCONHECIDO,
        statusHttp: isTimeout ? 504 : 503,
        gateway: params.gateway,
        transient: true,
        resultadoDesconhecido: mutating,
      },
    );
  }

  let json: unknown = null;
  const text = await response.text().catch(() => '');
  if (text.trim().length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (response.status >= 500 || response.status === 429) {
    throw new PaymentGatewayError(
      `Gateway ${params.gateway} indisponível temporariamente (HTTP ${response.status}).`,
      {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 503,
        gateway: params.gateway,
        transient: true,
        resultadoDesconhecido: mutating,
      },
    );
  }

  return { status: response.status, json };
}

export function normalizarTelefoneBrPartes(telefone: string): {
  readonly areaCode: string;
  readonly number: string;
} {
  let digits = telefone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  const areaCode = digits.length >= 2 ? digits.slice(0, 2) : '81';
  const number = digits.length >= 10 ? digits.slice(2, 11) : '999999999';
  return { areaCode, number };
}

export function normalizarUltimosDigitosCartao(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const digits = valor.replace(/\D/g, '');
  return /^\d{4}$/.test(digits) ? digits : undefined;
}
