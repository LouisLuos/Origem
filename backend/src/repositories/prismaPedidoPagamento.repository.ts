import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import type { CotacaoFretePorOrigem } from './contracts/frete.contracts.js';
import type { NotificacaoOutboxRepository } from './contracts/notificacaoOutbox.contracts.js';
import {
  podeTransicionarStatusPagamento,
  podeTransicionarStatusPedido,
  type EnderecoEntregaSnapshot,
  type ItemPedidoSnapshot,
  type MetodoPagamento,
  type PagamentoDetalhado,
  type PedidoDetalhado,
  type ProcessamentoWebhookResultado,
  type StatusPagamento,
  type StatusPedido,
} from './contracts/pedidosPagamentos.contracts.js';
import { prismaNotificacaoOutboxRepository } from './prismaNotificacaoOutbox.repository.js';
import {
  cancelarGrupoReservaNaTransacao,
  carregarGrupoReservaParaCheckout,
  carregarGrupoReservaParaCheckoutNaTransacao,
  confirmarGrupoReservaNaTransacao,
  type GrupoReservaCheckoutCarregado,
  type PrismaTransactionClient,
} from './prismaReserva.repository.js';
import {
  PAGAMENTO_ERROR_CODES,
  type ResultadoCriacaoPagamentoGateway,
  type StatusPagamentoGatewayConsulta,
  type WebhookEventoNormalizado,
} from '../integrations/paymentGateway.contracts.js';
import { AppError } from '../utils/AppError.js';
import {
  centavosParaDecimalString,
  centavosParaNumero,
  decimalParaCentavos,
  somarCentavos,
} from '../utils/dinheiro.util.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';
import { isUuid } from '../utils/uuid.util.js';
import { eventoPagamentoAprovadoSchema } from '../validators/notificacao.validator.js';
import { RESERVA_ERROR_CODES } from './contracts/reservas.contracts.js';

const CHECKOUT_TX_OPTIONS = {
  maxWait: 25_000,
  timeout: 30_000,
} as const;

export function gerarCodigoPedido(): string {
  const agora = new Date();
  const ymd = `${agora.getUTCFullYear()}${String(agora.getUTCMonth() + 1).padStart(2, '0')}${String(
    agora.getUTCDate(),
  ).padStart(2, '0')}`;
  const sufixo = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `OR-${ymd}-${sufixo}`;
}

export interface IniciarCheckoutPersistidoInput {
  readonly usuarioId: string;
  readonly reservaGrupoId: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly metodoPagamento: MetodoPagamento;
  readonly gateway: string;
  readonly ambiente: 'sandbox' | 'production';
  readonly enderecoEntregaId?: string;
  readonly enderecoEntrega: EnderecoEntregaSnapshot;
  readonly parcelas: number;
  readonly bandeiraCartao?: string;
  readonly ultimosDigitosCartao?: string;
  readonly grupoReserva: GrupoReservaCheckoutCarregado;
  readonly fretesPorOrigem: readonly CotacaoFretePorOrigem[];
  readonly valorTotalPecasCentavos: number;
  readonly valorTotalFreteCentavos: number;
  readonly valorTotalPedidoCentavos: number;
  readonly itensSnapshot: readonly ItemPedidoSnapshot[];
  readonly agora: Date;
}

export interface IniciarCheckoutPersistidoResultado {
  readonly pedidoId: string;
  readonly pagamentoId: string;
  readonly codigoPedido: string;
  readonly pagamentoIdempotencyKey: string;
}

function mapPagamentoDetalhado(row: {
  id: string;
  pedidoId: string;
  gateway: string;
  ambiente: string;
  metodo: MetodoPagamento;
  status: StatusPagamento;
  valor: { toString(): string };
  externalPaymentId: string | null;
  gatewayStatusRaw: string | null;
  gatewayStatusDetail: string | null;
  expiraEm: Date | null;
  gatewayExpiraEm: Date | null;
  pixCopiaECola: string | null;
  pixQrCodeBase64: string | null;
  pixTicketUrl: string | null;
  cartaoBandeira: string | null;
  cartaoUltimosDigitos: string | null;
  parcelas: number;
  erroSanitizado: string | null;
  criadoEm: Date;
  aprovadoEm: Date | null;
  recusadoEm: Date | null;
}): PagamentoDetalhado {
  return {
    id: row.id,
    pedidoId: row.pedidoId,
    gateway: row.gateway,
    ambiente: row.ambiente,
    metodo: row.metodo,
    status: row.status,
    valor: centavosParaNumero(decimalParaCentavos(row.valor)),
    externalPaymentId: row.externalPaymentId,
    gatewayStatusRaw: row.gatewayStatusRaw,
    gatewayStatusDetail: row.gatewayStatusDetail,
    expiraEm: row.expiraEm ? row.expiraEm.toISOString() : null,
    gatewayExpiraEm: row.gatewayExpiraEm ? row.gatewayExpiraEm.toISOString() : null,
    pixCopiaECola: row.pixCopiaECola,
    pixQrCodeBase64: row.pixQrCodeBase64,
    pixTicketUrl: row.pixTicketUrl,
    cartaoBandeira: row.cartaoBandeira,
    cartaoUltimosDigitos: row.cartaoUltimosDigitos,
    parcelas: row.parcelas,
    erroSanitizado: row.erroSanitizado,
    criadoEm: row.criadoEm.toISOString(),
    aprovadoEm: row.aprovadoEm ? row.aprovadoEm.toISOString() : null,
    recusadoEm: row.recusadoEm ? row.recusadoEm.toISOString() : null,
  };
}

export function mapPedidoDetalhado(row: {
  id: string;
  codigoPedido: string;
  usuarioId: string;
  reservaGrupoId: string;
  status: StatusPedido;
  metodoPagamento: MetodoPagamento;
  valorTotalPecas: { toString(): string };
  valorTotalFrete: { toString(): string };
  valorTotalPedido: { toString(): string };
  enderecoEntregaSnapshot: unknown;
  fretesPorOrigem: unknown;
  itensSnapshot: unknown;
  subpedidosGerados: boolean;
  reconciliacaoMotivo: string | null;
  criadoEm: Date;
  pagoEm: Date | null;
  canceladoEm: Date | null;
  pagamentos: Array<Parameters<typeof mapPagamentoDetalhado>[0]>;
}): PedidoDetalhado {
  const pagamentoMaisRecente = row.pagamentos[0] ? mapPagamentoDetalhado(row.pagamentos[0]) : null;
  return {
    id: row.id,
    codigoPedido: row.codigoPedido,
    usuarioId: row.usuarioId,
    reservaGrupoId: row.reservaGrupoId,
    status: row.status,
    metodoPagamento: row.metodoPagamento,
    valorTotalPecas: centavosParaNumero(decimalParaCentavos(row.valorTotalPecas)),
    valorTotalFrete: centavosParaNumero(decimalParaCentavos(row.valorTotalFrete)),
    valorTotalPedido: centavosParaNumero(decimalParaCentavos(row.valorTotalPedido)),
    enderecoEntrega: row.enderecoEntregaSnapshot as EnderecoEntregaSnapshot,
    fretesPorOrigem: (Array.isArray(row.fretesPorOrigem)
      ? row.fretesPorOrigem
      : []) as readonly CotacaoFretePorOrigem[],
    itens: (Array.isArray(row.itensSnapshot)
      ? row.itensSnapshot
      : []) as readonly ItemPedidoSnapshot[],
    subpedidosGerados: row.subpedidosGerados,
    reconciliacaoMotivo: row.reconciliacaoMotivo,
    criadoEm: row.criadoEm.toISOString(),
    pagoEm: row.pagoEm ? row.pagoEm.toISOString() : null,
    canceladoEm: row.canceladoEm ? row.canceladoEm.toISOString() : null,
    pagamentoAtual: pagamentoMaisRecente,
  };
}

function extrairCodigoPg(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const anyErr = err as { code?: unknown; cause?: { code?: unknown } };
  if (typeof anyErr.code === 'string') return anyErr.code;
  if (anyErr.cause && typeof anyErr.cause.code === 'string') return anyErr.cause.code;
  return undefined;
}

/**
 * Núcleo transacional único de aprovação financeira:
 * - Confirma as reservas HU-06 na mesma transação ACID;
 * - Caso a reserva já tenha expirado antes da aprovação, encaminha o pedido para RECONCILIACAO_ESTORNO
 *   sem jamais recriar estoque ou confirmar reserva vencida;
 * - Caso a confirmação ocorra normalmente, marca pedido e pagamento APROVADO e registra evento
 *   `PagamentoAprovado` na tabela Outbox (HU-17) dentro do mesmo COMMIT.
 */
async function aplicarAprovacaoNaTransacao(params: {
  readonly tx: PrismaTransactionClient;
  readonly pedidoId: string;
  readonly pagamentoId: string;
  readonly agora: Date;
  readonly outboxRepository: NotificacaoOutboxRepository;
  readonly gatewayStatusRaw?: string;
  readonly gatewayStatusDetail?: string;
  readonly externalPaymentId?: string;
  readonly cartaoBandeira?: string;
  readonly cartaoUltimosDigitos?: string;
  readonly correlationId?: string;
}): Promise<{
  readonly statusPedidoFinal: StatusPedido;
  readonly statusPagamentoFinal: StatusPagamento;
  readonly acao: string;
  readonly outboxRegistrado: boolean;
}> {
  const { tx, pedidoId, pagamentoId, agora, outboxRepository } = params;

  const pedido = await tx.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      usuario: {
        select: { id: true, nome: true, email: true, telefoneWhatsapp: true },
      },
    },
  });
  const pagamento = await tx.pagamento.findUnique({ where: { id: pagamentoId } });

  if (!pedido || !pagamento) {
    throw new AppError(
      'Pedido ou pagamento não encontrado para efetivar aprovação.',
      404,
      PAGAMENTO_ERROR_CODES.PEDIDO_NAO_ENCONTRADO,
    );
  }

  // Idempotência / anti-regressão
  if (
    pedido.status === 'APROVADO' ||
    pedido.status === 'RECONCILIACAO_ESTORNO'
  ) {
    return {
      statusPedidoFinal: pedido.status,
      statusPagamentoFinal: pagamento.status,
      acao: 'JA_PROCESSADO_ANTERIORMENTE',
      outboxRegistrado: false,
    };
  }

  const confirmacao = await confirmarGrupoReservaNaTransacao(
    tx,
    pedido.reservaGrupoId,
    pedido.usuarioId,
    agora,
  );

  const pagamentoDadosBase = {
    ...(params.externalPaymentId && !pagamento.externalPaymentId
      ? { externalPaymentId: params.externalPaymentId }
      : {}),
    ...(params.gatewayStatusRaw ? { gatewayStatusRaw: params.gatewayStatusRaw.slice(0, 64) } : {}),
    ...(params.gatewayStatusDetail
      ? { gatewayStatusDetail: params.gatewayStatusDetail.slice(0, 120) }
      : {}),
    ...(params.cartaoBandeira && !pagamento.cartaoBandeira
      ? { cartaoBandeira: params.cartaoBandeira.slice(0, 32) }
      : {}),
    ...(params.cartaoUltimosDigitos && !pagamento.cartaoUltimosDigitos
      ? { cartaoUltimosDigitos: params.cartaoUltimosDigitos }
      : {}),
  };

  if (confirmacao.tipo === 'EXPIRADA_OU_CANCELADA' || confirmacao.tipo === 'NAO_ENCONTRADA') {
    const motivo =
      'Pagamento confirmado pelo gateway após expiração ou cancelamento da reserva de estoque (HU-06); estorno/reconciliação obrigatório sem recriar saldo.';

    await tx.pagamento.update({
      where: { id: pagamento.id },
      data: {
        ...pagamentoDadosBase,
        status: 'APROVADO',
        aprovadoEm: pagamento.aprovadoEm ?? agora,
        erroSanitizado: motivo.slice(0, 500),
        atualizadoEm: agora,
      },
    });

    await tx.pedido.update({
      where: { id: pedido.id },
      data: {
        status: 'RECONCILIACAO_ESTORNO',
        pagoEm: pedido.pagoEm ?? agora,
        reconciliacaoMotivo: motivo.slice(0, 500),
        atualizadoEm: agora,
      },
    });

    console.warn(
      JSON.stringify({
        timestamp: agora.toISOString(),
        level: 'WARN',
        evento: 'HU10_RECONCILIACAO_ESTORNO_NECESSARIA',
        pedidoId: pedido.id,
        codigoPedido: pedido.codigoPedido,
        pagamentoId: pagamento.id,
        reservaGrupoId: pedido.reservaGrupoId,
        motivo,
      }),
    );

    return {
      statusPedidoFinal: 'RECONCILIACAO_ESTORNO',
      statusPagamentoFinal: 'APROVADO',
      acao: 'MARCADO_RECONCILIACAO_ESTORNO_RESERVA_EXPIRADA',
      outboxRegistrado: false,
    };
  }

  if (confirmacao.tipo === 'PROIBIDA') {
    throw new AppError('Conflito de titularidade entre pedido e grupo de reserva.', 409);
  }

  // Confirmação válida -> APROVADO + Outbox PagamentoAprovado na mesma transação
  await tx.pagamento.update({
    where: { id: pagamento.id },
    data: {
      ...pagamentoDadosBase,
      status: 'APROVADO',
      aprovadoEm: pagamento.aprovadoEm ?? agora,
      erroSanitizado: null,
      atualizadoEm: agora,
    },
  });

  await tx.pedido.update({
    where: { id: pedido.id },
    data: {
      status: 'APROVADO',
      pagoEm: pedido.pagoEm ?? agora,
      atualizadoEm: agora,
    },
  });

  const itensSnapshot = (
    Array.isArray(pedido.itensSnapshot) ? pedido.itensSnapshot : []
  ) as unknown as readonly ItemPedidoSnapshot[];
  const fretesPorOrigem = (
    Array.isArray(pedido.fretesPorOrigem) ? pedido.fretesPorOrigem : []
  ) as unknown as readonly CotacaoFretePorOrigem[];
  const enderecoSnapshot = pedido.enderecoEntregaSnapshot as unknown as EnderecoEntregaSnapshot;

  const atelieIds = Array.from(new Set(itensSnapshot.map((i) => i.atelieId)));
  const ateliesDb = await tx.atelie.findMany({
    where: { id: { in: atelieIds } },
    include: {
      artesao: {
        include: {
          usuario: {
            select: { id: true, nome: true, email: true, telefoneWhatsapp: true },
          },
        },
      },
    },
  });

  const mapaFreteAtelie = new Map(fretesPorOrigem.map((f) => [f.atelieId, f.valorBrl]));

  const eventoOutbox = eventoPagamentoAprovadoSchema.parse({
    eventoId: `pgto_aprovado_${pedido.id}`,
    pedidoId: pedido.id,
    codigoPedido: pedido.codigoPedido,
    aprovadoEm: agora.toISOString(),
    metodoPagamento: pedido.metodoPagamento,
    comprador: {
      usuarioId: pedido.usuario.id,
      nome: pedido.usuario.nome,
      email: pedido.usuario.email,
      whatsapp: pedido.usuario.telefoneWhatsapp || undefined,
      consentimentoWhatsapp: Boolean(pedido.usuario.telefoneWhatsapp),
    },
    destino: {
      cidade: enderecoSnapshot.cidade,
      uf: enderecoSnapshot.uf,
    },
    valorTotalPecas: centavosParaNumero(decimalParaCentavos(pedido.valorTotalPecas)),
    valorTotalFrete: centavosParaNumero(decimalParaCentavos(pedido.valorTotalFrete)),
    valorTotalPedido: centavosParaNumero(decimalParaCentavos(pedido.valorTotalPedido)),
    atelies: ateliesDb.map((a) => ({
      atelieId: a.id,
      atelieNome: a.nomeComercial,
      titularUsuarioId: a.artesao.usuario.id,
      titularNome: a.artesao.usuario.nome,
      titularEmail: a.artesao.usuario.email,
      titularWhatsapp: a.artesao.usuario.telefoneWhatsapp || undefined,
      consentimentoWhatsappTitular: Boolean(a.artesao.usuario.telefoneWhatsapp),
      valorFreteAtelie: mapaFreteAtelie.get(a.id) ?? 0,
    })),
    itens: itensSnapshot.map((item) => ({
      atelieId: item.atelieId,
      atelieNome: item.atelieNome,
      poloCultural: item.poloCultural || undefined,
      pecaId: item.pecaId,
      tituloPeca: item.titulo,
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
      subtotalItem: item.subtotalItem,
      isFragil: Boolean(item.isFragil),
    })),
    correlationId: params.correlationId,
  });

  await outboxRepository.registrarNaMesmaTransacao(tx, {
    tipoEvento: 'PagamentoAprovado',
    aggregateId: pedido.id,
    idempotencyKey: `outbox_pagamento_aprovado_${pedido.id}`,
    payload: eventoOutbox,
  });

  return {
    statusPedidoFinal: 'APROVADO',
    statusPagamentoFinal: 'APROVADO',
    acao: 'APROVADO_RESERVA_CONFIRMADA_E_OUTBOX_GRAVADO',
    outboxRegistrado: true,
  };
}

/**
 * Núcleo transacional único de recusa / expiração / cancelamento antes da aprovação:
 * marca pedido + pagamento e devolve atomicamente o saldo da reserva HU-06 no máximo uma vez.
 */
async function aplicarRecusaOuExpiracaoNaTransacao(params: {
  readonly tx: PrismaTransactionClient;
  readonly pedidoId: string;
  readonly pagamentoId: string;
  readonly novoStatusPedido: Extract<StatusPedido, 'RECUSADO' | 'EXPIRADO' | 'CANCELADO'>;
  readonly novoStatusPagamento: Extract<StatusPagamento, 'RECUSADO' | 'EXPIRADO' | 'CANCELADO'>;
  readonly agora: Date;
  readonly gatewayStatusRaw?: string;
  readonly gatewayStatusDetail?: string;
  readonly externalPaymentId?: string;
  readonly erroSanitizado?: string;
}): Promise<{
  readonly statusPedidoFinal: StatusPedido;
  readonly statusPagamentoFinal: StatusPagamento;
  readonly unidadesDevolvidas: number;
  readonly acao: string;
}> {
  const { tx, pedidoId, pagamentoId, agora } = params;

  const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
  const pagamento = await tx.pagamento.findUnique({ where: { id: pagamentoId } });

  if (!pedido || !pagamento) {
    throw new AppError('Pedido ou pagamento não localizado.', 404);
  }

  if (!podeTransicionarStatusPedido(pedido.status, params.novoStatusPedido)) {
    return {
      statusPedidoFinal: pedido.status,
      statusPagamentoFinal: pagamento.status,
      unidadesDevolvidas: 0,
      acao: 'IGNORADO_PROTECAO_ANTI_REGRESSAO',
    };
  }

  if (!podeTransicionarStatusPagamento(pagamento.status, params.novoStatusPagamento)) {
    return {
      statusPedidoFinal: pedido.status,
      statusPagamentoFinal: pagamento.status,
      unidadesDevolvidas: 0,
      acao: 'IGNORADO_PROTECAO_ANTI_REGRESSAO_PAGAMENTO',
    };
  }

  // Devolução idempotente da reserva HU-06 dentro da mesma transação ACID
  const cancelamento = await cancelarGrupoReservaNaTransacao(
    tx,
    pedido.reservaGrupoId,
    pedido.usuarioId,
    agora,
  );

  await tx.pagamento.update({
    where: { id: pagamento.id },
    data: {
      ...(params.externalPaymentId && !pagamento.externalPaymentId
        ? { externalPaymentId: params.externalPaymentId }
        : {}),
      status: params.novoStatusPagamento,
      ...(params.novoStatusPagamento === 'RECUSADO'
        ? { recusadoEm: pagamento.recusadoEm ?? agora }
        : {}),
      ...(params.gatewayStatusRaw ? { gatewayStatusRaw: params.gatewayStatusRaw.slice(0, 64) } : {}),
      ...(params.gatewayStatusDetail
        ? { gatewayStatusDetail: params.gatewayStatusDetail.slice(0, 120) }
        : {}),
      ...(params.erroSanitizado
        ? { erroSanitizado: sanitizarErroProvedor(params.erroSanitizado) }
        : {}),
      atualizadoEm: agora,
    },
  });

  await tx.pedido.update({
    where: { id: pedido.id },
    data: {
      status: params.novoStatusPedido,
      canceladoEm: pedido.canceladoEm ?? agora,
      atualizadoEm: agora,
    },
  });

  return {
    statusPedidoFinal: params.novoStatusPedido,
    statusPagamentoFinal: params.novoStatusPagamento,
    unidadesDevolvidas: cancelamento.unidadesDevolvidas,
    acao:
      cancelamento.unidadesDevolvidas > 0
        ? `${params.novoStatusPedido}_E_ESTOQUE_DEVOLVIDO`
        : `${params.novoStatusPedido}_RESERVA_JA_FINALIZADA`,
  };
}

export function createPrismaPedidoPagamentoRepository(
  outboxRepository: NotificacaoOutboxRepository = prismaNotificacaoOutboxRepository,
) {
  return {
    async buscarPorIdempotencyKey(
      usuarioId: string,
      idempotencyKey: string,
    ): Promise<{ readonly payloadHash: string; readonly pedido: PedidoDetalhado } | null> {
      const existente = await prisma.pedido.findUnique({
        where: {
          usuarioId_idempotencyKey: { usuarioId, idempotencyKey },
        },
        include: {
          pagamentos: { orderBy: { criadoEm: 'desc' }, take: 1 },
        },
      });

      if (!existente) return null;
      return {
        payloadHash: existente.payloadHash,
        pedido: mapPedidoDetalhado(existente),
      };
    },

    async carregarGrupoReservaAtiva(
      grupoId: string,
      usuarioId: string,
      agora: Date = new Date(),
    ): Promise<GrupoReservaCheckoutCarregado> {
      return carregarGrupoReservaParaCheckout(grupoId, usuarioId, agora);
    },

    async iniciarPedidoEPagamentoAntesGateway(
      input: IniciarCheckoutPersistidoInput,
    ): Promise<
      | { readonly jaExistiaPorIdempotencia: true; readonly payloadHash: string; readonly pedido: PedidoDetalhado }
      | { readonly jaExistiaPorIdempotencia: false; readonly iniciado: IniciarCheckoutPersistidoResultado }
    > {
      try {
        const desfechoTx = await prisma.$transaction(async (tx) => {
          const existente = await tx.pedido.findUnique({
            where: {
              usuarioId_idempotencyKey: {
                usuarioId: input.usuarioId,
                idempotencyKey: input.idempotencyKey,
              },
            },
            include: {
              pagamentos: { orderBy: { criadoEm: 'desc' }, take: 1 },
            },
          });

          if (existente) {
            return {
              tipo: 'IDEMPOTENTE' as const,
              payloadHash: existente.payloadHash,
              pedido: mapPedidoDetalhado(existente),
            };
          }

          // Revalida reserva e trava peças dentro da transação antes de criar o pedido
          const carregamento = await carregarGrupoReservaParaCheckoutNaTransacao(
            tx,
            input.reservaGrupoId,
            input.usuarioId,
            input.agora,
          );
          if (carregamento.tipo === 'EXPIRADA_OU_CANCELADA') {
            return { tipo: 'RESERVA_EXPIRADA' as const };
          }

          if (input.enderecoEntregaId) {
            const end = await tx.endereco.findUnique({
              where: { id: input.enderecoEntregaId },
              select: { id: true, usuarioId: true },
            });
            if (!end || end.usuarioId !== input.usuarioId) {
              throw new AppError('Endereço de entrega informado não pertence ao usuário autenticado.', 403);
            }
          }

          const pecasSomadas = somarCentavos(
            input.itensSnapshot.map((i) => decimalParaCentavos(i.subtotalItem)),
          );
          if (
            pecasSomadas !== input.valorTotalPecasCentavos ||
            input.valorTotalPedidoCentavos !==
              input.valorTotalPecasCentavos + input.valorTotalFreteCentavos
          ) {
            throw new AppError('Divergência na soma exata do pedido no servidor.', 500);
          }

          const codigoPedido = gerarCodigoPedido();
          const pedidoCriado = await tx.pedido.create({
            data: {
              codigoPedido,
              usuarioId: input.usuarioId,
              reservaGrupoId: input.reservaGrupoId,
              enderecoEntregaId: input.enderecoEntregaId ?? null,
              enderecoEntregaSnapshot: input.enderecoEntrega as unknown as object,
              fretesPorOrigem: input.fretesPorOrigem as unknown as object,
              itensSnapshot: input.itensSnapshot as unknown as object,
              valorTotalPecas: centavosParaDecimalString(input.valorTotalPecasCentavos),
              valorTotalFrete: centavosParaDecimalString(input.valorTotalFreteCentavos),
              valorTotalPedido: centavosParaDecimalString(input.valorTotalPedidoCentavos),
              status: 'PENDENTE_PAGAMENTO',
              metodoPagamento: input.metodoPagamento,
              idempotencyKey: input.idempotencyKey,
              payloadHash: input.payloadHash,
              criadoEm: input.agora,
              atualizadoEm: input.agora,
            },
          });

          const pagamentoIdempotencyKey = `pgto_${pedidoCriado.id}_1`;
          const pagamentoCriado = await tx.pagamento.create({
            data: {
              pedidoId: pedidoCriado.id,
              gateway: input.gateway,
              ambiente: input.ambiente,
              metodo: input.metodoPagamento,
              status: 'CRIADO',
              valor: centavosParaDecimalString(input.valorTotalPedidoCentavos),
              idempotencyKey: pagamentoIdempotencyKey,
              expiraEm: input.grupoReserva.expiraEm,
              cartaoBandeira:
                input.metodoPagamento === 'CARTAO_CREDITO'
                  ? input.bandeiraCartao?.slice(0, 32) ?? null
                  : null,
              cartaoUltimosDigitos:
                input.metodoPagamento === 'CARTAO_CREDITO' &&
                input.ultimosDigitosCartao &&
                /^\d{4}$/.test(input.ultimosDigitosCartao)
                  ? input.ultimosDigitosCartao
                  : null,
              parcelas: input.metodoPagamento === 'CARTAO_CREDITO' ? input.parcelas : 1,
              criadoEm: input.agora,
              atualizadoEm: input.agora,
            },
          });

          return {
            tipo: 'INICIADO' as const,
            iniciado: {
              pedidoId: pedidoCriado.id,
              pagamentoId: pagamentoCriado.id,
              codigoPedido: pedidoCriado.codigoPedido,
              pagamentoIdempotencyKey,
            },
          };
        }, CHECKOUT_TX_OPTIONS);

        if (desfechoTx.tipo === 'RESERVA_EXPIRADA') {
          throw new AppError(
            'A reserva de estoque expirou ou já foi finalizada. Refaça a reserva antes de pagar.',
            409,
            RESERVA_ERROR_CODES.RESERVA_TRANSICAO_INVALIDA,
          );
        }

        if (desfechoTx.tipo === 'IDEMPOTENTE') {
          return {
            jaExistiaPorIdempotencia: true,
            payloadHash: desfechoTx.payloadHash,
            pedido: desfechoTx.pedido,
          };
        }

        return {
          jaExistiaPorIdempotencia: false,
          iniciado: desfechoTx.iniciado,
        };
      } catch (err) {
        const pgCode = extrairCodigoPg(err);
        if (pgCode === '23505' || pgCode === 'P2002') {
          throw new AppError(
            'Já existe um pedido em processamento ou aprovado para esta reserva de estoque.',
            409,
            PAGAMENTO_ERROR_CODES.PEDIDO_ATIVO_EXISTENTE,
          );
        }
        throw err;
      }
    },

    async registrarResultadoGatewayNoCheckout(params: {
      readonly pedidoId: string;
      readonly pagamentoId: string;
      readonly resultado: ResultadoCriacaoPagamentoGateway;
      readonly agora: Date;
      readonly correlationId?: string;
    }): Promise<{ readonly pedido: PedidoDetalhado; readonly outboxRegistrado: boolean }> {
      return prisma.$transaction(async (tx) => {
        // Trava pagamento e pedido para impedir corrida com webhook concorrente
        await tx.$queryRaw`SELECT "id" FROM "pagamentos" WHERE "id" = ${params.pagamentoId}::uuid FOR UPDATE`;
        const pagamento = await tx.pagamento.findUnique({ where: { id: params.pagamentoId } });
        const pedido = await tx.pedido.findUnique({ where: { id: params.pedidoId } });

        if (!pagamento || !pedido) {
          throw new AppError('Pedido ou pagamento não localizado após retorno do gateway.', 404);
        }

        const ehCartao = pagamento.metodo === 'CARTAO_CREDITO';

        // Se um webhook super-rápido já avançou o pagamento/pedido para estado terminal, preserva o estado final
        const jaFinalizadoPorWebhook =
          pedido.status === 'APROVADO' ||
          pedido.status === 'RECONCILIACAO_ESTORNO' ||
          pagamento.status === 'APROVADO';

        let outboxRegistrado = false;

        if (!jaFinalizadoPorWebhook) {
          if (params.resultado.status === 'APROVADO') {
            const desfecho = await aplicarAprovacaoNaTransacao({
              tx,
              pedidoId: pedido.id,
              pagamentoId: pagamento.id,
              agora: params.agora,
              outboxRepository,
              gatewayStatusRaw: params.resultado.gatewayStatusRaw,
              gatewayStatusDetail: params.resultado.gatewayStatusDetail,
              externalPaymentId: params.resultado.externalPaymentId,
              cartaoBandeira: ehCartao ? params.resultado.cartaoBandeira : undefined,
              cartaoUltimosDigitos: ehCartao ? params.resultado.cartaoUltimosDigitos : undefined,
              correlationId: params.correlationId,
            });
            outboxRegistrado = desfecho.outboxRegistrado;
          } else if (params.resultado.status === 'RECUSADO') {
            await tx.pagamento.update({
              where: { id: pagamento.id },
              data: {
                externalPaymentId: pagamento.externalPaymentId ?? params.resultado.externalPaymentId,
                gatewayStatusRaw: params.resultado.gatewayStatusRaw.slice(0, 64),
                gatewayStatusDetail: params.resultado.gatewayStatusDetail?.slice(0, 120) ?? null,
                ...(ehCartao && params.resultado.cartaoBandeira
                  ? { cartaoBandeira: params.resultado.cartaoBandeira.slice(0, 32) }
                  : {}),
                ...(ehCartao && params.resultado.cartaoUltimosDigitos
                  ? { cartaoUltimosDigitos: params.resultado.cartaoUltimosDigitos }
                  : {}),
              },
            });

            await aplicarRecusaOuExpiracaoNaTransacao({
              tx,
              pedidoId: pedido.id,
              pagamentoId: pagamento.id,
              novoStatusPedido: 'RECUSADO',
              novoStatusPagamento: 'RECUSADO',
              agora: params.agora,
              gatewayStatusRaw: params.resultado.gatewayStatusRaw,
              gatewayStatusDetail: params.resultado.gatewayStatusDetail,
              externalPaymentId: params.resultado.externalPaymentId,
              erroSanitizado: params.resultado.erroSanitizado,
            });
          } else {
            // PENDENTE (aguardando pagamento Pix ou análise assíncrona)
            if (podeTransicionarStatusPagamento(pagamento.status, 'PENDENTE')) {
              await tx.pagamento.update({
                where: { id: pagamento.id },
                data: {
                  status: 'PENDENTE',
                  externalPaymentId:
                    pagamento.externalPaymentId ?? params.resultado.externalPaymentId,
                  gatewayStatusRaw: params.resultado.gatewayStatusRaw.slice(0, 64),
                  gatewayStatusDetail: params.resultado.gatewayStatusDetail?.slice(0, 120) ?? null,
                  gatewayExpiraEm: params.resultado.gatewayExpiraEm ?? null,
                  pixCopiaECola: !ehCartao ? (params.resultado.pixCopiaECola ?? null) : null,
                  pixQrCodeBase64: !ehCartao ? (params.resultado.pixQrCodeBase64 ?? null) : null,
                  pixTicketUrl: !ehCartao ? (params.resultado.pixTicketUrl ?? null) : null,
                  cartaoBandeira: ehCartao
                    ? (params.resultado.cartaoBandeira?.slice(0, 32) ?? pagamento.cartaoBandeira)
                    : pagamento.cartaoBandeira,
                  cartaoUltimosDigitos: ehCartao
                    ? (params.resultado.cartaoUltimosDigitos ?? pagamento.cartaoUltimosDigitos)
                    : pagamento.cartaoUltimosDigitos,
                  atualizadoEm: params.agora,
                },
              });
            }
          }
        } else if (!pagamento.externalPaymentId && params.resultado.externalPaymentId) {
          await tx.pagamento.update({
            where: { id: pagamento.id },
            data: { externalPaymentId: params.resultado.externalPaymentId },
          });
        }

        const pedidoFinal = await tx.pedido.findUniqueOrThrow({
          where: { id: pedido.id },
          include: { pagamentos: { orderBy: { criadoEm: 'desc' }, take: 1 } },
        });

        return {
          pedido: mapPedidoDetalhado(pedidoFinal),
          outboxRegistrado,
        };
      }, CHECKOUT_TX_OPTIONS);
    },

    async registrarErroGatewayNoCheckout(params: {
      readonly pedidoId: string;
      readonly pagamentoId: string;
      readonly resultadoDesconhecido: boolean;
      readonly motivoSanitizado: string;
      readonly devolverReservaSeDefinitivo: boolean;
      readonly agora: Date;
    }): Promise<void> {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "pagamentos" WHERE "id" = ${params.pagamentoId}::uuid FOR UPDATE`;
        const pagamento = await tx.pagamento.findUnique({ where: { id: params.pagamentoId } });
        const pedido = await tx.pedido.findUnique({ where: { id: params.pedidoId } });
        if (!pagamento || !pedido) return;

        // Não sobrescrever se webhook já concluiu o pagamento
        if (pedido.status === 'APROVADO' || pedido.status === 'RECONCILIACAO_ESTORNO') {
          return;
        }

        if (params.resultadoDesconhecido || !params.devolverReservaSeDefinitivo) {
          if (podeTransicionarStatusPagamento(pagamento.status, 'ERRO_COMUNICACAO')) {
            await tx.pagamento.update({
              where: { id: pagamento.id },
              data: {
                status: 'ERRO_COMUNICACAO',
                erroSanitizado: sanitizarErroProvedor(params.motivoSanitizado),
                atualizadoEm: params.agora,
              },
            });
          }
          return;
        }

        await aplicarRecusaOuExpiracaoNaTransacao({
          tx,
          pedidoId: pedido.id,
          pagamentoId: pagamento.id,
          novoStatusPedido: 'RECUSADO',
          novoStatusPagamento: 'RECUSADO',
          agora: params.agora,
          erroSanitizado: params.motivoSanitizado,
        });
      }, CHECKOUT_TX_OPTIONS);
    },

    async processarWebhookAtomico(params: {
      readonly gateway: string;
      readonly evento: WebhookEventoNormalizado;
      readonly payloadHash: string;
      readonly consultaAutoritativa: StatusPagamentoGatewayConsulta;
      readonly agora: Date;
      readonly correlationId?: string;
    }): Promise<ProcessamentoWebhookResultado> {
      const eventoExternoId = params.evento.eventoExternoId!;
      const tipoEvento = params.evento.tipoEvento ?? 'payment.updated';

      return prisma.$transaction(async (tx) => {
        const resumoAuditoria = {
          ...params.evento.resumoPayload,
          statusConsultadoGateway: params.consultaAutoritativa.status,
          gatewayStatusRaw: params.consultaAutoritativa.gatewayStatusRaw,
        };

        // 1. Deduplicação atômica persistente no PostgreSQL via ON CONFLICT
        const inseridos = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO "webhooks_pagamento" (
            "gateway",
            "evento_externo_id",
            "tipo_evento",
            "external_payment_id",
            "assinatura_valida",
            "status_processamento",
            "payload_hash",
            "resumo_auditoria",
            "recebido_em"
          ) VALUES (
            ${params.gateway},
            ${eventoExternoId},
            ${tipoEvento.slice(0, 80)},
            ${params.consultaAutoritativa.externalPaymentId},
            true,
            'RECEBIDO'::"StatusProcessamentoWebhook",
            ${params.payloadHash},
            ${JSON.stringify(resumoAuditoria)}::jsonb,
            ${params.agora}::timestamp(3)
          )
          ON CONFLICT ("gateway", "evento_externo_id") DO NOTHING
          RETURNING "id"
        `;

        let webhookId: string;
        if (inseridos.length === 0) {
          const existenteRows = await tx.$queryRaw<
            Array<{ id: string; status_processamento: string }>
          >`
            SELECT "id", "status_processamento"::text
            FROM "webhooks_pagamento"
            WHERE "gateway" = ${params.gateway}
              AND "evento_externo_id" = ${eventoExternoId}
            FOR UPDATE
          `;
          const existente = existenteRows[0];
          if (!existente || existente.status_processamento !== 'ERRO') {
            return {
              recebido: true,
              duplicado: true,
              gateway: params.gateway,
              eventoExternoId,
              tipoEvento,
              statusProcessamento: 'IGNORADO_DUPLICADO',
              acao: 'WEBHOOK_DUPLICADO_IGNORADO',
              outboxRegistrado: false,
            };
          }
          webhookId = existente.id;
        } else {
          webhookId = inseridos[0]!.id;
        }

        // 2. Localiza e trava o pagamento + pedido correspondente
        let pagamentoRow = await tx.pagamento.findFirst({
          where: {
            gateway: params.gateway,
            externalPaymentId: params.consultaAutoritativa.externalPaymentId,
          },
          orderBy: { criadoEm: 'desc' },
        });

        if (!pagamentoRow && params.evento.pagamentoIdMetadata && isUuid(params.evento.pagamentoIdMetadata)) {
          pagamentoRow = await tx.pagamento.findFirst({
            where: { id: params.evento.pagamentoIdMetadata, gateway: params.gateway },
          });
        }

        if (!pagamentoRow && params.evento.pedidoIdMetadata && isUuid(params.evento.pedidoIdMetadata)) {
          pagamentoRow = await tx.pagamento.findFirst({
            where: { pedidoId: params.evento.pedidoIdMetadata, gateway: params.gateway },
            orderBy: { criadoEm: 'desc' },
          });
        }

        if (!pagamentoRow) {
          await tx.webhookPagamento.update({
            where: { id: webhookId },
            data: {
              statusProcessamento: 'ERRO',
              erroSanitizado: 'Pagamento correspondente não localizado no checkout.',
              processadoEm: params.agora,
            },
          });
          throw new AppError(
            'Pagamento associado ao webhook ainda não está disponível para conciliação.',
            409,
            PAGAMENTO_ERROR_CODES.PAGAMENTO_NAO_LOCALIZADO,
          );
        }

        // Lock pessimista em pagamento e pedido na ordem segura
        await tx.$queryRaw`SELECT "id" FROM "pagamentos" WHERE "id" = ${pagamentoRow.id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "pedidos" WHERE "id" = ${pagamentoRow.pedidoId}::uuid FOR UPDATE`;

        const statusAutoritativo = params.consultaAutoritativa.status;
        let statusPedidoFinal: StatusPedido;
        let statusPagamentoFinal: StatusPagamento;
        let acao = 'STATUS_NAO_TERMINAL_REGISTRADO';
        let outboxRegistrado = false;

        if (statusAutoritativo === 'APROVADO') {
          const desfecho = await aplicarAprovacaoNaTransacao({
            tx,
            pedidoId: pagamentoRow.pedidoId,
            pagamentoId: pagamentoRow.id,
            agora: params.agora,
            outboxRepository,
            gatewayStatusRaw: params.consultaAutoritativa.gatewayStatusRaw,
            gatewayStatusDetail: params.consultaAutoritativa.gatewayStatusDetail,
            externalPaymentId: params.consultaAutoritativa.externalPaymentId,
            cartaoBandeira: params.consultaAutoritativa.cartaoBandeira,
            cartaoUltimosDigitos: params.consultaAutoritativa.cartaoUltimosDigitos,
            correlationId: params.correlationId,
          });
          statusPedidoFinal = desfecho.statusPedidoFinal;
          statusPagamentoFinal = desfecho.statusPagamentoFinal;
          acao = desfecho.acao;
          outboxRegistrado = desfecho.outboxRegistrado;
        } else if (
          statusAutoritativo === 'RECUSADO' ||
          statusAutoritativo === 'CANCELADO' ||
          statusAutoritativo === 'EXPIRADO'
        ) {
          const desfecho = await aplicarRecusaOuExpiracaoNaTransacao({
            tx,
            pedidoId: pagamentoRow.pedidoId,
            pagamentoId: pagamentoRow.id,
            novoStatusPedido: statusAutoritativo,
            novoStatusPagamento: statusAutoritativo,
            agora: params.agora,
            gatewayStatusRaw: params.consultaAutoritativa.gatewayStatusRaw,
            gatewayStatusDetail: params.consultaAutoritativa.gatewayStatusDetail,
            externalPaymentId: params.consultaAutoritativa.externalPaymentId,
            erroSanitizado: params.consultaAutoritativa.motivoRecusaSanitizado,
          });
          statusPedidoFinal = desfecho.statusPedidoFinal;
          statusPagamentoFinal = desfecho.statusPagamentoFinal;
          acao = desfecho.acao;
        } else if (statusAutoritativo === 'ESTORNADO') {
          const pedidoAtual = await tx.pedido.findUniqueOrThrow({
            where: { id: pagamentoRow.pedidoId },
          });
          if (podeTransicionarStatusPagamento(pagamentoRow.status, 'ESTORNADO')) {
            await tx.pagamento.update({
              where: { id: pagamentoRow.id },
              data: {
                status: 'ESTORNADO',
                gatewayStatusRaw: params.consultaAutoritativa.gatewayStatusRaw.slice(0, 64),
                gatewayStatusDetail:
                  params.consultaAutoritativa.gatewayStatusDetail?.slice(0, 120) ?? null,
                atualizadoEm: params.agora,
              },
            });
            statusPagamentoFinal = 'ESTORNADO';
            acao = 'ESTORNO_REGISTRADO';
          } else {
            statusPagamentoFinal = pagamentoRow.status;
            acao = 'IGNORADO_PROTECAO_ANTI_REGRESSAO';
          }
          statusPedidoFinal = pedidoAtual.status;
        } else {
          // Status intermediário (PENDENTE / CRIADO): apenas atualiza metadados se ainda estiver CRIADO/PENDENTE
          const pedidoAtual = await tx.pedido.findUniqueOrThrow({
            where: { id: pagamentoRow.pedidoId },
          });
          if (
            pagamentoRow.status === 'CRIADO' ||
            pagamentoRow.status === 'PENDENTE' ||
            pagamentoRow.status === 'ERRO_COMUNICACAO'
          ) {
            await tx.pagamento.update({
              where: { id: pagamentoRow.id },
              data: {
                status: 'PENDENTE',
                externalPaymentId:
                  pagamentoRow.externalPaymentId ?? params.consultaAutoritativa.externalPaymentId,
                gatewayStatusRaw: params.consultaAutoritativa.gatewayStatusRaw.slice(0, 64),
                gatewayStatusDetail:
                  params.consultaAutoritativa.gatewayStatusDetail?.slice(0, 120) ?? null,
                atualizadoEm: params.agora,
              },
            });
            statusPagamentoFinal = 'PENDENTE';
            acao = 'STATUS_PENDENTE_ATUALIZADO';
          } else {
            statusPagamentoFinal = pagamentoRow.status;
            acao = 'IGNORADO_PROTECAO_ANTI_REGRESSAO';
          }
          statusPedidoFinal = pedidoAtual.status;
        }

        await tx.webhookPagamento.update({
          where: { id: webhookId },
          data: {
            pagamentoId: pagamentoRow.id,
            statusProcessamento: 'PROCESSADO',
            resumoAuditoria: {
              ...resumoAuditoria,
              acao,
              statusPedidoFinal,
              statusPagamentoFinal,
              outboxRegistrado,
            },
            erroSanitizado: null,
            processadoEm: params.agora,
          },
        });

        return {
          recebido: true,
          duplicado: false,
          gateway: params.gateway,
          eventoExternoId,
          tipoEvento,
          statusProcessamento: 'PROCESSADO',
          pedidoId: pagamentoRow.pedidoId,
          statusPedidoFinal,
          statusPagamentoFinal,
          acao,
          outboxRegistrado,
        };
      }, CHECKOUT_TX_OPTIONS);
    },

    async listarPedidosUsuario(usuarioId: string, limite = 25): Promise<PedidoDetalhado[]> {
      if (!isUuid(usuarioId)) return [];
      const rows = await prisma.pedido.findMany({
        where: { usuarioId },
        include: { pagamentos: { orderBy: { criadoEm: 'desc' }, take: 1 } },
        orderBy: { criadoEm: 'desc' },
        take: Math.max(1, Math.min(100, limite)),
      });
      return rows.map(mapPedidoDetalhado);
    },

    async buscarPedidoUsuarioPorIdOuCodigo(
      usuarioId: string,
      filtro: { readonly tipo: 'id' | 'codigoPedido'; readonly valor: string },
    ): Promise<PedidoDetalhado> {
      if (!isUuid(usuarioId)) {
        throw new AppError('Autenticação inválida.', 401);
      }

      const row =
        filtro.tipo === 'id'
          ? await prisma.pedido.findUnique({
              where: { id: filtro.valor },
              include: { pagamentos: { orderBy: { criadoEm: 'desc' }, take: 1 } },
            })
          : await prisma.pedido.findUnique({
              where: { codigoPedido: filtro.valor },
              include: { pagamentos: { orderBy: { criadoEm: 'desc' }, take: 1 } },
            });

      if (!row) {
        throw new AppError(
          'Pedido não encontrado.',
          404,
          PAGAMENTO_ERROR_CODES.PEDIDO_NAO_ENCONTRADO,
        );
      }

      if (row.usuarioId !== usuarioId) {
        throw new AppError('Você não tem permissão para consultar este pedido.', 403);
      }

      return mapPedidoDetalhado(row);
    },

    async marcarExpiracaoReservaExpirada(
      pedidoId: string,
      usuarioId: string,
      agora: Date = new Date(),
    ): Promise<PedidoDetalhado> {
      return prisma.$transaction(async (tx) => {
        const pedido = await tx.pedido.findUnique({
          where: { id: pedidoId },
          include: { pagamentos: { orderBy: { criadoEm: 'desc' }, take: 1 } },
        });
        if (!pedido) {
          throw new AppError('Pedido não encontrado.', 404);
        }
        if (pedido.usuarioId !== usuarioId) {
          throw new AppError('Você não tem permissão para operar este pedido.', 403);
        }

        const pag = pedido.pagamentos[0];
        if (
          pedido.status === 'PENDENTE_PAGAMENTO' &&
          pag &&
          pag.expiraEm &&
          pag.expiraEm.getTime() <= agora.getTime()
        ) {
          try {
            await aplicarRecusaOuExpiracaoNaTransacao({
              tx,
              pedidoId: pedido.id,
              pagamentoId: pag.id,
              novoStatusPedido: 'EXPIRADO',
              novoStatusPagamento: 'EXPIRADO',
              agora,
              erroSanitizado: 'Prazo máximo do Pix / reserva de 15 minutos expirado.',
            });
          } catch (err) {
            if (
              !(err instanceof AppError) ||
              err.code !== RESERVA_ERROR_CODES.RESERVA_TRANSICAO_INVALIDA
            ) {
              throw err;
            }
          }
        }

        const atualizado = await tx.pedido.findUniqueOrThrow({
          where: { id: pedido.id },
          include: { pagamentos: { orderBy: { criadoEm: 'desc' }, take: 1 } },
        });
        return mapPedidoDetalhado(atualizado);
      }, CHECKOUT_TX_OPTIONS);
    },
  };
}

export type PrismaPedidoPagamentoRepository = ReturnType<typeof createPrismaPedidoPagamentoRepository>;
export const prismaPedidoPagamentoRepository = createPrismaPedidoPagamentoRepository();
