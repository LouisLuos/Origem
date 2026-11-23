import crypto from 'node:crypto';
import type { StatusPagamento } from './contracts/pagamentoEnums.contracts.js';
import {
  PAGAMENTO_ERROR_CODES,
  PaymentGatewayError,
  compararSegredosTimingSafe,
  executarHttpGatewayJson,
  extrairHeaderSimples,
  normalizarUltimosDigitosCartao,
  type AmbienteGateway,
  type CriarPagamentoCartaoInput,
  type CriarPagamentoPixInput,
  type PaymentGatewayPort,
  type ResultadoCriacaoPagamentoGateway,
  type StatusPagamentoGatewayConsulta,
  type WebhookEventoNormalizado,
  type WebhookHttpInput,
} from './paymentGateway.contracts.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';

export interface HttpSandboxGatewayConfig {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly webhookSecret?: string;
  readonly ambiente: AmbienteGateway;
  readonly timeoutMs: number;
}

interface HttpSandboxResponse {
  readonly externalPaymentId?: string;
  readonly status?: StatusPagamento;
  readonly gatewayStatusRaw?: string;
  readonly gatewayStatusDetail?: string;
  readonly pixCopiaECola?: string;
  readonly pixQrCodeBase64?: string;
  readonly pixTicketUrl?: string;
  readonly gatewayExpiraEm?: string;
  readonly cartaoBandeira?: string;
  readonly cartaoUltimosDigitos?: string;
  readonly erroSanitizado?: string;
  readonly message?: string;
}

/**
 * Adaptador HTTP controlado para testes de integração automatizados (BDD 1–3, TC09)
 * e homologação controlada sem credenciais financeiras reais. Proibido em produção.
 */
export class HttpSandboxPaymentGateway implements PaymentGatewayPort {
  public readonly nome = 'http_sandbox';
  public readonly ambiente: AmbienteGateway;
  public readonly configurado = true;
  public readonly pixMinExpirationSeconds = 1;
  private readonly baseUrlLimpa: string;

  constructor(private readonly config: HttpSandboxGatewayConfig) {
    this.ambiente = config.ambiente;
    this.baseUrlLimpa = config.endpoint.replace(/\/+$/, '');
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    };
  }

  async criarPagamentoPix(input: CriarPagamentoPixInput): Promise<ResultadoCriacaoPagamentoGateway> {
    const agora = input.agora ?? new Date();
    const expiresInSeconds = Math.floor((input.expiraEm.getTime() - agora.getTime()) / 1000);
    if (expiresInSeconds <= 0) {
      throw new PaymentGatewayError('A reserva já expirou antes da geração do Pix.', {
        codigo: PAGAMENTO_ERROR_CODES.RESERVA_EXPIRADA,
        statusHttp: 409,
        gateway: this.nome,
        transient: false,
        resultadoDesconhecido: false,
      });
    }

    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'POST',
      url: `${this.baseUrlLimpa}/pix`,
      headers: this.headers(input.idempotencyKey),
      timeoutMs: this.config.timeoutMs,
      body: {
        pedidoId: input.pedidoId,
        pagamentoId: input.pagamentoId,
        codigoPedido: input.codigoPedido,
        reservaGrupoId: input.reservaGrupoId,
        valorCentavos: input.valorCentavos,
        expiresInSeconds,
        expiraEm: input.expiraEm.toISOString(),
        idempotencyKey: input.idempotencyKey,
        compradorNome: input.comprador.nome,
        compradorEmail: input.comprador.email,
      },
    });

    const data = json as HttpSandboxResponse | null;
    if (status >= 400) {
      throw new PaymentGatewayError(
        sanitizarErroProvedor(data?.message ?? `Gateway controlado retornou HTTP ${status}.`),
        {
          codigo: PAGAMENTO_ERROR_CODES.GATEWAY_REQUISICAO_INVALIDA,
          statusHttp: 422,
          gateway: this.nome,
          transient: false,
          resultadoDesconhecido: false,
        },
      );
    }

    if (!data?.externalPaymentId) {
      throw new PaymentGatewayError('Resposta sem externalPaymentId.', {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: true,
      });
    }

    return {
      gateway: this.nome,
      ambiente: this.ambiente,
      metodo: 'PIX',
      externalPaymentId: data.externalPaymentId,
      status: data.status === 'APROVADO' ? 'APROVADO' : data.status === 'RECUSADO' ? 'RECUSADO' : 'PENDENTE',
      gatewayStatusRaw: data.gatewayStatusRaw ?? 'waiting_payment',
      gatewayStatusDetail: data.gatewayStatusDetail,
      pixCopiaECola: data.pixCopiaECola,
      pixQrCodeBase64: data.pixQrCodeBase64,
      pixTicketUrl: data.pixTicketUrl,
      gatewayExpiraEm:
        data.gatewayExpiraEm && !Number.isNaN(Date.parse(data.gatewayExpiraEm))
          ? new Date(data.gatewayExpiraEm)
          : input.expiraEm,
    };
  }

  async criarPagamentoCartao(input: CriarPagamentoCartaoInput): Promise<ResultadoCriacaoPagamentoGateway> {
    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'POST',
      url: `${this.baseUrlLimpa}/card`,
      headers: this.headers(input.idempotencyKey),
      timeoutMs: this.config.timeoutMs,
      body: {
        pedidoId: input.pedidoId,
        pagamentoId: input.pagamentoId,
        codigoPedido: input.codigoPedido,
        reservaGrupoId: input.reservaGrupoId,
        valorCentavos: input.valorCentavos,
        cardToken: input.cardToken,
        parcelas: input.parcelas,
        bandeira: input.bandeira,
        ultimosDigitos: input.ultimosDigitos,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const data = json as HttpSandboxResponse | null;
    if (status >= 400) {
      throw new PaymentGatewayError(
        sanitizarErroProvedor(data?.message ?? `Gateway controlado retornou HTTP ${status}.`),
        {
          codigo: PAGAMENTO_ERROR_CODES.GATEWAY_REQUISICAO_INVALIDA,
          statusHttp: 422,
          gateway: this.nome,
          transient: false,
          resultadoDesconhecido: false,
        },
      );
    }

    if (!data?.externalPaymentId) {
      throw new PaymentGatewayError('Resposta sem externalPaymentId.', {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: true,
      });
    }

    const statusNorm =
      data.status === 'APROVADO' ? 'APROVADO' : data.status === 'RECUSADO' ? 'RECUSADO' : 'PENDENTE';

    return {
      gateway: this.nome,
      ambiente: this.ambiente,
      metodo: 'CARTAO_CREDITO',
      externalPaymentId: data.externalPaymentId,
      status: statusNorm,
      gatewayStatusRaw: data.gatewayStatusRaw ?? (statusNorm === 'APROVADO' ? 'paid' : statusNorm === 'RECUSADO' ? 'failed' : 'pending'),
      gatewayStatusDetail: data.gatewayStatusDetail,
      cartaoBandeira: data.cartaoBandeira ?? input.bandeira,
      cartaoUltimosDigitos:
        normalizarUltimosDigitosCartao(data.cartaoUltimosDigitos) ??
        normalizarUltimosDigitosCartao(input.ultimosDigitos),
      erroSanitizado: statusNorm === 'RECUSADO' ? sanitizarErroProvedor(data.erroSanitizado ?? 'Transação não autorizada.') : undefined,
    };
  }

  async consultarPagamento(externalPaymentId: string): Promise<StatusPagamentoGatewayConsulta> {
    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'GET',
      url: `${this.baseUrlLimpa}/payments/${encodeURIComponent(externalPaymentId)}`,
      headers: this.headers(),
      timeoutMs: this.config.timeoutMs,
    });

    if (status === 404) {
      throw new PaymentGatewayError(`Pagamento ${externalPaymentId} não localizado.`, {
        codigo: PAGAMENTO_ERROR_CODES.PAGAMENTO_NAO_LOCALIZADO,
        statusHttp: 404,
        gateway: this.nome,
        transient: false,
        resultadoDesconhecido: false,
      });
    }

    if (status >= 400) {
      throw new PaymentGatewayError(`Falha na consulta ao gateway controlado (HTTP ${status}).`, {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: false,
      });
    }

    const data = json as HttpSandboxResponse | null;
    const statusNorm = data?.status ?? 'PENDENTE';
    return {
      gateway: this.nome,
      externalPaymentId,
      status: statusNorm,
      gatewayStatusRaw: data?.gatewayStatusRaw ?? statusNorm.toLowerCase(),
      gatewayStatusDetail: data?.gatewayStatusDetail,
      cartaoBandeira: data?.cartaoBandeira,
      cartaoUltimosDigitos: normalizarUltimosDigitosCartao(data?.cartaoUltimosDigitos),
      motivoRecusaSanitizado:
        statusNorm === 'RECUSADO' ? sanitizarErroProvedor(data?.erroSanitizado ?? 'Recusado') : undefined,
    };
  }

  async cancelarPagamento(externalPaymentId: string): Promise<void> {
    await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'DELETE',
      url: `${this.baseUrlLimpa}/payments/${encodeURIComponent(externalPaymentId)}`,
      headers: this.headers(),
      timeoutMs: this.config.timeoutMs,
    });
  }

  validarEInterpretarWebhook(input: WebhookHttpInput): WebhookEventoNormalizado {
    const bodyObj = (input.body ?? {}) as {
      readonly eventoExternoId?: unknown;
      readonly tipoEvento?: unknown;
      readonly externalPaymentId?: unknown;
      readonly status?: unknown;
      readonly metadata?: {
        readonly pedidoId?: unknown;
        readonly pagamentoId?: unknown;
      };
    };

    const eventoExternoId =
      typeof bodyObj.eventoExternoId === 'string' ? bodyObj.eventoExternoId.trim() : undefined;
    const tipoEvento =
      typeof bodyObj.tipoEvento === 'string' ? bodyObj.tipoEvento.trim() : undefined;
    const externalPaymentId =
      typeof bodyObj.externalPaymentId === 'string' ? bodyObj.externalPaymentId.trim() : undefined;
    const pedidoIdMetadata =
      typeof bodyObj.metadata?.pedidoId === 'string' ? bodyObj.metadata.pedidoId.trim() : undefined;
    const pagamentoIdMetadata =
      typeof bodyObj.metadata?.pagamentoId === 'string'
        ? bodyObj.metadata.pagamentoId.trim()
        : undefined;

    const resumoPayload: Record<string, unknown> = {
      eventoExternoId: eventoExternoId ?? null,
      tipoEvento: tipoEvento ?? null,
      externalPaymentId: externalPaymentId ?? null,
    };

    if (!this.config.webhookSecret) {
      return {
        gateway: this.nome,
        assinaturaValida: false,
        motivoAssinaturaInvalida: 'PAYMENT_HTTP_WEBHOOK_SECRET não configurado.',
        eventoExternoId,
        tipoEvento,
        externalPaymentId,
        pedidoIdMetadata,
        pagamentoIdMetadata,
        resumoPayload,
      };
    }

    const assinaturaHeader = extrairHeaderSimples(input.headers, 'x-origem-signature');
    let assinaturaValida = false;
    if (assinaturaHeader) {
      const esperadaHex = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(input.rawBody)
        .digest('hex');
      const limpa = assinaturaHeader.replace(/^sha256=/i, '').toLowerCase();
      assinaturaValida = compararSegredosTimingSafe(limpa, esperadaHex);
    }

    return {
      gateway: this.nome,
      assinaturaValida,
      motivoAssinaturaInvalida: assinaturaValida ? undefined : 'Assinatura x-origem-signature inválida.',
      eventoExternoId,
      tipoEvento,
      externalPaymentId,
      pedidoIdMetadata,
      pagamentoIdMetadata,
      statusSugerido: typeof bodyObj.status === 'string' ? (bodyObj.status as StatusPagamento) : undefined,
      resumoPayload,
    };
  }
}
