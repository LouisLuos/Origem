import { prismaPedidoPagamentoRepository } from '../repositories/prismaPedidoPagamento.repository.js';
import {
  reservaEstoqueService,
  type ReservaEstoqueService,
} from './reservaEstoque.service.js';

export const INTERVALO_VARREDURA_EXPIRACAO_MS = 60_000;

export interface AgendadorExpiracaoReservas {
  executarVarredura(): Promise<void>;
  parar(): void;
}

/**
 * Rotina periódica em backend para expirar reservas e pedidos pendentes vencidos após 15 minutos,
 * devolvendo o estoque ao PostgreSQL mesmo quando não há usuários acessando a aplicação.
 *
 * Condições operacionais para produção:
 * 1. O processo Node precisa rodar de forma contínua (ou, em ambientes serverless / multi-réplica,
 *    um cron externo ou `pg_cron` deve disparar `expirarVencidas()` periodicamente).
 * 2. Cada ciclo é protegido contra sobreposição em memória e seguro para concorrência no banco
 *    via locks pessimistas ordenados (`ORDER BY peca_id ASC FOR UPDATE`) e transição atômica
 *    `WHERE status = 'ATIVA' AND expira_em <= NOW()`, evitando devolução duplicada entre réplicas.
 * 3. Como camada adicional de segurança, tentativas de reserva, confirmação ou consulta de pedidos
 *    também executam expiração lazy imediata caso o cron ainda não tenha rodado naquele segundo.
 */
export function iniciarAgendadorExpiracaoReservas(opcoes?: {
  readonly service?: Pick<ReservaEstoqueService, 'expirarVencidas'>;
  readonly expirarPedidosVencidos?: (
    agora?: Date,
  ) => Promise<{ readonly pedidosExpirados: number; readonly unidadesDevolvidas: number }>;
  readonly intervaloMs?: number;
}): AgendadorExpiracaoReservas {
  const service = opcoes?.service ?? reservaEstoqueService;
  const expirarPedidosVencidos =
    opcoes?.expirarPedidosVencidos ??
    (opcoes?.service
      ? undefined
      : (agora?: Date) => prismaPedidoPagamentoRepository.expirarPedidosPendentesVencidos(agora));
  const intervaloMs = opcoes?.intervaloMs ?? INTERVALO_VARREDURA_EXPIRACAO_MS;
  let emExecucao = false;
  let encerrado = false;

  async function executarVarredura(): Promise<void> {
    if (emExecucao || encerrado) return;
    emExecucao = true;
    try {
      const resultado = await service.expirarVencidas();
      const resultadoPedidos = expirarPedidosVencidos
        ? await expirarPedidosVencidos(new Date())
        : { pedidosExpirados: 0, unidadesDevolvidas: 0 };

      if (resultado.reservasExpiradas > 0 || resultadoPedidos.pedidosExpirados > 0) {
        console.info(
          `⏳ Expiração automática HU-06/HU-10: ${resultado.reservasExpiradas} reserva(s) expirada(s), ${resultadoPedidos.pedidosExpirados} pedido(s) pendente(s) expirado(s), ${resultado.unidadesDevolvidas + resultadoPedidos.unidadesDevolvidas} unidade(s) devolvida(s).`,
        );
      }
    } catch (err) {
      console.error('⚠️ Falha na rotina periódica de expiração de reservas:', {
        erro: err instanceof Error ? err.message : typeof err,
      });
    } finally {
      emExecucao = false;
    }
  }

  const timer = setInterval(() => {
    void executarVarredura();
  }, intervaloMs);
  timer.unref();

  return {
    executarVarredura,
    parar() {
      encerrado = true;
      clearInterval(timer);
    },
  };
}
