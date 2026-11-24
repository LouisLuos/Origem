/**
 * Contrato desacoplado de Outbox Transacional para integração futura com a HU-10 (`pedidos` / webhook
 * de pagamento aprovado) e HU-12 (`subpedidos`).
 *
 * Estratégia recomendada para eliminar perda de eventos entre PostgreSQL e Redis:
 * 1. Na transação ACID em que a HU-10 marca `pedidos.status = 'APROVADO'`, gera `subpedidos` (HU-12)
 *    e confirma as reservas da HU-06, gravar o evento `PagamentoAprovado` em uma tabela de outbox
 *    dentro do mesmo `BEGIN ... COMMIT` (ex.: `outbox_eventos_notificacao`).
 * 2. Após o commit, um relay desacoplado (`NotificacaoOutboxRelay`) lê eventos pendentes e chama
 *    `notificacaoEventosService.publicarPagamentoAprovado(...)`, marcando o evento como publicado.
 * 3. Caso o Redis esteja temporariamente indisponível no instante do webhook, a transação do pedido
 *    NÃO falha e o relay reprocessa o evento pendente de forma idempotente posteriormente (RNF-12).
 */
export type TipoEventoOutboxNotificacao = 'PagamentoAprovado' | 'AtualizacaoStatusPedido';

export interface OutboxEventoNotificacao<TPayload = unknown> {
  readonly id: string;
  readonly tipoEvento: TipoEventoOutboxNotificacao;
  readonly aggregateId: string;
  readonly idempotencyKey: string;
  readonly payload: TPayload;
  readonly publicadoEm: Date | null;
  readonly tentativasPublicacao: number;
  readonly criadoEm: Date;
}

export interface RegistrarOutboxEventoInput<TPayload = unknown> {
  readonly tipoEvento: TipoEventoOutboxNotificacao;
  readonly aggregateId: string;
  readonly idempotencyKey: string;
  readonly payload: TPayload;
}

export interface NotificacaoOutboxRepository {
  registrarNaMesmaTransacao(tx: unknown, evento: RegistrarOutboxEventoInput): Promise<void>;
  listarPendentes(limite?: number): Promise<OutboxEventoNotificacao[]>;
  marcarPublicado(id: string, publicadoEm?: Date): Promise<void>;
  registrarFalhaPublicacao(id: string, erroSanitizado: string): Promise<void>;
}

export interface NotificacaoOutboxRelay {
  processarPendentes(limite?: number): Promise<{
    readonly lidos: number;
    readonly publicados: number;
    readonly falhas: number;
  }>;
}
