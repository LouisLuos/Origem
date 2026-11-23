import { env } from '../config/env.js';
import { SLA_POSTAGEM_LIMITE_DIAS_UTEIS } from '../jobs/checkPostageSla.job.js';
import type {
  EnfileirarNotificacaoResultado,
  NotificationProducer,
} from '../queues/notification.queue.js';
import type {
  LogNotificacaoPersistido,
  NotificacaoLogRepository,
} from '../repositories/contracts/notificacoes.contracts.js';
import { prismaNotificacaoLogRepository } from '../repositories/prismaNotificacaoLog.repository.js';
import {
  calcularDataLimiteDiasUteis,
  createCalendarioFeriadosFromEnv,
  type CalendarioFeriados,
} from '../utils/diasUteis.util.js';
import { construirChaveIdempotenciaNotificacao } from '../utils/notificationPrivacy.util.js';
import {
  eventoAtualizacaoStatusPedidoSchema,
  eventoPagamentoAprovadoSchema,
  type EventoAtualizacaoStatusPedido,
  type EventoPagamentoAprovado,
} from '../validators/notificacao.validator.js';

export interface PublicacaoEventoNotificacaoResultado {
  readonly eventoOrigem: string;
  readonly pedidoId: string;
  readonly notificacoesEnfileiradas: number;
  readonly notificacoesDuplicadas: number;
  readonly notificacoesIgnoradas: number;
  readonly resultados: EnfileirarNotificacaoResultado[];
}

export interface NotificacaoEventosService {
  publicarPagamentoAprovado(
    entrada: EventoPagamentoAprovado,
  ): Promise<PublicacaoEventoNotificacaoResultado>;
  publicarAtualizacaoStatusPedido(
    entrada: EventoAtualizacaoStatusPedido,
  ): Promise<PublicacaoEventoNotificacaoResultado>;
  listarNotificacoesUsuario(
    usuarioId: string,
    limite?: number,
  ): Promise<LogNotificacaoPersistido[]>;
}

function resumirResultados(
  eventoOrigem: string,
  pedidoId: string,
  resultados: EnfileirarNotificacaoResultado[],
): PublicacaoEventoNotificacaoResultado {
  return {
    eventoOrigem,
    pedidoId,
    notificacoesEnfileiradas: resultados.filter((r) => r.enfileirada).length,
    notificacoesDuplicadas: resultados.filter((r) => r.duplicada).length,
    notificacoesIgnoradas: resultados.filter((r) => r.status === 'IGNORADA').length,
    resultados,
  };
}

export function createNotificacaoEventosService(deps: {
  readonly producer: Pick<NotificationProducer, 'enfileirar'>;
  readonly logRepository?: NotificacaoLogRepository;
  readonly calendarioFeriados?: CalendarioFeriados;
  readonly appPublicUrl?: string;
}): NotificacaoEventosService {
  const logRepository = deps.logRepository ?? prismaNotificacaoLogRepository;
  const appPublicUrl = (deps.appPublicUrl ?? env.APP_PUBLIC_URL).replace(/\/+$/, '');

  return {
    async publicarPagamentoAprovado(entrada) {
      const evento = eventoPagamentoAprovadoSchema.parse(entrada);
      const calendario = deps.calendarioFeriados ?? createCalendarioFeriadosFromEnv();
      const aprovadoEmDate =
        evento.aprovadoEm instanceof Date ? evento.aprovadoEm : new Date(evento.aprovadoEm);

      const mapaAtelieNome = new Map(evento.atelies.map((a) => [a.atelieId, a.atelieNome]));
      const resultados: EnfileirarNotificacaoResultado[] = [];

      // 1) Recibo consolidado do comprador por e-mail
      const payloadComprador = {
        template: 'PAGAMENTO_APROVADO_COMPRADOR' as const,
        dados: {
          pedidoId: evento.pedidoId,
          codigoPedido: evento.codigoPedido,
          compradorNome: evento.comprador.nome,
          metodoPagamento: evento.metodoPagamento,
          aprovadoEm: aprovadoEmDate,
          valorTotalPecas: evento.valorTotalPecas,
          valorTotalFrete: evento.valorTotalFrete,
          valorTotalPedido: evento.valorTotalPedido,
          itens: evento.itens.map((item) => ({
            tituloPeca: item.tituloPeca,
            atelieNome: mapaAtelieNome.get(item.atelieId) ?? item.atelieNome,
            poloCultural: item.poloCultural,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            subtotalItem: item.subtotalItem,
          })),
          urlAcompanhamento: `${appPublicUrl}/pedido/${encodeURIComponent(evento.codigoPedido)}`,
        },
      };

      const resCompradorEmail = await deps.producer.enfileirar({
        eventoOrigem: 'PagamentoAprovado',
        canal: 'EMAIL',
        destinatarioReal: evento.comprador.email,
        pedidoId: evento.pedidoId,
        usuarioId: evento.comprador.usuarioId,
        payloadTemplate: payloadComprador,
        idempotencyKey: construirChaveIdempotenciaNotificacao('pgto_comprador', [
          evento.pedidoId,
          'EMAIL',
        ]),
        correlationId: evento.correlationId ?? null,
      });
      resultados.push(resCompradorEmail);

      // 2) Aviso de nova encomenda para cada ateliê responsável
      for (const atelie of evento.atelies) {
        const itensDoAtelie = evento.itens.filter((item) => item.atelieId === atelie.atelieId);
        if (itensDoAtelie.length === 0) {
          continue;
        }

        const valorItensAtelie = Number(
          itensDoAtelie.reduce((soma, item) => soma + item.subtotalItem, 0).toFixed(2),
        );
        const dataLimitePostagem = atelie.dataLimitePostagem
          ? atelie.dataLimitePostagem instanceof Date
            ? atelie.dataLimitePostagem
            : new Date(atelie.dataLimitePostagem)
          : calcularDataLimiteDiasUteis(
              aprovadoEmDate,
              SLA_POSTAGEM_LIMITE_DIAS_UTEIS,
              calendario,
            );

        const payloadAtelie = {
          template: 'NOVA_ENCOMENDA_ATELIE' as const,
          dados: {
            pedidoId: evento.pedidoId,
            codigoPedido: evento.codigoPedido,
            subpedidoId: atelie.subpedidoId,
            atelieId: atelie.atelieId,
            atelieNome: atelie.atelieNome,
            titularNome: atelie.titularNome,
            cidadeDestino: evento.destino?.cidade,
            ufDestino: evento.destino?.uf,
            aprovadoEm: aprovadoEmDate,
            dataLimitePostagem,
            valorItensAtelie,
            valorFreteAtelie: atelie.valorFreteAtelie,
            itens: itensDoAtelie.map((item) => ({
              tituloPeca: item.tituloPeca,
              quantidade: item.quantidade,
              valorUnitario: item.precoUnitario,
              subtotalItem: item.subtotalItem,
              isFragil: item.isFragil,
            })),
            urlPainelAtelie: `${appPublicUrl}/painel`,
          },
        };

        const resAtelieEmail = await deps.producer.enfileirar({
          eventoOrigem: 'PagamentoAprovado',
          canal: 'EMAIL',
          destinatarioReal: atelie.titularEmail,
          pedidoId: evento.pedidoId,
          subpedidoId: atelie.subpedidoId ?? null,
          usuarioId: atelie.titularUsuarioId,
          atelieId: atelie.atelieId,
          payloadTemplate: payloadAtelie,
          idempotencyKey: construirChaveIdempotenciaNotificacao('pgto_atelie', [
            evento.pedidoId,
            atelie.atelieId,
            'EMAIL',
          ]),
          correlationId: evento.correlationId ?? null,
        });
        resultados.push(resAtelieEmail);

        if (atelie.titularWhatsapp) {
          const resAtelieWhatsapp = await deps.producer.enfileirar({
            eventoOrigem: 'PagamentoAprovado',
            canal: 'WHATSAPP',
            destinatarioReal: atelie.titularWhatsapp,
            consentimentoWhatsapp: atelie.consentimentoWhatsappTitular,
            pedidoId: evento.pedidoId,
            subpedidoId: atelie.subpedidoId ?? null,
            usuarioId: atelie.titularUsuarioId,
            atelieId: atelie.atelieId,
            payloadTemplate: payloadAtelie,
            idempotencyKey: construirChaveIdempotenciaNotificacao('pgto_atelie', [
              evento.pedidoId,
              atelie.atelieId,
              'WHATSAPP',
            ]),
            correlationId: evento.correlationId ?? null,
          });
          resultados.push(resAtelieWhatsapp);
        }
      }

      return resumirResultados('PagamentoAprovado', evento.pedidoId, resultados);
    },

    async publicarAtualizacaoStatusPedido(entrada) {
      const evento = eventoAtualizacaoStatusPedidoSchema.parse(entrada);
      const ocorrenciaDate =
        evento.ocorrenciaEm instanceof Date
          ? evento.ocorrenciaEm
          : new Date(evento.ocorrenciaEm);

      const payloadTemplate = {
        template: 'ATUALIZACAO_STATUS_PEDIDO' as const,
        dados: {
          pedidoId: evento.pedidoId,
          codigoPedido: evento.codigoPedido,
          subpedidoId: evento.subpedidoId,
          destinatarioNome: evento.destinatario.nome,
          atelieNome: evento.atelieNome,
          novoStatus: evento.novoStatus,
          ocorrenciaEm: ocorrenciaDate,
          codigoRastreio: evento.codigoRastreio,
          transportadora: evento.transportadora,
          mensagemComplementar: evento.mensagemComplementar,
          urlAcompanhamento: `${appPublicUrl}/pedido/${encodeURIComponent(evento.codigoPedido)}`,
        },
      };

      const resultados: EnfileirarNotificacaoResultado[] = [];

      for (const canal of new Set(evento.canais)) {
        if (canal === 'EMAIL') {
          if (!evento.destinatario.email) continue;
          const res = await deps.producer.enfileirar({
            eventoOrigem: 'AtualizacaoStatusPedido',
            canal: 'EMAIL',
            destinatarioReal: evento.destinatario.email,
            pedidoId: evento.pedidoId,
            subpedidoId: evento.subpedidoId ?? null,
            usuarioId: evento.destinatario.usuarioId,
            atelieId: evento.atelieId ?? null,
            payloadTemplate,
            idempotencyKey: construirChaveIdempotenciaNotificacao('status_pedido', [
              evento.pedidoId,
              evento.subpedidoId,
              evento.novoStatus,
              'EMAIL',
            ]),
            correlationId: evento.correlationId ?? null,
          });
          resultados.push(res);
          continue;
        }

        const res = await deps.producer.enfileirar({
          eventoOrigem: 'AtualizacaoStatusPedido',
          canal: 'WHATSAPP',
          destinatarioReal: evento.destinatario.whatsapp ?? 'nao-informado',
          consentimentoWhatsapp: Boolean(
            evento.destinatario.whatsapp && evento.destinatario.consentimentoWhatsapp,
          ),
          pedidoId: evento.pedidoId,
          subpedidoId: evento.subpedidoId ?? null,
          usuarioId: evento.destinatario.usuarioId,
          atelieId: evento.atelieId ?? null,
          payloadTemplate,
          idempotencyKey: construirChaveIdempotenciaNotificacao('status_pedido', [
            evento.pedidoId,
            evento.subpedidoId,
            evento.novoStatus,
            'WHATSAPP',
          ]),
          correlationId: evento.correlationId ?? null,
        });
        resultados.push(res);
      }

      return resumirResultados('AtualizacaoStatusPedido', evento.pedidoId, resultados);
    },

    async listarNotificacoesUsuario(usuarioId, limite) {
      return logRepository.listarPorUsuario(usuarioId, limite);
    },
  };
}
