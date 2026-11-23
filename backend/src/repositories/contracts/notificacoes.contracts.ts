export type CanalNotificacao = 'EMAIL' | 'WHATSAPP';

export type StatusNotificacao =
  | 'ENFILEIRADA'
  | 'PROCESSANDO'
  | 'ENVIADA'
  | 'FALHA_TRANSITORIA'
  | 'FALHA_PERMANENTE'
  | 'IGNORADA';

export type TemplateNotificacaoId =
  | 'PAGAMENTO_APROVADO_COMPRADOR'
  | 'NOVA_ENCOMENDA_ATELIE'
  | 'ALERTA_SLA_POSTAGEM_DIA5'
  | 'ATUALIZACAO_STATUS_PEDIDO'
  | 'RECUPERACAO_SENHA';

export interface LogNotificacaoPersistido {
  readonly id: string;
  readonly eventoOrigem: string;
  readonly pedidoId: string | null;
  readonly subpedidoId: string | null;
  readonly usuarioId: string | null;
  readonly atelieId: string | null;
  readonly destinatario: string;
  readonly canal: CanalNotificacao;
  readonly template: string;
  readonly status: StatusNotificacao;
  readonly tentativas: number;
  readonly maxTentativas: number;
  readonly provedor: string | null;
  readonly provedorMensagemId: string | null;
  readonly erroCodigo: string | null;
  readonly erroSanitizado: string | null;
  readonly idempotencyKey: string;
  readonly jobId: string | null;
  readonly correlationId: string | null;
  readonly criadoEm: Date;
  readonly ultimaTentativaEm: Date | null;
  readonly proximaTentativaEm: Date | null;
  readonly enviadoEm: Date | null;
  readonly atualizadoEm: Date;
}

export interface GarantirLogNotificacaoInput {
  readonly eventoOrigem: string;
  readonly pedidoId?: string | null;
  readonly subpedidoId?: string | null;
  readonly usuarioId?: string | null;
  readonly atelieId?: string | null;
  /** Deve ser previamente mascarado via `mascararDestinatario`. */
  readonly destinatarioMascarado: string;
  readonly canal: CanalNotificacao;
  readonly template: TemplateNotificacaoId | string;
  readonly maxTentativas: number;
  readonly idempotencyKey: string;
  readonly correlationId?: string | null;
  readonly statusInicial?: 'ENFILEIRADA' | 'IGNORADA';
  readonly motivoIgnoradaCodigo?: string | null;
  readonly motivoIgnoradaSanitizado?: string | null;
}

export interface GarantirLogNotificacaoResultado {
  readonly log: LogNotificacaoPersistido;
  readonly criado: boolean;
}

export interface ResumoMonitoramentoNotificacoes {
  readonly total: number;
  readonly enfileiradas: number;
  readonly processando: number;
  readonly enviadas: number;
  readonly falhasTransitorias: number;
  readonly falhasPermanentes: number;
  readonly ignoradas: number;
}

export interface NotificacaoLogRepository {
  garantirRegistroIdempotente(
    input: GarantirLogNotificacaoInput,
  ): Promise<GarantirLogNotificacaoResultado>;
  vincularJobId(id: string, jobId: string): Promise<void>;
  marcarProcessando(
    id: string,
    tentativa: number,
    agora?: Date,
  ): Promise<{ podeProcessar: boolean; log: LogNotificacaoPersistido | null }>;
  marcarEnviada(
    id: string,
    dados: {
      readonly provedor: string;
      readonly provedorMensagemId: string | null;
      readonly enviadoEm?: Date;
    },
  ): Promise<LogNotificacaoPersistido>;
  marcarFalhaTransitoria(
    id: string,
    dados: {
      readonly erroCodigo: string | null;
      readonly erroSanitizado: string;
      readonly proximaTentativaEm: Date | null;
    },
  ): Promise<LogNotificacaoPersistido>;
  marcarFalhaPermanente(
    id: string,
    dados: {
      readonly erroCodigo: string | null;
      readonly erroSanitizado: string;
      readonly provedor?: string | null;
    },
  ): Promise<LogNotificacaoPersistido>;
  marcarIgnorada(
    id: string,
    dados: {
      readonly erroCodigo: string | null;
      readonly erroSanitizado: string;
    },
  ): Promise<LogNotificacaoPersistido>;
  buscarPorId(id: string): Promise<LogNotificacaoPersistido | null>;
  buscarPorIdempotencyKey(idempotencyKey: string): Promise<LogNotificacaoPersistido | null>;
  listarPorUsuario(usuarioId: string, limite?: number): Promise<LogNotificacaoPersistido[]>;
  listarPorPedido(pedidoId: string): Promise<LogNotificacaoPersistido[]>;
  listarPorSubpedido(subpedidoId: string): Promise<LogNotificacaoPersistido[]>;
  obterResumoMonitoramento(): Promise<ResumoMonitoramentoNotificacoes>;
}
