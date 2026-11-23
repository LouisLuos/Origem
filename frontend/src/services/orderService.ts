import { apiRequest } from './api'

export type PaymentMethod = 'PIX' | 'CARTAO_CREDITO'

export type OrderStatus =
  | 'PENDENTE_PAGAMENTO'
  | 'APROVADO'
  | 'RECUSADO'
  | 'EXPIRADO'
  | 'CANCELADO'
  | 'RECONCILIACAO_ESTORNO'

export type PaymentStatus =
  | 'CRIADO'
  | 'PENDENTE'
  | 'APROVADO'
  | 'RECUSADO'
  | 'EXPIRADO'
  | 'CANCELADO'
  | 'ESTORNADO'
  | 'ERRO_COMUNICACAO'

export const paymentLabels: Record<PaymentMethod, string> = {
  PIX: 'Pix',
  CARTAO_CREDITO: 'Cartão de crédito',
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDENTE_PAGAMENTO: 'Aguardando pagamento',
  APROVADO: 'Pagamento aprovado',
  RECUSADO: 'Pagamento recusado',
  EXPIRADO: 'Reserva / Pix expirado',
  CANCELADO: 'Cancelado',
  RECONCILIACAO_ESTORNO: 'Em reconciliação / estorno',
}

export interface ShippingOriginQuote {
  readonly atelieId: string
  readonly atelieNome: string
  readonly poloCultural: string
  readonly cepOrigem: string
  readonly totalItens: number
  readonly valorBrl: number
  readonly prazoEstimadoDias: number
}

export interface CheckoutShippingQuote {
  readonly reservaGrupoId: string
  readonly expiraEm: string
  readonly cepDestino: string
  readonly valorTotalPecas: number
  readonly valorTotalFrete: number
  readonly valorTotalPedido: number
  readonly fretesPorOrigem: readonly ShippingOriginQuote[]
}

export interface OrderCustomer {
  readonly nomeDestinatario: string
  readonly email: string
  readonly telefone: string
  readonly cep: string
  readonly logradouro: string
  readonly numero: string
  readonly complemento?: string
  readonly bairro: string
  readonly cidade: string
  readonly uf: string
}

export interface OrderLine {
  readonly pecaId: string
  readonly titulo: string
  readonly atelieId: string
  readonly atelieNome: string
  readonly poloCultural: string
  readonly fotoPrincipalUrl: string | null
  readonly quantidade: number
  readonly precoUnitario: number
  readonly subtotalItem: number
  readonly isFragil: boolean
}

export interface PaymentDetails {
  readonly id: string
  readonly pedidoId: string
  readonly gateway: string
  readonly ambiente: string
  readonly metodo: PaymentMethod
  readonly status: PaymentStatus
  readonly valor: number
  readonly externalPaymentId: string | null
  readonly gatewayStatusRaw: string | null
  readonly gatewayStatusDetail: string | null
  readonly expiraEm: string | null
  readonly gatewayExpiraEm: string | null
  readonly pixCopiaECola: string | null
  readonly pixQrCodeBase64: string | null
  readonly pixTicketUrl: string | null
  readonly cartaoBandeira: string | null
  readonly cartaoUltimosDigitos: string | null
  readonly parcelas: number
  readonly erroSanitizado: string | null
  readonly criadoEm: string
  readonly aprovadoEm: string | null
  readonly recusadoEm: string | null
}

export interface Order {
  readonly id: string
  readonly codigoPedido: string
  readonly usuarioId: string
  readonly reservaGrupoId: string
  readonly status: OrderStatus
  readonly metodoPagamento: PaymentMethod
  readonly valorTotalPecas: number
  readonly valorTotalFrete: number
  readonly valorTotalPedido: number
  readonly enderecoEntrega: OrderCustomer
  readonly fretesPorOrigem: readonly ShippingOriginQuote[]
  readonly itens: readonly OrderLine[]
  readonly subpedidosGerados: boolean
  readonly reconciliacaoMotivo: string | null
  readonly criadoEm: string
  readonly pagoEm: string | null
  readonly canceladoEm: string | null
  readonly pagamentoAtual: PaymentDetails | null
}

export interface TokenizedCardInput {
  readonly token: string
  readonly parcelas: number
  readonly bandeira?: string
  readonly ultimosDigitos?: string
}

export interface CreateCheckoutInput {
  readonly reservaGrupoId: string
  readonly metodoPagamento: PaymentMethod
  readonly enderecoEntrega: OrderCustomer
  readonly cartao?: TokenizedCardInput
}

export interface CheckoutResponse {
  readonly idempotente: boolean
  readonly pedido: Order
}

/** Serviço real de pedidos, cotações multi-origem e captura de pagamentos (HU-10). */
export const orderService = {
  async quoteShipping(reservaGrupoId: string, cepDestino: string): Promise<CheckoutShippingQuote> {
    return apiRequest<CheckoutShippingQuote>(
      '/pedidos/cotar-frete',
      {
        method: 'POST',
        body: JSON.stringify({ reservaGrupoId, cepDestino }),
      },
      'Não foi possível calcular o frete multi-origem.',
    )
  },

  async checkout(data: CreateCheckoutInput, idempotencyKey: string): Promise<CheckoutResponse> {
    return apiRequest<CheckoutResponse>(
      '/pedidos/checkout',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(data),
      },
      'Não foi possível iniciar o pagamento do pedido.',
    )
  },

  async listMyOrders(): Promise<Order[]> {
    const response = await apiRequest<{ dados: Order[] }>(
      '/pedidos/meus',
      undefined,
      'Não foi possível carregar seus pedidos.',
    )
    return response.dados
  },

  async getById(pedidoIdOuCodigo: string): Promise<Order> {
    const response = await apiRequest<{ pedido: Order }>(
      `/pedidos/${encodeURIComponent(pedidoIdOuCodigo)}`,
      undefined,
      'Não foi possível consultar o pedido.',
    )
    return response.pedido
  },
}
