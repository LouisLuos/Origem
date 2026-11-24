import { env } from '../config/env.js';
import type {
  EnfileirarNotificacaoResultado,
  NotificationProducer,
} from '../queues/notification.queue.js';
import {
  type SubpedidoPendentePostagemSla,
  type SubpedidoSlaRepository,
  unconfiguredSubpedidoSlaRepository,
} from '../repositories/contracts/slaPostagem.contracts.js';
import {
  calcularDataLimiteDiasUteis,
  contarDiasUteisDecorridos,
  createCalendarioFeriadosFromEnv,
  type CalendarioFeriados,
} from '../utils/diasUteis.util.js';
import {
  construirChaveIdempotenciaNotificacao,
  sanitizarErroProvedor,
} from '../utils/notificationPrivacy.util.js';

export const SLA_POSTAGEM_LIMITE_DIAS_UTEIS = 7;
export const SLA_POSTAGEM_ALERTA_URGENTE_DIA_UTIL = 5;

export interface FiscalizacaoSlaDeps {
  readonly subpedidoRepository?: SubpedidoSlaRepository;
  readonly producer: Pick<NotificationProducer, 'enfileirar'>;
  readonly calendarioFeriados?: CalendarioFeriados;
  readonly appPublicUrl?: string;
}

export interface FiscalizacaoSlaResultado {
  readonly repositoryConfigurado: boolean;
  readonly subpedidosAvaliados: number;
  readonly subpedidosEmAlertaDia5: number;
  readonly alertasEnfileirados: number;
  readonly alertasDuplicados: number;
  readonly alertasIgnorados: number;
  readonly resultados: EnfileirarNotificacaoResultado[];
}

export interface AgendadorSlaPostagem {
  executarCiclo(agora?: Date): Promise<FiscalizacaoSlaResultado>;
  parar(): void;
}

function montarPayloadAlertaDia5(
  subpedido: SubpedidoPendentePostagemSla,
  diasUteisDecorridos: number,
  dataLimitePostagem: Date,
  appPublicUrl: string,
) {
  return {
    template: 'ALERTA_SLA_POSTAGEM_DIA5' as const,
    dados: {
      pedidoId: subpedido.pedidoId,
      codigoPedido: subpedido.codigoPedido,
      subpedidoId: subpedido.subpedidoId,
      atelieId: subpedido.atelieId,
      atelieNome: subpedido.atelieNome,
      titularNome: subpedido.titularNome,
      diasUteisDecorridos,
      prazoMaximoDiasUteis: SLA_POSTAGEM_LIMITE_DIAS_UTEIS,
      pagamentoAprovadoEm: subpedido.pagamentoAprovadoEm,
      dataLimitePostagem,
      resumoItens:
        subpedido.resumoItens.length > 0
          ? [...subpedido.resumoItens]
          : [`Subpedido ${subpedido.subpedidoId}`],
      urlPainelAtelie: `${appPublicUrl.replace(/\/+$/, '')}/painel`,
    },
  };
}

/**
 * Fiscaliza subpedidos ainda em `AGUARDANDO_POSTAGEM` sem código de rastreio que atingiram
 * o 5º dia útil (conforme regra de dias úteis + calendário oficial opcional).
 * Executa de forma idempotente para impedir alertas duplicados em reexecuções.
 */
export async function executarFiscalizacaoSlaPostagem(
  deps: FiscalizacaoSlaDeps,
  agora: Date = new Date(),
): Promise<FiscalizacaoSlaResultado> {
  const repo = deps.subpedidoRepository ?? unconfiguredSubpedidoSlaRepository;
  if (!repo.configurado) {
    return {
      repositoryConfigurado: false,
      subpedidosAvaliados: 0,
      subpedidosEmAlertaDia5: 0,
      alertasEnfileirados: 0,
      alertasDuplicados: 0,
      alertasIgnorados: 0,
      resultados: [],
    };
  }

  const calendario = deps.calendarioFeriados ?? createCalendarioFeriadosFromEnv();
  const appPublicUrl = deps.appPublicUrl ?? env.APP_PUBLIC_URL;
  const pendentes = await repo.listarAguardandoPostagem();

  let subpedidosEmAlertaDia5 = 0;
  let alertasEnfileirados = 0;
  let alertasDuplicados = 0;
  let alertasIgnorados = 0;
  const resultados: EnfileirarNotificacaoResultado[] = [];

  for (const subpedido of pendentes) {
    if (
      subpedido.statusLogistico !== 'AGUARDANDO_POSTAGEM' ||
      subpedido.codigoRastreio ||
      subpedido.dataPostagem
    ) {
      continue;
    }

    const diasUteis = contarDiasUteisDecorridos(subpedido.pagamentoAprovadoEm, agora, calendario);
    if (diasUteis < SLA_POSTAGEM_ALERTA_URGENTE_DIA_UTIL) {
      continue;
    }

    subpedidosEmAlertaDia5 += 1;
    const dataLimitePostagem = calcularDataLimiteDiasUteis(
      subpedido.pagamentoAprovadoEm,
      SLA_POSTAGEM_LIMITE_DIAS_UTEIS,
      calendario,
    );
    const payloadTemplate = montarPayloadAlertaDia5(
      subpedido,
      diasUteis,
      dataLimitePostagem,
      appPublicUrl,
    );

    const resultadoEmail = await deps.producer.enfileirar({
      eventoOrigem: 'SlaPostagemDia5',
      canal: 'EMAIL',
      destinatarioReal: subpedido.titularEmail,
      pedidoId: subpedido.pedidoId,
      subpedidoId: subpedido.subpedidoId,
      usuarioId: subpedido.titularUsuarioId,
      atelieId: subpedido.atelieId,
      payloadTemplate,
      idempotencyKey: construirChaveIdempotenciaNotificacao('sla_dia5', [
        subpedido.subpedidoId,
        'EMAIL',
      ]),
    });

    const resultadoWhatsapp = await deps.producer.enfileirar({
      eventoOrigem: 'SlaPostagemDia5',
      canal: 'WHATSAPP',
      destinatarioReal: subpedido.titularWhatsapp ?? 'nao-informado',
      consentimentoWhatsapp: Boolean(
        subpedido.titularWhatsapp && subpedido.consentimentoWhatsappTitular,
      ),
      pedidoId: subpedido.pedidoId,
      subpedidoId: subpedido.subpedidoId,
      usuarioId: subpedido.titularUsuarioId,
      atelieId: subpedido.atelieId,
      payloadTemplate,
      idempotencyKey: construirChaveIdempotenciaNotificacao('sla_dia5', [
        subpedido.subpedidoId,
        'WHATSAPP',
      ]),
    });

    for (const res of [resultadoEmail, resultadoWhatsapp]) {
      resultados.push(res);
      if (res.enfileirada) alertasEnfileirados += 1;
      if (res.duplicada) alertasDuplicados += 1;
      if (res.status === 'IGNORADA') alertasIgnorados += 1;
    }
  }

  return {
    repositoryConfigurado: true,
    subpedidosAvaliados: pendentes.length,
    subpedidosEmAlertaDia5,
    alertasEnfileirados,
    alertasDuplicados,
    alertasIgnorados,
    resultados,
  };
}

/**
 * Agendador periódico desacoplado do Express (executado no processo separado do worker).
 */
export function iniciarAgendadorSlaPostagem(
  deps: FiscalizacaoSlaDeps & { readonly intervaloMs?: number },
): AgendadorSlaPostagem {
  const intervaloMs = deps.intervaloMs ?? env.NOTIFICATION_SLA_CHECK_INTERVAL_MS;
  let emExecucao = false;
  let encerrado = false;

  async function executarCiclo(agora: Date = new Date()): Promise<FiscalizacaoSlaResultado> {
    if (emExecucao || encerrado) {
      return {
        repositoryConfigurado: (deps.subpedidoRepository ?? unconfiguredSubpedidoSlaRepository).configurado,
        subpedidosAvaliados: 0,
        subpedidosEmAlertaDia5: 0,
        alertasEnfileirados: 0,
        alertasDuplicados: 0,
        alertasIgnorados: 0,
        resultados: [],
      };
    }

    emExecucao = true;
    try {
      const resumo = await executarFiscalizacaoSlaPostagem(deps, agora);
      if (resumo.alertasEnfileirados > 0) {
        console.info(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            evento: 'SLA_POSTAGEM_ALERTAS_ENFILEIRADOS',
            subpedidosEmAlertaDia5: resumo.subpedidosEmAlertaDia5,
            alertasEnfileirados: resumo.alertasEnfileirados,
          }),
        );
      }
      return resumo;
    } catch (err) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          evento: 'SLA_POSTAGEM_FISCALIZACAO_ERRO',
          erro: sanitizarErroProvedor(err),
        }),
      );
      throw err;
    } finally {
      emExecucao = false;
    }
  }

  const timer = setInterval(() => {
    void executarCiclo().catch(() => {});
  }, intervaloMs);
  timer.unref();

  return {
    executarCiclo,
    parar() {
      encerrado = true;
      clearInterval(timer);
    },
  };
}
