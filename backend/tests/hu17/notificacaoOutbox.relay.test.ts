import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import type {
  NotificacaoOutboxRepository,
  OutboxEventoNotificacao,
} from '../../src/repositories/contracts/notificacaoOutbox.contracts.js';
import { createNotificacaoOutboxRelay } from '../../src/services/notificacaoOutbox.relay.js';

describe('HU-17 — Relay desacoplado de Outbox Transacional (HU-10 / HU-12)', () => {
  it('processa PagamentoAprovado e AtualizacaoStatusPedido do outbox e isola falhas parciais com erro sanitizado', async () => {
    const publicacoesPagamento: string[] = [];
    const publicacoesStatus: string[] = [];
    const marcadosPublicados: string[] = [];
    const falhasRegistradas: Array<{ id: string; erro: string }> = [];

    const pedidoOkId = randomUUID();
    const pedidoFalhaId = randomUUID();
    const pedidoStatusId = randomUUID();

    const pendentes: OutboxEventoNotificacao[] = [
      {
        id: 'outbox-1',
        tipoEvento: 'PagamentoAprovado',
        aggregateId: pedidoOkId,
        idempotencyKey: `outbox_pgto_${pedidoOkId}`,
        payload: { pedidoId: pedidoOkId },
        publicadoEm: null,
        tentativasPublicacao: 0,
        criadoEm: new Date(),
      },
      {
        id: 'outbox-2',
        tipoEvento: 'PagamentoAprovado',
        aggregateId: pedidoFalhaId,
        idempotencyKey: `outbox_pgto_${pedidoFalhaId}`,
        payload: { pedidoId: pedidoFalhaId },
        publicadoEm: null,
        tentativasPublicacao: 0,
        criadoEm: new Date(),
      },
      {
        id: 'outbox-3',
        tipoEvento: 'AtualizacaoStatusPedido',
        aggregateId: pedidoStatusId,
        idempotencyKey: `outbox_status_${pedidoStatusId}`,
        payload: { pedidoId: pedidoStatusId },
        publicadoEm: null,
        tentativasPublicacao: 0,
        criadoEm: new Date(),
      },
    ];

    const outboxRepo: NotificacaoOutboxRepository = {
      async registrarNaMesmaTransacao() {},
      async listarPendentes() {
        return pendentes;
      },
      async marcarPublicado(id) {
        marcadosPublicados.push(id);
      },
      async registrarFalhaPublicacao(id, erroSanitizado) {
        falhasRegistradas.push({ id, erro: erroSanitizado });
      },
    };

    const relay = createNotificacaoOutboxRelay({
      outboxRepository: outboxRepo,
      eventosService: {
        async publicarPagamentoAprovado(evento) {
          if (evento.pedidoId === pedidoFalhaId) {
            throw new Error('Redis timeout Bearer segredo-123 para cliente@origem.local');
          }
          publicacoesPagamento.push(evento.pedidoId);
          return {
            eventoOrigem: 'PagamentoAprovado',
            pedidoId: evento.pedidoId,
            notificacoesEnfileiradas: 2,
            notificacoesDuplicadas: 0,
            notificacoesIgnoradas: 0,
            resultados: [],
          };
        },
        async publicarAtualizacaoStatusPedido(evento) {
          publicacoesStatus.push(evento.pedidoId);
          return {
            eventoOrigem: 'AtualizacaoStatusPedido',
            pedidoId: evento.pedidoId,
            notificacoesEnfileiradas: 1,
            notificacoesDuplicadas: 0,
            notificacoesIgnoradas: 0,
            resultados: [],
          };
        },
      },
    });

    const resumo = await relay.processarPendentes(10);

    assert.equal(resumo.lidos, 3);
    assert.equal(resumo.publicados, 2);
    assert.equal(resumo.falhas, 1);
    assert.deepEqual(publicacoesPagamento, [pedidoOkId]);
    assert.deepEqual(publicacoesStatus, [pedidoStatusId]);
    assert.deepEqual(marcadosPublicados, ['outbox-1', 'outbox-3']);
    assert.equal(falhasRegistradas.length, 1);
    assert.equal(falhasRegistradas[0].id, 'outbox-2');
    assert.equal(falhasRegistradas[0].erro.includes('segredo-123'), false);
    assert.equal(falhasRegistradas[0].erro.includes('cliente@origem.local'), false);
  });
});
