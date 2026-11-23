import crypto from 'node:crypto';
import type { StatusPagamento } from './contracts/pagamentoEnums.contracts.js';
import {
  PAGAMENTO_ERROR_CODES,
  PaymentGatewayError,
  compararSegredosTimingSafe,
  executarHttpGatewayJson,
  extrairHeaderSimples,
  normalizarTelefoneBrPartes,
  normalizarUltimosDigitosCartao,
  type AmbienteGateway,
  type CriarPagamentoBaseInput,
  type CriarPagamentoCartaoInput,
  type CriarPagamentoPixInput,
  type PaymentGatewayPort,
  type ResultadoCriacaoPagamentoGateway,
  type StatusPagamentoGatewayConsulta,
  type WebhookEventoNormalizado,
  type WebhookHttpInput,
} from './paymentGateway.contracts.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';

export interface PagarmeV5GatewayConfig {
  readonly baseUrl: string;
  readonly secretKey: string;
  readonly publicKey?: string;
  readonly ambiente: AmbienteGateway;
  readonly timeoutMs: number;
  readonly webhookSecret?: string;
  readonly webhookBasicUser?: string;
  readonly webhookBasicPass?: string;
}

interface PagarmeLastTransaction {
  readonly id?: string;
  readonly status?: string;
  readonly qr_code?: string;
  readonly qr_code_url?: string;
  readonly url?: string;
  readonly expires_at?: string;
  readonly acquirer_message?: string;
  readonly acquirer_return_code?: string;
  readonly card?: {
    readonly brand?: string;
    readonly last_four_digits?: string;
  };
  readonly gateway_response?: {
    readonly code?: string;
    readonly errors?: ReadonlyArray<{ readonly message?: string }>;
  };
}

interface PagarmeCharge {
  readonly id?: string;
  readonly status?: string;
  readonly payment_method?: string;
  readonly metadata?: Record<string, unknown>;
  readonly last_transaction?: PagarmeLastTransaction;
}

interface PagarmeOrderResponse {
  readonly id?: string;
  readonly status?: string;
  readonly message?: string;
  readonly errors?: Record<string, unknown>;
  readonly charges?: readonly PagarmeCharge[];
  readonly metadata?: Record<string, unknown>;
}

function mapearStatusPagarme(statusRaw: string | undefined): StatusPagamento {
  const normalizado = (statusRaw ?? '').trim().toLowerCase();
  if (normalizado === 'paid' || normalizado === 'captured' || normalizado === 'authorized_pending_capture') {
    return normalizado === 'paid' || normalizado === 'captured' ? 'APROVADO' : 'PENDENTE';
  }
  if (normalizado === 'failed' || normalizado === 'not_authorized' || normalizado === 'with_error') {
    return 'RECUSADO';
  }
  if (normalizado === 'canceled' || normalizado === 'voided' || normalizado === 'partial_void') {
    return 'CANCELADO';
  }
  if (normalizado === 'refunded' || normalizado === 'partial_refunded' || normalizado === 'chargedback') {
    return 'ESTORNADO';
  }
  if (normalizado === 'overpaid' || normalizado === 'underpaid') {
    return 'PENDENTE';
  }
  return 'PENDENTE';
}

function extrairMensagemErroPagarme(payload: unknown, statusHttp: number): string {
  const record = payload as PagarmeOrderResponse | null;
  const msg = record?.message;
  if (typeof msg === 'string' && msg.trim().length > 0) {
    return sanitizarErroProvedor(msg);
  }
  const chargeErr = record?.charges?.[0]?.last_transaction?.gateway_response?.errors?.[0]?.message;
  if (typeof chargeErr === 'string' && chargeErr.trim().length > 0) {
    return sanitizarErroProvedor(chargeErr);
  }
  const acq = record?.charges?.[0]?.last_transaction?.acquirer_message;
  if (typeof acq === 'string' && acq.trim().length > 0) {
    return sanitizarErroProvedor(acq);
  }
  return `Pagar.me v5 recusou a operação (HTTP ${statusHttp}).`;
}

function montarPayloadBaseOrder(input: CriarPagamentoBaseInput) {
  const docDigits = input.comprador.cpfCnpj.replace(/\D/g, '');
  const tipoDoc = docDigits.length === 14 ? 'company' : 'individual';
  const telefone = normalizarTelefoneBrPartes(input.comprador.telefone);
  const cepDigits = input.enderecoEntrega.cep.replace(/\D/g, '');
  const line1 = `${input.enderecoEntrega.numero}, ${input.enderecoEntrega.logradouro}, ${input.enderecoEntrega.bairro}`.slice(0, 255);

  return {
    code: input.codigoPedido,
    customer: {
      name: input.comprador.nome.slice(0, 64),
      email: input.comprador.email,
      type: tipoDoc,
      document: docDigits,
      phones: {
        mobile_phone: {
          country_code: '55',
          area_code: telefone.areaCode,
          number: telefone.number,
        },
      },
    },
    items: input.itens.map((item) => ({
      code: item.pecaId,
      amount: item.precoUnitarioCentavos,
      description: item.titulo.slice(0, 250),
      quantity: item.quantidade,
    })),
    shipping: {
      amount: input.valorFreteCentavos,
      description: 'Entrega multi-origem Origem Marketplace',
      recipient_name: input.comprador.nome.slice(0, 64),
      recipient_phone: `55${telefone.areaCode}${telefone.number}`,
      address: {
        country: 'BR',
        state: input.enderecoEntrega.uf.toUpperCase(),
        city: input.enderecoEntrega.cidade.slice(0, 64),
        zip_code: cepDigits,
        line_1: line1,
        ...(input.enderecoEntrega.complemento
          ? { line_2: input.enderecoEntrega.complemento.slice(0, 128) }
          : {}),
      },
    },
    metadata: {
      pedidoId: input.pedidoId,
      pagamentoId: input.pagamentoId,
      reservaGrupoId: input.reservaGrupoId,
      codigoPedido: input.codigoPedido,
    },
  };
}

/**
 * Adaptador oficial para Pagar.me API Core v5 (sandbox/produção).
 * - Pix utiliza `expires_in` inteiro em segundos calculado a partir do `expiraEm` real da reserva HU-06.
 * - Cartão utiliza exclusivamente `card_token` (tokenizado client-side), sem trafegar PAN ou CVV pelo backend.
 * - Observação: a compatibilidade exata de TTLs inferiores a 15 min no provedor externo depende de teste
 *   com credencial real de homologação Pagar.me.
 */
export class PagarmeV5PaymentGateway implements PaymentGatewayPort {
  public readonly nome = 'pagarme_v5';
  public readonly ambiente: AmbienteGateway;
  public readonly configurado = true;
  public readonly pixMinExpirationSeconds = 60;
  private readonly baseUrlLimpa: string;
  private readonly authHeader: string;

  constructor(private readonly config: PagarmeV5GatewayConfig) {
    this.ambiente = config.ambiente;
    this.baseUrlLimpa = config.baseUrl.replace(/\/+$/, '');
    this.authHeader = `Basic ${Buffer.from(`${config.secretKey}:`).toString('base64')}`;
  }

  private headersRequisicao(idempotencyKey?: string): Record<string, string> {
    return {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
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
        `Tempo restante da reserva (${segundosRestantes}s) abaixo do mínimo exigido pelo gateway (${this.pixMinExpirationSeconds}s).`,
        {
          codigo: PAGAMENTO_ERROR_CODES.GATEWAY_EXPIRACAO_INCOMPATIVEL,
          statusHttp: 409,
          gateway: this.nome,
          transient: false,
          resultadoDesconhecido: false,
        },
      );
    }

    const body = {
      ...montarPayloadBaseOrder(input),
      payments: [
        {
          payment_method: 'pix',
          amount: input.valorCentavos,
          pix: {
            expires_in: segundosRestantes,
            additional_information: [
              { name: 'Pedido', value: input.codigoPedido.slice(0, 50) },
            ],
          },
        },
      ],
    };

    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'POST',
      url: `${this.baseUrlLimpa}/orders`,
      headers: this.headersRequisicao(input.idempotencyKey),
      body,
      timeoutMs: this.config.timeoutMs,
    });

    const order = json as PagarmeOrderResponse | null;
    if (status >= 400) {
      throw new PaymentGatewayError(extrairMensagemErroPagarme(json, status), {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_REQUISICAO_INVALIDA,
        statusHttp: 422,
        gateway: this.nome,
        transient: false,
        resultadoDesconhecido: false,
      });
    }

    const charge = order?.charges?.[0];
    const tx = charge?.last_transaction;
    const statusMapeado = mapearStatusPagarme(charge?.status ?? order?.status);
    const externalPaymentId = charge?.id ?? order?.id ?? '';

    if (!externalPaymentId) {
      throw new PaymentGatewayError('Resposta da Pagar.me v5 sem identificador de cobrança.', {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: true,
      });
    }

    const statusCriacao: 'PENDENTE' | 'APROVADO' | 'RECUSADO' =
      statusMapeado === 'APROVADO'
        ? 'APROVADO'
        : statusMapeado === 'RECUSADO' || statusMapeado === 'CANCELADO'
          ? 'RECUSADO'
          : 'PENDENTE';

    return {
      gateway: this.nome,
      ambiente: this.ambiente,
      metodo: 'PIX',
      externalPaymentId,
      status: statusCriacao,
      gatewayStatusRaw: charge?.status ?? order?.status ?? 'pending',
      gatewayStatusDetail: tx?.status,
      pixCopiaECola: typeof tx?.qr_code === 'string' ? tx.qr_code : undefined,
      pixTicketUrl:
        typeof tx?.qr_code_url === 'string'
          ? tx.qr_code_url
          : typeof tx?.url === 'string'
            ? tx.url
            : undefined,
      gatewayExpiraEm:
        typeof tx?.expires_at === 'string' && !Number.isNaN(Date.parse(tx.expires_at))
          ? new Date(tx.expires_at)
          : new Date(agora.getTime() + segundosRestantes * 1000),
      erroSanitizado:
        statusCriacao === 'RECUSADO' ? extrairMensagemErroPagarme(json, status) : undefined,
    };
  }

  async criarPagamentoCartao(input: CriarPagamentoCartaoInput): Promise<ResultadoCriacaoPagamentoGateway> {
    const body = {
      ...montarPayloadBaseOrder(input),
      payments: [
        {
          payment_method: 'credit_card',
          amount: input.valorCentavos,
          credit_card: {
            installments: input.parcelas,
            statement_descriptor: 'ORIGEM PE',
            operation_type: 'auth_and_capture',
            card_token: input.cardToken,
            card: {
              billing_address: {
                country: 'BR',
                state: input.enderecoEntrega.uf.toUpperCase(),
                city: input.enderecoEntrega.cidade.slice(0, 64),
                zip_code: input.enderecoEntrega.cep.replace(/\D/g, ''),
                line_1: `${input.enderecoEntrega.numero}, ${input.enderecoEntrega.logradouro}, ${input.enderecoEntrega.bairro}`.slice(0, 255),
                ...(input.enderecoEntrega.complemento
                  ? { line_2: input.enderecoEntrega.complemento.slice(0, 128) }
                  : {}),
              },
            },
          },
        },
      ],
    };

    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'POST',
      url: `${this.baseUrlLimpa}/orders`,
      headers: this.headersRequisicao(input.idempotencyKey),
      body,
      timeoutMs: this.config.timeoutMs,
    });

    if (status >= 400) {
      throw new PaymentGatewayError(extrairMensagemErroPagarme(json, status), {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_REQUISICAO_INVALIDA,
        statusHttp: 422,
        gateway: this.nome,
        transient: false,
        resultadoDesconhecido: false,
      });
    }

    const order = json as PagarmeOrderResponse | null;
    const charge = order?.charges?.[0];
    const tx = charge?.last_transaction;
    const statusMapeado = mapearStatusPagarme(charge?.status ?? order?.status);
    const externalPaymentId = charge?.id ?? order?.id ?? '';

    if (!externalPaymentId) {
      throw new PaymentGatewayError('Resposta da Pagar.me v5 sem identificador de cobrança.', {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: true,
      });
    }

    const statusCriacao: 'PENDENTE' | 'APROVADO' | 'RECUSADO' =
      statusMapeado === 'APROVADO'
        ? 'APROVADO'
        : statusMapeado === 'RECUSADO' || statusMapeado === 'CANCELADO'
          ? 'RECUSADO'
          : 'PENDENTE';

    return {
      gateway: this.nome,
      ambiente: this.ambiente,
      metodo: 'CARTAO_CREDITO',
      externalPaymentId,
      status: statusCriacao,
      gatewayStatusRaw: charge?.status ?? order?.status ?? 'pending',
      gatewayStatusDetail: tx?.acquirer_return_code ?? tx?.status,
      cartaoBandeira:
        typeof tx?.card?.brand === 'string' && tx.card.brand.trim().length > 0
          ? tx.card.brand.trim().slice(0, 32)
          : input.bandeira?.slice(0, 32),
      cartaoUltimosDigitos:
        normalizarUltimosDigitosCartao(tx?.card?.last_four_digits) ??
        normalizarUltimosDigitosCartao(input.ultimosDigitos),
      erroSanitizado:
        statusCriacao === 'RECUSADO' ? extrairMensagemErroPagarme(json, status) : undefined,
    };
  }

  async consultarPagamento(externalPaymentId: string): Promise<StatusPagamentoGatewayConsulta> {
    const ehOrder = externalPaymentId.startsWith('or_');
    const url = ehOrder
      ? `${this.baseUrlLimpa}/orders/${encodeURIComponent(externalPaymentId)}`
      : `${this.baseUrlLimpa}/charges/${encodeURIComponent(externalPaymentId)}`;

    const { status, json } = await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'GET',
      url,
      headers: this.headersRequisicao(),
      timeoutMs: this.config.timeoutMs,
    });

    if (status === 404) {
      throw new PaymentGatewayError(
        `Cobrança ${externalPaymentId} não encontrada no gateway Pagar.me v5.`,
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
      throw new PaymentGatewayError(extrairMensagemErroPagarme(json, status), {
        codigo: PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        statusHttp: 502,
        gateway: this.nome,
        transient: true,
        resultadoDesconhecido: false,
      });
    }

    const charge = ehOrder
      ? (json as PagarmeOrderResponse | null)?.charges?.[0]
      : (json as PagarmeCharge | null);
    const tx = charge?.last_transaction;
    const statusRaw = charge?.status ?? (json as { status?: string } | null)?.status ?? 'pending';
    const statusNormalizado = mapearStatusPagarme(statusRaw);

    return {
      gateway: this.nome,
      externalPaymentId,
      status: statusNormalizado,
      gatewayStatusRaw: statusRaw,
      gatewayStatusDetail: tx?.acquirer_return_code ?? tx?.status,
      cartaoBandeira: typeof tx?.card?.brand === 'string' ? tx.card.brand.slice(0, 32) : undefined,
      cartaoUltimosDigitos: normalizarUltimosDigitosCartao(tx?.card?.last_four_digits),
      motivoRecusaSanitizado:
        statusNormalizado === 'RECUSADO' ? extrairMensagemErroPagarme(json, status) : undefined,
    };
  }

  async cancelarPagamento(externalPaymentId: string): Promise<void> {
    if (!externalPaymentId.startsWith('ch_')) {
      return;
    }

    await executarHttpGatewayJson({
      gateway: this.nome,
      method: 'DELETE',
      url: `${this.baseUrlLimpa}/charges/${encodeURIComponent(externalPaymentId)}`,
      headers: this.headersRequisicao(),
      timeoutMs: this.config.timeoutMs,
    });
  }

  validarEInterpretarWebhook(input: WebhookHttpInput): WebhookEventoNormalizado {
    const bodyObj = (input.body ?? {}) as {
      readonly id?: unknown;
      readonly type?: unknown;
      readonly data?: {
        readonly id?: unknown;
        readonly status?: unknown;
        readonly metadata?: Record<string, unknown>;
        readonly charges?: readonly PagarmeCharge[];
      };
    };

    const eventoExternoId = typeof bodyObj.id === 'string' ? bodyObj.id.trim() : undefined;
    const tipoEvento = typeof bodyObj.type === 'string' ? bodyObj.type.trim() : undefined;
    const externalPaymentId =
      typeof bodyObj.data?.id === 'string'
        ? bodyObj.data.id.trim()
        : typeof bodyObj.data?.charges?.[0]?.id === 'string'
          ? bodyObj.data.charges[0].id.trim()
          : undefined;

    const metadata = bodyObj.data?.metadata ?? bodyObj.data?.charges?.[0]?.metadata ?? {};
    const pedidoIdMetadata =
      typeof metadata.pedidoId === 'string' ? metadata.pedidoId.trim() : undefined;
    const pagamentoIdMetadata =
      typeof metadata.pagamentoId === 'string' ? metadata.pagamentoId.trim() : undefined;

    const resumoPayload: Record<string, unknown> = {
      eventoExternoId: eventoExternoId ?? null,
      tipoEvento: tipoEvento ?? null,
      externalPaymentId: externalPaymentId ?? null,
      statusRecebido: typeof bodyObj.data?.status === 'string' ? bodyObj.data.status : null,
    };

    const temBasicConfigurado = Boolean(
      this.config.webhookBasicUser && this.config.webhookBasicPass,
    );
    const temHmacConfigurado = Boolean(this.config.webhookSecret);

    if (!temBasicConfigurado && !temHmacConfigurado) {
      return {
        gateway: this.nome,
        assinaturaValida: false,
        motivoAssinaturaInvalida:
          'Segredo de webhook Pagar.me (PAGARME_WEBHOOK_SECRET ou Basic Auth) não configurado.',
        eventoExternoId,
        tipoEvento,
        externalPaymentId,
        pedidoIdMetadata,
        pagamentoIdMetadata,
        resumoPayload,
      };
    }

    let assinaturaValida = false;

    if (temHmacConfigurado && this.config.webhookSecret) {
      const assinaturaHeader =
        extrairHeaderSimples(input.headers, 'x-hub-signature') ??
        extrairHeaderSimples(input.headers, 'x-webhook-signature') ??
        extrairHeaderSimples(input.headers, 'x-pagarme-signature');

      if (assinaturaHeader) {
        const esperadaHex = crypto
          .createHmac('sha256', this.config.webhookSecret)
          .update(input.rawBody)
          .digest('hex');
        const recebidaLimpa = assinaturaHeader.replace(/^sha256=/i, '').toLowerCase();
        assinaturaValida = compararSegredosTimingSafe(recebidaLimpa, esperadaHex);
      }
    }

    if (!assinaturaValida && temBasicConfigurado) {
      const authHeader = extrairHeaderSimples(input.headers, 'authorization');
      if (authHeader && /^Basic\s+/i.test(authHeader)) {
        const token = authHeader.replace(/^Basic\s+/i, '').trim();
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const sep = decoded.indexOf(':');
        if (sep >= 0) {
          const user = decoded.slice(0, sep);
          const pass = decoded.slice(sep + 1);
          assinaturaValida =
            compararSegredosTimingSafe(user, this.config.webhookBasicUser ?? '') &&
            compararSegredosTimingSafe(pass, this.config.webhookBasicPass ?? '');
        }
      }
    }

    const tipoLower = (tipoEvento ?? '').toLowerCase();
    let statusSugerido: StatusPagamento | undefined;
    if (tipoLower === 'charge.paid' || tipoLower === 'order.paid') {
      statusSugerido = 'APROVADO';
    } else if (
      tipoLower === 'charge.payment_failed' ||
      tipoLower === 'order.payment_failed' ||
      tipoLower === 'charge.underpaid'
    ) {
      statusSugerido = 'RECUSADO';
    } else if (tipoLower === 'charge.refunded' || tipoLower === 'charge.chargedback') {
      statusSugerido = 'ESTORNADO';
    } else if (tipoLower === 'order.canceled' || tipoLower === 'charge.canceled') {
      statusSugerido = 'CANCELADO';
    } else if (typeof bodyObj.data?.status === 'string') {
      statusSugerido = mapearStatusPagarme(bodyObj.data.status);
    }

    return {
      gateway: this.nome,
      assinaturaValida,
      motivoAssinaturaInvalida: assinaturaValida
        ? undefined
        : 'Assinatura HMAC ou credencial Basic Auth do webhook Pagar.me inválida.',
      eventoExternoId,
      tipoEvento,
      externalPaymentId,
      pedidoIdMetadata,
      pagamentoIdMetadata,
      statusSugerido,
      resumoPayload,
    };
  }
}
