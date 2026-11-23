import type {
  MetodoPagamento,
  StatusPagamento,
  StatusPedido,
} from '../../integrations/contracts/pagamentoEnums.contracts.js';
import type { CotacaoFretePorOrigem } from './frete.contracts.js';

export type { MetodoPagamento, StatusPagamento, StatusPedido };

export interface EnderecoEntregaSnapshot {
  readonly nomeDestinatario: string;
  readonly email: string;
  readonly telefone: string;
  readonly cep: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento?: string;
  readonly bairro: string;
  readonly cidade: string;
  readonly uf: string;
}

export interface ItemPedidoSnapshot {
  readonly pecaId: string;
  readonly titulo: string;
  readonly atelieId: string;
  readonly atelieNome: string;
  readonly poloCultural: string;
  readonly fotoPrincipalUrl: string | null;
  readonly quantidade: number;
  readonly precoUnitario: number;
  readonly subtotalItem: number;
  readonly isFragil: boolean;
}

export interface PagamentoDetalhado {
  readonly id: string;
  readonly pedidoId: string;
  readonly gateway: string;
  readonly ambiente: string;
  readonly metodo: MetodoPagamento;
  readonly status: StatusPagamento;
  readonly valor: number;
  readonly externalPaymentId: string | null;
  readonly gatewayStatusRaw: string | null;
  readonly gatewayStatusDetail: string | null;
  readonly expiraEm: string | null;
  readonly gatewayExpiraEm: string | null;
  readonly pixCopiaECola: string | null;
  readonly pixQrCodeBase64: string | null;
  readonly pixTicketUrl: string | null;
  readonly cartaoBandeira: string | null;
  readonly cartaoUltimosDigitos: string | null;
  readonly parcelas: number;
  readonly erroSanitizado: string | null;
  readonly criadoEm: string;
  readonly aprovadoEm: string | null;
  readonly recusadoEm: string | null;
}

export interface PedidoDetalhado {
  readonly id: string;
  readonly codigoPedido: string;
  readonly usuarioId: string;
  readonly reservaGrupoId: string;
  readonly status: StatusPedido;
  readonly metodoPagamento: MetodoPagamento;
  readonly valorTotalPecas: number;
  readonly valorTotalFrete: number;
  readonly valorTotalPedido: number;
  readonly enderecoEntrega: EnderecoEntregaSnapshot;
  readonly fretesPorOrigem: readonly CotacaoFretePorOrigem[];
  readonly itens: readonly ItemPedidoSnapshot[];
  readonly subpedidosGerados: boolean;
  readonly reconciliacaoMotivo: string | null;
  readonly criadoEm: string;
  readonly pagoEm: string | null;
  readonly canceladoEm: string | null;
  readonly pagamentoAtual: PagamentoDetalhado | null;
}

export interface CheckoutResultado {
  readonly idempotente: boolean;
  readonly pedido: PedidoDetalhado;
}

export interface ProcessamentoWebhookResultado {
  readonly recebido: boolean;
  readonly duplicado: boolean;
  readonly gateway: string;
  readonly eventoExternoId: string;
  readonly tipoEvento: string;
  readonly statusProcessamento: 'PROCESSADO' | 'IGNORADO_DUPLICADO';
  readonly pedidoId?: string;
  readonly statusPedidoFinal?: StatusPedido;
  readonly statusPagamentoFinal?: StatusPagamento;
  readonly acao: string;
  readonly outboxRegistrado: boolean;
}

/**
 * Regras estritas anti-regressão da máquina de estados financeira da HU-10:
 * Um pedido ou pagamento já aprovado/reconciliado NUNCA pode regredir para PENDENTE ou RECUSADO.
 */
export function podeTransicionarStatusPedido(
  atual: StatusPedido,
  destino: StatusPedido,
): boolean {
  if (atual === destino) return true;

  if (atual === 'APROVADO' || atual === 'RECONCILIACAO_ESTORNO') {
    return false;
  }

  if (atual === 'RECUSADO' || atual === 'EXPIRADO' || atual === 'CANCELADO') {
    // Caso pagamento tardio chegue após expiração/cancelamento, só pode seguir para RECONCILIACAO_ESTORNO
    return destino === 'RECONCILIACAO_ESTORNO';
  }

  // PENDENTE_PAGAMENTO pode evoluir para qualquer desfecho
  return true;
}

export function podeTransicionarStatusPagamento(
  atual: StatusPagamento,
  destino: StatusPagamento,
): boolean {
  if (atual === destino) return true;

  if (atual === 'APROVADO') {
    return destino === 'ESTORNADO';
  }

  if (atual === 'ESTORNADO') {
    return false;
  }

  if (atual === 'RECUSADO' || atual === 'EXPIRADO' || atual === 'CANCELADO') {
    // Nunca regride para CRIADO/PENDENTE; apenas aprovação tardia (para reconciliação) é registrável
    return destino === 'APROVADO';
  }

  // CRIADO, PENDENTE, ERRO_COMUNICACAO
  return true;
}
