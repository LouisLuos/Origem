import crypto from 'node:crypto';
import { pingRedis } from '../cache/redis.client.js';
import { createFreteProviderFromEnv } from '../integrations/frete.provider.js';
import { createPaymentGatewayFromEnv } from '../integrations/paymentGateway.factory.js';
import {
  PAGAMENTO_ERROR_CODES,
  PaymentGatewayError,
  type PaymentGatewayPort,
  type ResultadoCriacaoPagamentoGateway,
} from '../integrations/paymentGateway.contracts.js';
import { createNotificationProducer } from '../queues/notification.queue.js';
import type {
  CotacaoFretePorOrigem,
  ItemFreteOrigemInput,
  ProvedorCotacaoFrete,
} from '../repositories/contracts/frete.contracts.js';
import type { NotificacaoOutboxRelay } from '../repositories/contracts/notificacaoOutbox.contracts.js';
import type {
  CheckoutResultado,
  ItemPedidoSnapshot,
  PedidoDetalhado,
  ProcessamentoWebhookResultado,
} from '../repositories/contracts/pedidosPagamentos.contracts.js';
import { prismaNotificacaoLogRepository } from '../repositories/prismaNotificacaoLog.repository.js';
import { prismaNotificacaoOutboxRepository } from '../repositories/prismaNotificacaoOutbox.repository.js';
import {
  prismaPedidoPagamentoRepository,
  type PrismaPedidoPagamentoRepository,
} from '../repositories/prismaPedidoPagamento.repository.js';
import type { GrupoReservaCheckoutCarregado } from '../repositories/prismaReserva.repository.js';
import { createFreteService } from './frete.service.js';
import { createNotificacaoEventosService } from './notificacaoEventos.service.js';
import { createNotificacaoOutboxRelay } from './notificacaoOutbox.relay.js';
import { AppError } from '../utils/AppError.js';
import {
  centavosParaNumero,
  decimalParaCentavos,
  somarCentavos,
} from '../utils/dinheiro.util.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';
import type {
  CheckoutValidado,
  CotacaoFreteCheckoutInput,
} from '../validators/pedidoPagamento.validator.js';

export interface CotacaoFreteCheckoutResultado {
  readonly reservaGrupoId: string;
  readonly expiraEm: string;
  readonly cepDestino: string;
  readonly valorTotalPecas: number;
  readonly valorTotalFrete: number;
  readonly valorTotalPedido: number;
  readonly fretesPorOrigem: readonly CotacaoFretePorOrigem[];
}

export interface ProcessarWebhookInput {
  readonly gatewayParam: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly query: Readonly<Record<string, string | string[] | undefined>>;
  readonly rawBody: Buffer;
  readonly body: unknown;
  readonly correlationId?: string;
}

export interface CheckoutPagamentoServiceDeps {
  readonly repository?: PrismaPedidoPagamentoRepository;
  readonly freteProvider?: ProvedorCotacaoFrete;
  readonly paymentGateway?: PaymentGatewayPort;
  readonly gatewaysPorNome?: ReadonlyMap<string, PaymentGatewayPort>;
  readonly outboxRelay?: NotificacaoOutboxRelay;
}

function mapearItensFreteESnapshot(grupo: GrupoReservaCheckoutCarregado): {
  readonly itensFrete: ItemFreteOrigemInput[];
  readonly itensSnapshot: ItemPedidoSnapshot[];
  readonly valorTotalPecasCentavos: number;
} {
  const itensFrete: ItemFreteOrigemInput[] = [];
  const itensSnapshot: ItemPedidoSnapshot[] = [];
  const subtotaisCentavos: number[] = [];

  for (const item of grupo.itens) {
    const precoCentavos = decimalParaCentavos(item.precoUnitarioString);
    const subtotalCentavos = precoCentavos * item.quantidade;
    subtotaisCentavos.push(subtotalCentavos);

    itensFrete.push({
      pecaId: item.pecaId,
      titulo: item.titulo,
      quantidade: item.quantidade,
      cubagem: {
        pesoGramas: item.pesoGramas,
        comprimentoCm: item.comprimentoCm,
        larguraCm: item.larguraCm,
        alturaCm: item.alturaCm,
      },
      atelieId: item.atelieId,
      atelieNome: item.atelieNome,
      poloCultural: item.poloCultural,
      cepOrigem: item.atelieCepOrigem,
    });

    itensSnapshot.push({
      pecaId: item.pecaId,
      titulo: item.titulo,
      atelieId: item.atelieId,
      atelieNome: item.atelieNome,
      poloCultural: item.poloCultural,
      fotoPrincipalUrl: item.fotoPrincipalUrl,
      quantidade: item.quantidade,
      precoUnitario: centavosParaNumero(precoCentavos),
      subtotalItem: centavosParaNumero(subtotalCentavos),
      isFragil: item.isFragil,
    });
  }

  return {
    itensFrete,
    itensSnapshot,
    valorTotalPecasCentavos: somarCentavos(subtotaisCentavos),
  };
}

async function dispararOutboxSobDemanda(outboxRelay?: NotificacaoOutboxRelay): Promise<void> {
  if (outboxRelay) {
    await outboxRelay.processarPendentes(10);
    return;
  }

  const redisAtivo = await pingRedis();
  if (!redisAtivo) {
    return;
  }

  const producer = createNotificationProducer({
    logRepository: prismaNotificacaoLogRepository,
  });
  try {
    const eventosService = createNotificacaoEventosService({
      producer,
      logRepository: prismaNotificacaoLogRepository,
    });
    const relay = createNotificacaoOutboxRelay({
      outboxRepository: prismaNotificacaoOutboxRepository,
      eventosService,
    });
    await relay.processarPendentes(10);
  } finally {
    await producer.fechar();
  }
}

export function createCheckoutPagamentoService(deps?: CheckoutPagamentoServiceDeps) {
  const repository = deps?.repository ?? prismaPedidoPagamentoRepository;
  const freteProvider = deps?.freteProvider ?? createFreteProviderFromEnv();
  const paymentGateway = deps?.paymentGateway ?? createPaymentGatewayFromEnv();
  const freteService = createFreteService(freteProvider);

  function resolverGatewayWebhook(gatewayParam: string): PaymentGatewayPort {
    const peloMapa = deps?.gatewaysPorNome?.get(gatewayParam);
    if (peloMapa) {
      return peloMapa;
    }

    if (paymentGateway.configurado && paymentGateway.nome === gatewayParam) {
      return paymentGateway;
    }

    throw new AppError(
      `Gateway "${gatewayParam}" não está configurado ou ativo para receber webhooks neste ambiente.`,
      503,
      PAGAMENTO_ERROR_CODES.PROVEDOR_PAGAMENTO_NAO_CONFIGURADO,
    );
  }

  function dispararOutboxNaoBloqueante(): void {
    void dispararOutboxSobDemanda(deps?.outboxRelay).catch((err) => {
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'WARN',
          evento: 'HU10_OUTBOX_IMMEDIATE_RELAY_DEFERRED',
          erro: sanitizarErroProvedor(err),
        }),
      );
    });
  }

  return {
    async cotarFreteCheckout(
      usuarioId: string,
      entrada: CotacaoFreteCheckoutInput,
    ): Promise<CotacaoFreteCheckoutResultado> {
      const agora = new Date();
      const grupo = await repository.carregarGrupoReservaAtiva(
        entrada.reservaGrupoId,
        usuarioId,
        agora,
      );

      const { itensFrete, valorTotalPecasCentavos } = mapearItensFreteESnapshot(grupo);
      const frete = await freteService.cotarMultiOrigem(itensFrete, entrada.cepDestino);
      const valorTotalPedidoCentavos = valorTotalPecasCentavos + frete.valorTotalFreteCentavos;

      return {
        reservaGrupoId: grupo.grupoId,
        expiraEm: grupo.expiraEm.toISOString(),
        cepDestino: frete.cepDestino,
        valorTotalPecas: centavosParaNumero(valorTotalPecasCentavos),
        valorTotalFrete: frete.valorTotalFrete,
        valorTotalPedido: centavosParaNumero(valorTotalPedidoCentavos),
        fretesPorOrigem: frete.fretesPorOrigem,
      };
    },

    async criarCheckout(
      usuarioId: string,
      entrada: CheckoutValidado,
      options?: { readonly correlationId?: string; readonly webhookBaseUrl?: string },
    ): Promise<CheckoutResultado> {
      const agora = new Date();

      // 1. Checagem rápida de idempotência sem disparar cobrança duplicada
      const idempotenteExistente = await repository.buscarPorIdempotencyKey(
        usuarioId,
        entrada.idempotencyKey,
      );
      if (idempotenteExistente) {
        if (idempotenteExistente.payloadHash !== entrada.payloadHash) {
          throw new AppError(
            'A chave Idempotency-Key já foi utilizada com dados de checkout diferentes.',
            409,
            PAGAMENTO_ERROR_CODES.CONFLITO_IDEMPOTENCIA,
          );
        }
        return {
          idempotente: true,
          pedido: idempotenteExistente.pedido,
        };
      }

      // 2. Carrega e valida reserva ativa diretamente no PostgreSQL (preços + cubagem + origens reais)
      const grupo = await repository.carregarGrupoReservaAtiva(
        entrada.reservaGrupoId,
        usuarioId,
        agora,
      );

      const { itensFrete, itensSnapshot, valorTotalPecasCentavos } =
        mapearItensFreteESnapshot(grupo);

      // 3. Cotação multi-origem real (ADR-001). Nunca inventa tarifa; falha com 503 se não configurado.
      const frete = await freteService.cotarMultiOrigem(itensFrete, entrada.enderecoEntrega.cep);
      const valorTotalFreteCentavos = frete.valorTotalFreteCentavos;
      const valorTotalPedidoCentavos = valorTotalPecasCentavos + valorTotalFreteCentavos;

      // 4. Verifica gateway configurado antes de abrir pedido
      if (!paymentGateway.configurado) {
        throw new AppError(
          'Gateway de pagamento não configurado neste ambiente. Configure PAYMENT_GATEWAY e as credenciais oficiais antes de realizar pagamentos.',
          503,
          PAGAMENTO_ERROR_CODES.PROVEDOR_PAGAMENTO_NAO_CONFIGURADO,
        );
      }

      if (entrada.metodoPagamento === 'PIX') {
        const segundosRestantes = Math.floor((grupo.expiraEm.getTime() - agora.getTime()) / 1000);
        if (segundosRestantes <= 0) {
          throw new AppError(
            'A reserva expirou antes da geração do Pix.',
            409,
            PAGAMENTO_ERROR_CODES.RESERVA_EXPIRADA,
          );
        }
        if (segundosRestantes < paymentGateway.pixMinExpirationSeconds) {
          throw new AppError(
            `Tempo restante da reserva (${segundosRestantes}s) inferior ao mínimo exigido pelo gateway (${paymentGateway.pixMinExpirationSeconds}s).`,
            422,
            PAGAMENTO_ERROR_CODES.GATEWAY_EXPIRACAO_INCOMPATIVEL,
          );
        }
      }

      // 5. Persiste pedido + tentativa de pagamento ANTES da chamada externa para prevenir cobrança órfã
      const inicio = await repository.iniciarPedidoEPagamentoAntesGateway({
        usuarioId,
        reservaGrupoId: entrada.reservaGrupoId,
        idempotencyKey: entrada.idempotencyKey,
        payloadHash: entrada.payloadHash,
        metodoPagamento: entrada.metodoPagamento,
        gateway: paymentGateway.nome,
        ambiente: paymentGateway.ambiente,
        enderecoEntregaId: entrada.enderecoEntregaId,
        enderecoEntrega: entrada.enderecoEntrega,
        parcelas: entrada.cartao?.parcelas ?? 1,
        bandeiraCartao: entrada.cartao?.bandeira,
        ultimosDigitosCartao: entrada.cartao?.ultimosDigitos,
        grupoReserva: grupo,
        fretesPorOrigem: frete.fretesPorOrigem,
        valorTotalPecasCentavos,
        valorTotalFreteCentavos,
        valorTotalPedidoCentavos,
        itensSnapshot,
        agora,
      });

      if (inicio.jaExistiaPorIdempotencia) {
        if (inicio.payloadHash !== entrada.payloadHash) {
          throw new AppError(
            'A chave Idempotency-Key já foi utilizada com dados de checkout diferentes.',
            409,
            PAGAMENTO_ERROR_CODES.CONFLITO_IDEMPOTENCIA,
          );
        }
        return {
          idempotente: true,
          pedido: inicio.pedido,
        };
      }

      const { iniciado } = inicio;
      const gatewayPayloadBase = {
        pedidoId: iniciado.pedidoId,
        pagamentoId: iniciado.pagamentoId,
        codigoPedido: iniciado.codigoPedido,
        reservaGrupoId: grupo.grupoId,
        idempotencyKey: iniciado.pagamentoIdempotencyKey,
        valorCentavos: valorTotalPedidoCentavos,
        valorFreteCentavos: valorTotalFreteCentavos,
        expiraEm: grupo.expiraEm,
        agora: new Date(),
        comprador: {
          usuarioId: grupo.comprador.usuarioId,
          nome: entrada.enderecoEntrega.nomeDestinatario || grupo.comprador.nome,
          email: entrada.enderecoEntrega.email || grupo.comprador.email,
          cpfCnpj: grupo.comprador.cpfCnpj,
          telefone: entrada.enderecoEntrega.telefone || grupo.comprador.telefoneWhatsapp,
        },
        enderecoEntrega: {
          cep: entrada.enderecoEntrega.cep,
          logradouro: entrada.enderecoEntrega.logradouro,
          numero: entrada.enderecoEntrega.numero,
          complemento: entrada.enderecoEntrega.complemento,
          bairro: entrada.enderecoEntrega.bairro,
          cidade: entrada.enderecoEntrega.cidade,
          uf: entrada.enderecoEntrega.uf,
        },
        itens: grupo.itens.map((item) => ({
          pecaId: item.pecaId,
          titulo: item.titulo,
          quantidade: item.quantidade,
          precoUnitarioCentavos: decimalParaCentavos(item.precoUnitarioString),
        })),
        webhookUrl: options?.webhookBaseUrl
          ? `${options.webhookBaseUrl.replace(/\/+$/, '')}/api/v1/pagamentos/webhook/${paymentGateway.nome}`
          : undefined,
      };

      // 6. Chamada ao gateway fora da transação SQL
      let resultadoGateway: ResultadoCriacaoPagamentoGateway;
      try {
        if (entrada.metodoPagamento === 'PIX') {
          resultadoGateway = await paymentGateway.criarPagamentoPix(gatewayPayloadBase);
        } else {
          resultadoGateway = await paymentGateway.criarPagamentoCartao({
            ...gatewayPayloadBase,
            cardToken: entrada.cartao!.token,
            parcelas: entrada.cartao!.parcelas,
            bandeira: entrada.cartao!.bandeira,
            ultimosDigitos: entrada.cartao!.ultimosDigitos,
          });
        }
      } catch (err) {
        if (err instanceof PaymentGatewayError) {
          await repository.registrarErroGatewayNoCheckout({
            pedidoId: iniciado.pedidoId,
            pagamentoId: iniciado.pagamentoId,
            resultadoDesconhecido: err.resultadoDesconhecido,
            motivoSanitizado: err.message,
            devolverReservaSeDefinitivo:
              !err.resultadoDesconhecido && !err.transient && err.statusHttp < 500,
            agora: new Date(),
          });
          throw new AppError(err.message, err.statusHttp, err.codigo);
        }

        const msgSanitizada = sanitizarErroProvedor(err);
        await repository.registrarErroGatewayNoCheckout({
          pedidoId: iniciado.pedidoId,
          pagamentoId: iniciado.pagamentoId,
          resultadoDesconhecido: true,
          motivoSanitizado: msgSanitizada,
          devolverReservaSeDefinitivo: false,
          agora: new Date(),
        });
        throw new AppError(
          'Falha inesperada ao comunicar com o gateway de pagamento. Consulte o status do pedido antes de tentar novamente.',
          502,
          PAGAMENTO_ERROR_CODES.GATEWAY_TIMEOUT_RESULTADO_DESCONHECIDO,
        );
      }

      // 7. Registra desfecho autoritativo retornado pelo gateway (com lock anti-corrida vs webhook)
      const finalizado = await repository.registrarResultadoGatewayNoCheckout({
        pedidoId: iniciado.pedidoId,
        pagamentoId: iniciado.pagamentoId,
        resultado: resultadoGateway,
        agora: new Date(),
        correlationId: options?.correlationId,
      });

      if (finalizado.outboxRegistrado) {
        dispararOutboxNaoBloqueante();
      }

      return {
        idempotente: false,
        pedido: finalizado.pedido,
      };
    },

    async processarWebhook(input: ProcessarWebhookInput): Promise<ProcessamentoWebhookResultado> {
      const gateway = resolverGatewayWebhook(input.gatewayParam);
      const evento = gateway.validarEInterpretarWebhook({
        headers: input.headers,
        query: input.query,
        rawBody: input.rawBody,
        body: input.body,
      });

      // Segurança: rejeita imediatamente sem registrar payload não autenticado na chave única de deduplicação
      if (!evento.assinaturaValida) {
        console.warn(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'WARN',
            evento: 'HU10_WEBHOOK_ASSINATURA_INVALIDA',
            gateway: gateway.nome,
            correlationId: input.correlationId ?? null,
          }),
        );
        throw new AppError(
          evento.motivoAssinaturaInvalida ?? 'Assinatura de webhook inválida.',
          401,
          PAGAMENTO_ERROR_CODES.WEBHOOK_ASSINATURA_INVALIDA,
        );
      }

      if (!evento.eventoExternoId || !evento.externalPaymentId) {
        throw new AppError(
          'Webhook sem identificadores mínimos obrigatórios (eventoExternoId / externalPaymentId).',
          422,
          PAGAMENTO_ERROR_CODES.WEBHOOK_PAYLOAD_INVALIDO,
        );
      }

      // Consulta autoritativa direta ao gateway (nunca confia cegamente no status do webhook)
      let consultaAutoritativa;
      try {
        consultaAutoritativa = await gateway.consultarPagamento(evento.externalPaymentId);
      } catch (err) {
        if (err instanceof PaymentGatewayError) {
          throw new AppError(err.message, err.statusHttp, err.codigo);
        }
        throw new AppError(
          'Falha ao consultar transação autoritativa no gateway.',
          503,
          PAGAMENTO_ERROR_CODES.GATEWAY_INDISPONIVEL,
        );
      }

      const rawBuffer =
        input.rawBody.length > 0
          ? input.rawBody
          : Buffer.from(JSON.stringify(input.body ?? {}), 'utf8');
      const payloadHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');

      const resultado = await repository.processarWebhookAtomico({
        gateway: gateway.nome,
        evento,
        payloadHash,
        consultaAutoritativa,
        agora: new Date(),
        correlationId: input.correlationId,
      });

      if (resultado.outboxRegistrado) {
        dispararOutboxNaoBloqueante();
      }

      return resultado;
    },

    async listarMeusPedidos(usuarioId: string, limite = 25): Promise<PedidoDetalhado[]> {
      return repository.listarPedidosUsuario(usuarioId, limite);
    },

    async obterPedidoPorId(
      usuarioId: string,
      filtro: { readonly tipo: 'id' | 'codigoPedido'; readonly valor: string },
    ): Promise<PedidoDetalhado> {
      const pedido = await repository.buscarPedidoUsuarioPorIdOuCodigo(usuarioId, filtro);
      if (
        pedido.status === 'PENDENTE_PAGAMENTO' &&
        pedido.pagamentoAtual?.expiraEm &&
        new Date(pedido.pagamentoAtual.expiraEm).getTime() <= Date.now()
      ) {
        return repository.marcarExpiracaoReservaExpirada(pedido.id, usuarioId, new Date());
      }
      return pedido;
    },
  };
}

export type CheckoutPagamentoService = ReturnType<typeof createCheckoutPagamentoService>;
export const checkoutPagamentoService = createCheckoutPagamentoService();
