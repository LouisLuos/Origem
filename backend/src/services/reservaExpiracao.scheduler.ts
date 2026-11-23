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
 * Rotina periódica em backend para expirar reservas não confirmadas após 15 minutos e devolver
 * o estoque ao PostgreSQL mesmo quando não há usuários acessando a aplicação.
 *
 * Condições operacionais para produção:
 * 1. O processo Node precisa rodar de forma contínua (ou, em ambientes serverless / multi-réplica,
 *    um cron externo ou `pg_cron` deve disparar `expirarVencidas()` periodicamente).
 * 2. Cada ciclo é protegido contra sobreposição em memória e seguro para concorrência no banco
 *    via locks pessimistas ordenados (`ORDER BY peca_id ASC FOR UPDATE`) e transição atômica
 *    `WHERE status = 'ATIVA' AND expira_em <= NOW()`, evitando devolução duplicada entre réplicas.
 * 3. Como camada adicional de segurança, tentativas de reserva ou confirmação também executam
 *    expiração lazy imediata caso o cron ainda não tenha rodado naquele segundo.
 */
export function iniciarAgendadorExpiracaoReservas(opcoes?: {
  readonly service?: Pick<ReservaEstoqueService, 'expirarVencidas'>;
  readonly intervaloMs?: number;
}): AgendadorExpiracaoReservas {
  const service = opcoes?.service ?? reservaEstoqueService;
  const intervaloMs = opcoes?.intervaloMs ?? INTERVALO_VARREDURA_EXPIRACAO_MS;
  let emExecucao = false;
  let encerrado = false;

  async function executarVarredura(): Promise<void> {
    if (emExecucao || encerrado) return;
    emExecucao = true;
    try {
      const resultado = await service.expirarVencidas();
      if (resultado.reservasExpiradas > 0) {
        console.info(
          `⏳ Expiração automática HU-06: ${resultado.reservasExpiradas} reserva(s) expirada(s), ${resultado.unidadesDevolvidas} unidade(s) devolvida(s).`,
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
