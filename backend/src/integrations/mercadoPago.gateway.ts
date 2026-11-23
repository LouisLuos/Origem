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
import { centavosParaNumero } from '../utils/dinheiro.util.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';

export interface MercadoPagoGatewayConfig {
  readonly baseUrl: string;
  readonly accessToken: string;
  readonly ambiente: AmbienteGateway;
  readonly timeoutMs: number;
  readonly webhookSecret?: string;
}

interface MercadoPagoPaymentResponse {
  readonly id?: number | string;
  readonly status?: string;
  readonly status_detail?: string;
  readonly message?: string;
  readonly date_of_expiration?: string;
  readonly card?: {
    readonly last_four_digits?: string;
  };
  readonly payment_method_id?: string;
  readonly point_of_interaction?: {
    readonly transaction_data?: {
      readonly qr_code?: string;
      readonly qr_code_base64?: string;
      readonly ticket_url?: string;
    };
  };
}

function mapearStatusMercadoPago(statusRaw: string | undefined): StatusPagamento {
  const normalizado = (statusRaw ?? '').trim().toLowerCase();
  if (normalizado === 'approved' || normalizado === 'accredited') {
    return 'APROVADO';
  }
  if (normalizado === 'rejected') {
    return 'RECUSADO';
  }
  if (normalizado === 'cancelled') {
    return 'CANCELADO';
  }
  if (normalizado === 'refunded' || normalizado === 'charged_back') {
    return 'ESTORNADO';
  }
  return 'PENDENTE';
}

/**
 * Adaptador secundário real para Mercado Pago `/v1/payments`.
 * Exige expiração Pix mínima de 30 minutos (1800s), conforme limite oficial da API,
 * bloqueando criações de Pix quando o TTL remanescente da reserva HU-06 for inferior.
 */
export class MercadoPagoPaymentGateway implements PaymentGatewayPort {
  public readonly nome = 'mercado_pago';
  public readonly ambiente: AmbienteGateway;
  public readonly configurado = true;
  public readonly pixMinExpirationSeconds = 1800;
  private readonly baseUrlLimpa: string;

  constructor(private readonly config: MercadoPagoGatewayConfig) {
    this.ambiente = config.ambiente;
    this.baseUrlLimpa = config.baseUrl.replace(/\/+$/, '');
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    };
  }

  async criarPagamentoPix(input: CriarPagamentoPixInput): Promise<ResultadoCriacaoPagamentoGateway> {
    const agora = input.agora ?? new Date();
    const segundosRestantes = Math.floor((input.expiraEm.getTime() - agora.getTime()) / 1000);
    if (segundosRestantes <= 0) {
      throw new PaymentGatewayError('A reserva já expirou antes da geração do Pix.', {
        codigo: PAGAMENTO_ERROR_CODES.RESERVA_EXPIRADA,
        statusHttp: 409,
        gateway: this.nome,
        transient: false,
        resultadoDesconhecido: false,
      });
    }

    if (segundosRestantes < this.pixMinExpirationSeconds) {
      throw new PaymentGatewayError(
        `Mercado Pago exige expiração mínima de ${this.pixMinExpirationSeconds}s (30 min) para Pix, incompatível com a reserva restante (${segundosRestantes}s). Utilize Pagar.me v5 ou ajuste a política de reserva.`,
        {
          codigo: PAGAMENTO_ERROR_CODES.GATEWAY_EXPIRACAO_INCOMPATIVEL,
          statusHttp: 422,
          gateway: this.nome,
          transient: false,
          resultadoDesconhecido: false,
        },
      );
    }

    const docDigits = input.comprador.cpfCnpj.replace(/\D/g, '');
    const nomePartes = input.comprador.nome.trim().split(/\s+/);
    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'POST',
      url: `${this.baseUrlLimpa}/v1/payments`,
      headers: this.headers(input.idempotencyKey),
      timeoutMs: this.config.timeoutMs,
      body: {
        transaction_amount: centavosParaNumero(input.valorCentavos),
        description: `Pedido Origem ${input.codigoPedido}`,
        payment_method_id: 'pix',
        external_reference: input.pedidoId,
        date_of_expiration: input.expiraEm.toISOString(),
        notification_url: input.webhookUrl,
        payer: {
          email: input.comprador.email,
          first_name: nomePartes[0] ?? input.comprador.nome,
          last_name: nomePartes.slice(1).join(' ') || 'Origem',
          identification: {
            type: docDigits.length === 14 ? 'CNPJ' : 'CPF',
            number: docDigits,
          },
        },
        metadata: {
          pedido_id: input.pedidoId,
          pagamento_id: input.pagamentoId,
          reserva_grupo_id: input.reservaGrupoId,
        },
      },
    });

    const mp = json as MercadoPagoPaymentResponse | null;
    if (status >= 400) {
      throw new PaymentGatewayError(
        sanitizarErroProvedor(mp?.message ?? `Mercado Pago retornou HTTP ${status}.`),
        {
          codigo: PAGAMENTO_ERROR_CODES.GATEWAY_REQUISICAO_INVALIDA,
          statusHttp: 422,
          gateway: this.nome,
          transient: false,
          resultadoDesconhecido: false,
        },
      );
    }

    const externalPaymentId = mp?.id !== undefined ? String(mp.id) : '';
    if (!externalPaymentId) {
      throw new PaymentGatewayError('Mercado Pago não retornou identificador de pagamento.', {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: true,
      });
    }

    const txData = mp?.point_of_interaction?.transaction_data;
    const statusNorm = mapearStatusMercadoPago(mp?.status);
    const statusCriacao =
      statusNorm === 'APROVADO'
        ? 'APROVADO'
        : statusNorm === 'RECUSADO' || statusNorm === 'CANCELADO'
          ? 'RECUSADO'
          : 'PENDENTE';

    return {
      gateway: this.nome,
      ambiente: this.ambiente,
      metodo: 'PIX',
      externalPaymentId,
      status: statusCriacao,
      gatewayStatusRaw: mp?.status ?? 'pending',
      gatewayStatusDetail: mp?.status_detail,
      pixCopiaECola: txData?.qr_code,
      pixQrCodeBase64: txData?.qr_code_base64,
      pixTicketUrl: txData?.ticket_url,
      gatewayExpiraEm:
        typeof mp?.date_of_expiration === 'string' && !Number.isNaN(Date.parse(mp.date_of_expiration))
          ? new Date(mp.date_of_expiration)
          : input.expiraEm,
    };
  }

  async criarPagamentoCartao(input: CriarPagamentoCartaoInput): Promise<ResultadoCriacaoPagamentoGateway> {
    const docDigits = input.comprador.cpfCnpj.replace(/\D/g, '');
    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'POST',
      url: `${this.baseUrlLimpa}/v1/payments`,
      headers: this.headers(input.idempotencyKey),
      timeoutMs: this.config.timeoutMs,
      body: {
        transaction_amount: centavosParaNumero(input.valorCentavos),
        token: input.cardToken,
        description: `Pedido Origem ${input.codigoPedido}`,
        installments: input.parcelas,
        external_reference: input.pedidoId,
        notification_url: input.webhookUrl,
        payer: {
          email: input.comprador.email,
          identification: {
            type: docDigits.length === 14 ? 'CNPJ' : 'CPF',
            number: docDigits,
          },
        },
        metadata: {
          pedido_id: input.pedidoId,
          pagamento_id: input.pagamentoId,
          reserva_grupo_id: input.reservaGrupoId,
        },
      },
    });

    const mp = json as MercadoPagoPaymentResponse | null;
    if (status >= 400) {
      throw new PaymentGatewayError(
        sanitizarErroProvedor(mp?.message ?? `Mercado Pago retornou HTTP ${status}.`),
        {
          codigo: PAGAMENTO_ERROR_CODES.GATEWAY_REQUISICAO_INVALIDA,
          statusHttp: 422,
          gateway: this.nome,
          transient: false,
          resultadoDesconhecido: false,
        },
      );
    }

    const externalPaymentId = mp?.id !== undefined ? String(mp.id) : '';
    if (!externalPaymentId) {
      throw new PaymentGatewayError('Mercado Pago não retornou identificador de pagamento.', {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: true,
      });
    }

    const statusNorm = mapearStatusMercadoPago(mp?.status);
    const statusCriacao =
      statusNorm === 'APROVADO'
        ? 'APROVADO'
        : statusNorm === 'RECUSADO' || statusNorm === 'CANCELADO'
          ? 'RECUSADO'
          : 'PENDENTE';

    return {
      gateway: this.nome,
      ambiente: this.ambiente,
      metodo: 'CARTAO_CREDITO',
      externalPaymentId,
      status: statusCriacao,
      gatewayStatusRaw: mp?.status ?? 'pending',
      gatewayStatusDetail: mp?.status_detail,
      cartaoBandeira: mp?.payment_method_id?.slice(0, 32) ?? input.bandeira?.slice(0, 32),
      cartaoUltimosDigitos:
        normalizarUltimosDigitosCartao(mp?.card?.last_four_digits) ??
        normalizarUltimosDigitosCartao(input.ultimosDigitos),
      erroSanitizado:
        statusCriacao === 'RECUSADO'
          ? sanitizarErroProvedor(mp?.status_detail ?? 'Pagamento recusado no cartão.')
          : undefined,
    };
  }

  async consultarPagamento(externalPaymentId: string): Promise<StatusPagamentoGatewayConsulta> {
    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'GET',
      url: `${this.baseUrlLimpa}/v1/payments/${encodeURIComponent(externalPaymentId)}`,
      headers: this.headers(),
      timeoutMs: this.config.timeoutMs,
    });

    if (status === 404) {
      throw new PaymentGatewayError(
        `Pagamento ${externalPaymentId} não encontrado no Mercado Pago.`,
        {
          codigo: PAGAMENTO_ERROR_CODES.PAGAMENTO_NAO_LOCALIZADO,
          statusHttp: 404,
          gateway: this.nome,
          transient: false,
          resultadoDesconhecido: false,
        },
      );
    }

    if (status >= 400) {
      throw new PaymentGatewayError(`Falha ao consultar pagamento no Mercado Pago (HTTP ${status}).`, {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: false,
      });
    }

    const mp = json as MercadoPagoPaymentResponse | null;
    const statusNorm = mapearStatusMercadoPago(mp?.status);
    return {
      gateway: this.nome,
      externalPaymentId,
      status: statusNorm,
      gatewayStatusRaw: mp?.status ?? 'pending',
      gatewayStatusDetail: mp?.status_detail,
      cartaoBandeira: mp?.payment_method_id?.slice(0, 32),
      cartaoUltimosDigitos: normalizarUltimosDigitosCartao(mp?.card?.last_four_digits),
      motivoRecusaSanitizado:
        statusNorm === 'RECUSADO'
          ? sanitizarErroProvedor(mp?.status_detail ?? 'Pagamento recusado.')
          : undefined,
    };
  }

  validarEInterpretarWebhook(input: WebhookHttpInput): WebhookEventoNormalizado {
    const bodyObj = (input.body ?? {}) as {
      readonly id?: unknown;
      readonly action?: unknown;
      readonly type?: unknown;
      readonly data?: { readonly id?: unknown };
    };

    const dataId =
      typeof input.query['data.id'] === 'string'
        ? input.query['data.id']
        : typeof bodyObj.data?.id === 'string' || typeof bodyObj.data?.id === 'number'
          ? String(bodyObj.data.id)
          : undefined;
    const eventoExternoId =
      typeof bodyObj.id === 'string' || typeof bodyObj.id === 'number'
        ? `${String(bodyObj.id)}:${String(bodyObj.action ?? bodyObj.type ?? 'event')}`
        : undefined;
    const tipoEvento =
      typeof bodyObj.action === 'string'
        ? bodyObj.action
        : typeof bodyObj.type === 'string'
          ? bodyObj.type
          : undefined;

    const resumoPayload: Record<string, unknown> = {
      eventoExternoId: eventoExternoId ?? null,
      tipoEvento: tipoEvento ?? null,
      externalPaymentId: dataId ?? null,
    };

    if (!this.config.webhookSecret) {
      return {
        gateway: this.nome,
        assinaturaValida: false,
        motivoAssinaturaInvalida: 'MP_WEBHOOK_SECRET não configurado.',
        eventoExternoId,
        tipoEvento,
        externalPaymentId: dataId,
        resumoPayload,
      };
    }

    const xSignature = extrairHeaderSimples(input.headers, 'x-signature');
    const xRequestId = extrairHeaderSimples(input.headers, 'x-request-id');

    let ts: string | undefined;
    let v1: string | undefined;
    if (xSignature) {
      for (const parte of xSignature.split(',')) {
        const [k, v] = parte.split('=').map((s) => s.trim());
        if (k === 'ts' && v) ts = v;
        if (k === 'v1' && v) v1 = v;
      }
    }

    let assinaturaValida = false;
    if (ts && v1 && dataId) {
      const partesManifest: string[] = [`id:${dataId}`];
      if (xRequestId) partesManifest.push(`request-id:${xRequestId}`);
      partesManifest.push(`ts:${ts}`);
      const manifest = `${partesManifest.join(';')};`;

      const esperado = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(manifest)
        .digest('hex');
      assinaturaValida = compararSegredosTimingSafe(v1.toLowerCase(), esperado);
    }

    return {
      gateway: this.nome,
      assinaturaValida,
      motivoAssinaturaInvalida: assinaturaValida ? undefined : 'Assinatura x-signature inválida.',
      eventoExternoId,
      tipoEvento,
      externalPaymentId: dataId,
      resumoPayload,
    };
  }
}
