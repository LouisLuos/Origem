import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import type {
  NotificacaoOutboxRepository,
  OutboxEventoNotificacao,
} from '../../src/repositories/contracts/notificacaoOutbox.contracts.js';
import {
  createNotificacaoOutboxRelay,
  iniciarLoopOutboxRelay,
} from '../../src/services/notificacaoOutbox.relay.js';

describe('HU-17 — Loop periódico e recuperação de falhas do Outbox Relay', () => {
  it('recupera evento FALHA -> PUBLICADO quando fila retorna e impede execuções concorrentes sobrepostas', async () => {
    const pedidoId = randomUUID();
    const registros = new Map<string, OutboxEventoNotificacao & { status: 'PENDENTE' | 'FALHA' | 'PUBLICADO'; erro?: string }>([
      [
        'evt-1',
        {
          id: 'evt-1',
          tipoEvento: 'PagamentoAprovado',
          aggregateId: pedidoId,
          idempotencyKey: `outbox_${pedidoId}`,
          payload: { pedidoId },
          publicadoEm: null,
          tentativasPublicacao: 0,
          criadoEm: new Date(),
          status: 'PENDENTE',
        },
      ],
    ]);

    let redisDisponivel = false;
    let execucoesSimultaneas = 0;
    let maxConcorrenciaObservada = 0;

    const repo: NotificacaoOutboxRepository = {
      async registrarNaMesmaTransacao() {},
      async listarPendentes() {
        return Array.from(registros.values()).filter(
          (r) => r.status === 'PENDENTE' || r.status === 'FALHA',
        );
      },
      async marcarPublicado(id, publicadoEm = new Date()) {
        const atual = registros.get(id)!;
        registros.set(id, { ...atual, status: 'PUBLICADO', publicadoEm });
      },
      async registrarFalhaPublicacao(id, erro) {
        const atual = registros.get(id)!;
        registros.set(id, {
          ...atual,
          status: 'FALHA',
          tentativasPublicacao: atual.tentativasPublicacao + 1,
          erro,
        });
      },
    };

    const relay = createNotificacaoOutboxRelay({
      outboxRepository: repo,
      eventosService: {
        async publicarPagamentoAprovado() {
          execucoesSimultaneas += 1;
          maxConcorrenciaObservada = Math.max(maxConcorrenciaObservada, execucoesSimultaneas);
          await new Promise((r) => setTimeout(r, 35));
          execucoesSimultaneas -= 1;

          if (!redisDisponivel) {
            throw new Error('Redis indisponivel Bearer secret_token_123');
          }
          return {
            eventoOrigem: 'PagamentoAprovado',
            pedidoId,
            notificacoesEnfileiradas: 1,
            notificacoesDuplicadas: 0,
            notificacoesIgnoradas: 0,
            resultados: [],
          };
        },
        async publicarAtualizacaoStatusPedido() {
          throw new Error('Não esperado');
        },
      },
    });

    const loop = iniciarLoopOutboxRelay({ relay, intervalMs: 500 });
    try {
      // 1) Dispara duas chamadas simultâneas enquanto Redis está fora -> apenas 1 executa por vez, registra FALHA sanitizada
      await Promise.all([loop.executarAgora(), loop.executarAgora()]);
      assert.equal(maxConcorrenciaObservada, 1);

      const aposFalha = registros.get('evt-1')!;
      assert.equal(aposFalha.status, 'FALHA');
      assert.equal(aposFalha.tentativasPublicacao, 1);
      assert.equal(aposFalha.erro?.includes('secret_token_123'), false);

      // 2) Redis volta -> próximo ciclo promove FALHA -> PUBLICADO sem duplicidade
      redisDisponivel = true;
      await loop.executarAgora();

      const aposRecuperacao = registros.get('evt-1')!;
      assert.equal(aposRecuperacao.status, 'PUBLICADO');
      assert.ok(aposRecuperacao.publicadoEm);

      // 3) Terceira chamada não encontra mais pendentes
      await loop.executarAgora();
      assert.equal(aposRecuperacao.tentativasPublicacao, 1);
    } finally {
      loop.parar();
    }
  });
});
