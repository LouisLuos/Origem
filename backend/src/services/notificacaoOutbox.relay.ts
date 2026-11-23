import type {
  NotificacaoOutboxRelay,
  NotificacaoOutboxRepository,
} from '../repositories/contracts/notificacaoOutbox.contracts.js';
import type { NotificacaoEventosService } from './notificacaoEventos.service.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';
import type {
  EventoAtualizacaoStatusPedido,
  EventoPagamentoAprovado,
} from '../validators/notificacao.validator.js';

/**
 * Relay desacoplado do padrão Outbox Transacional (integração futura com HU-10/HU-12).
 * Lê eventos gravados na mesma transação do pedido e publica de forma idempotente no hub
 * de notificações sem bloquear o commit do banco e sem derrubar o lote se um item falhar.
 */
export function createNotificacaoOutboxRelay(deps: {
  readonly outboxRepository: NotificacaoOutboxRepository;
  readonly eventosService: Pick<
    NotificacaoEventosService,
    'publicarPagamentoAprovado' | 'publicarAtualizacaoStatusPedido'
  >;
}): NotificacaoOutboxRelay {
  return {
    async processarPendentes(limite = 50) {
      const pendentes = await deps.outboxRepository.listarPendentes(limite);
      let publicados = 0;
      let falhas = 0;

      for (const registro of pendentes) {
        try {
          if (registro.tipoEvento === 'PagamentoAprovado') {
            await deps.eventosService.publicarPagamentoAprovado(
              registro.payload as EventoPagamentoAprovado,
            );
          } else if (registro.tipoEvento === 'AtualizacaoStatusPedido') {
            await deps.eventosService.publicarAtualizacaoStatusPedido(
              registro.payload as EventoAtualizacaoStatusPedido,
            );
          } else {
            throw new Error(`Tipo de evento outbox desconhecido: ${String(registro.tipoEvento)}`);
          }

          await deps.outboxRepository.marcarPublicado(registro.id, new Date());
          publicados += 1;
        } catch (err) {
          falhas += 1;
          await deps.outboxRepository.registrarFalhaPublicacao(
            registro.id,
            sanitizarErroProvedor(err),
          );
        }
      }

      return {
        lidos: pendentes.length,
        publicados,
        falhas,
      };
    },
  };
}

export function iniciarLoopOutboxRelay(params: {
  readonly relay: NotificacaoOutboxRelay;
  readonly intervalMs: number;
  readonly limitePorCiclo?: number;
  readonly onErro?: (erroSanitizado: string) => void;
}): { readonly executarAgora: () => Promise<void>; readonly parar: () => void } {
  let emExecucao = false;
  let parado = false;

  const executarAgora = async (): Promise<void> => {
    if (emExecucao || parado) {
      return;
    }
    emExecucao = true;
    try {
      await params.relay.processarPendentes(params.limitePorCiclo ?? 50);
    } catch (err) {
      params.onErro?.(sanitizarErroProvedor(err));
    } finally {
      emExecucao = false;
    }
  };

  const timer = setInterval(() => {
    void executarAgora();
  }, Math.max(200, params.intervalMs));
  timer.unref?.();

  return {
    executarAgora,
    parar() {
      parado = true;
      clearInterval(timer);
    },
  };
}
