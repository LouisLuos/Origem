import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import type { NotificacaoLogRepository } from '../../src/repositories/contracts/notificacoes.contracts.js';
import { unconfiguredNotificacaoLogRepository } from '../../src/repositories/unconfiguredNotificacaoLog.repository.js';
import { createNotificacaoRoutes } from '../../src/routes/notificacao.routes.js';

const USER_COMPRADOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function comServidorTeste(
  app: express.Express,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('HU-17 — Rotas HTTP de auditoria de notificações do usuário', () => {
  it('exige autenticação (401) e retorna apenas registros mascarados do usuário autenticado', async () => {
    let usuarioConsultado = '';
    const logRepoMock: NotificacaoLogRepository = {
      ...unconfiguredNotificacaoLogRepository,
      async listarPorUsuario(usuarioId) {
        usuarioConsultado = usuarioId;
        return [
          {
            id: '11111111-1111-4111-8111-111111111111',
            eventoOrigem: 'PagamentoAprovado',
            pedidoId: '22222222-2222-4222-8222-222222222222',
            subpedidoId: null,
            usuarioId,
            atelieId: null,
            destinatario: 'an***@origem.local',
            canal: 'EMAIL',
            template: 'PAGAMENTO_APROVADO_COMPRADOR',
            status: 'ENVIADA',
            tentativas: 1,
            maxTentativas: 3,
            provedor: 'http_webhook',
            provedorMensagemId: 'msg-1',
            erroCodigo: null,
            erroSanitizado: null,
            idempotencyKey: 'pgto_comprador_abc',
            jobId: 'pgto_comprador_abc',
            correlationId: null,
            criadoEm: new Date('2026-11-22T20:00:00.000Z'),
            ultimaTentativaEm: new Date('2026-11-22T20:00:01.000Z'),
            proximaTentativaEm: null,
            enviadoEm: new Date('2026-11-22T20:00:02.000Z'),
            atualizadoEm: new Date('2026-11-22T20:00:02.000Z'),
          },
        ];
      },
    };

    const authProvider: AuthIdentityProvider = {
      async verify({ bearerToken }) {
        return bearerToken === 'tok-comprador'
          ? {
              status: 'AUTHENTICATED',
              identity: { userId: USER_COMPRADOR },
            }
          : {
              status: 'UNAUTHENTICATED',
              reason: 'Credencial ausente ou inválida.',
            };
      },
    };

    const app = express();
    app.use(
      '/notificacoes',
      createNotificacaoRoutes({
        authProvider,
        logRepository: logRepoMock,
      }),
    );
    app.use(errorHandler);

    await comServidorTeste(app, async (baseUrl) => {
      const semAuth = await fetch(`${baseUrl}/notificacoes/minhas`);
      assert.equal(semAuth.status, 401);

      const ok = await fetch(`${baseUrl}/notificacoes/minhas?limit=10`, {
        headers: { Authorization: 'Bearer tok-comprador' },
      });
      assert.equal(ok.status, 200);
      assert.equal(usuarioConsultado, USER_COMPRADOR);

      const body = (await ok.json()) as {
        dados: Array<{ destinatario: string; status: string }>;
      };
      assert.equal(body.dados.length, 1);
      assert.equal(body.dados[0].destinatario, 'an***@origem.local');
      assert.equal(body.dados[0].status, 'ENVIADA');
    });
  });
});
