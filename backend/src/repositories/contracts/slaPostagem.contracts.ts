/**
 * Contrato desacoplado de fiscalização de SLA de postagem (HU-13 + HU-17).
 *
 * Como as tabelas `pedidos` (HU-10) e `subpedidos` (HU-12/HU-13) ainda não existem
 * no schema atual do PostgreSQL, a rotina de fiscalização consome esta interface
 * injetável sem fabricar subpedidos fictícios no banco real.
 */
export interface SubpedidoPendentePostagemSla {
  readonly subpedidoId: string;
  readonly pedidoId: string;
  readonly codigoPedido: string;
  readonly atelieId: string;
  readonly atelieNome: string;
  readonly titularUsuarioId: string;
  readonly titularNome: string;
  readonly titularEmail: string;
  readonly titularWhatsapp: string | null;
  readonly consentimentoWhatsappTitular: boolean;
  readonly statusLogistico: 'AGUARDANDO_POSTAGEM';
  readonly codigoRastreio: string | null;
  readonly dataPostagem: Date | null;
  readonly pagamentoAprovadoEm: Date;
  readonly resumoItens: readonly string[];
}

export interface SubpedidoSlaRepository {
  readonly configurado: boolean;
  listarAguardandoPostagem(): Promise<SubpedidoPendentePostagemSla[]>;
}

export const unconfiguredSubpedidoSlaRepository: SubpedidoSlaRepository = {
  configurado: false,
  async listarAguardandoPostagem() {
    return [];
  },
};
