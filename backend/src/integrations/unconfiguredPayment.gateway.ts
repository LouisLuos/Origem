import {
  PAGAMENTO_ERROR_CODES,
  PaymentGatewayError,
  type CriarPagamentoCartaoInput,
  type CriarPagamentoPixInput,
  type PaymentGatewayPort,
  type ResultadoCriacaoPagamentoGateway,
  type StatusPagamentoGatewayConsulta,
  type WebhookEventoNormalizado,
  type WebhookHttpInput,
} from './paymentGateway.contracts.js';

/**
 * Adaptador fail-closed padrão quando nenhum gateway real está configurado no ambiente.
 * Bloqueia criação de pagamentos e processamento de webhooks sem jamais aprovar pedidos simulados.
 */
export class UnconfiguredPaymentGateway implements PaymentGatewayPort {
  public readonly nome = 'disabled';
  public readonly ambiente = 'sandbox' as const;
  public readonly configurado = false;
  public readonly pixMinExpirationSeconds = 60;

  async criarPagamentoPix(_input: CriarPagamentoPixInput): Promise<ResultadoCriacaoPagamentoGateway> {
    throw new PaymentGatewayError(
      'Gateway de pagamento não configurado neste ambiente. Configure PAYMENT_GATEWAY e as credenciais do provedor antes de realizar checkout.',
      {
        codigo: PAGAMENTO_ERROR_CODES.PROVEDOR_PAGAMENTO_NAO_CONFIGURADO,
        statusHttp: 503,
        gateway: this.nome,
        transient: false,
        resultadoDesconhecido: false,
      },
    );
  }

  async criarPagamentoCartao(_input: CriarPagamentoCartaoInput): Promise<ResultadoCriacaoPagamentoGateway> {
    return this.criarPagamentoPix(_input);
  }

  async consultarPagamento(_externalPaymentId: string): Promise<StatusPagamentoGatewayConsulta> {
    throw new PaymentGatewayError(
      'Gateway de pagamento não configurado neste ambiente.',
      {
        codigo: PAGAMENTO_ERROR_CODES.PROVEDOR_PAGAMENTO_NAO_CONFIGURADO,
        statusHttp: 503,
        gateway: this.nome,
        transient: false,
        resultadoDesconhecido: false,
      },
    );
  }

  validarEInterpretarWebhook(input: WebhookHttpInput): WebhookEventoNormalizado {
    return {
      gateway: this.nome,
      assinaturaValida: false,
      motivoAssinaturaInvalida: 'Gateway de pagamento não configurado neste ambiente.',
      resumoPayload: { bodyType: typeof input.body },
    };
  }
}
