import type { CotacaoFretePorOrigem } from './frete.contracts.js';
import type { ItemPedidoSnapshot } from './pedidosPagamentos.contracts.js';

/**
 * Contrato de integração futura com a HU-12 (Subpedidos por Ateliê / Split de Expedição).
 * Este arquivo define apenas a porta desacoplada consumida após `pedidos.status = 'APROVADO'`,
 * preservando a restrição de escopo de NÃO criar a tabela `subpedidos` na HU-10.
 */
export interface PedidoAprovadoParaDesmembramento {
  readonly pedidoId: string;
  readonly codigoPedido: string;
  readonly usuarioId: string;
  readonly pagoEm: Date;
  readonly itens: readonly ItemPedidoSnapshot[];
  readonly fretesPorOrigem: readonly CotacaoFretePorOrigem[];
}

export interface SubpedidoDesmembradoResumo {
  readonly subpedidoId: string;
  readonly atelieId: string;
}

export interface SubpedidoDesmembramentoPort {
  gerarSubpedidosNaTransacao(
    tx: unknown,
    pedido: PedidoAprovadoParaDesmembramento,
  ): Promise<readonly SubpedidoDesmembradoResumo[]>;
}
