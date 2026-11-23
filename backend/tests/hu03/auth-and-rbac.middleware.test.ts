import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createAuthMiddleware } from '../../src/middlewares/auth.middleware.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { createAtelierRbacMiddleware } from '../../src/middlewares/rbac.middleware.js';
import { requestLogger } from '../../src/middlewares/requestLogger.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import type {
  AtelieAutorizacaoRepository,
  RelacionamentoUsuarioAtelie,
} from '../../src/repositories/contracts/hu03.contracts.js';
import {
  ATELIE_ERROR_CODES,
  unconfiguredAtelieAutorizacaoRepository,
  unconfiguredAuthIdentityProvider,
} from '../../src/repositories/unconfiguredHu03.repository.js';
import {
  createSecurityAuditService,
  type SecurityAuditEvent,
} from '../../src/utils/securityAudit.util.js';

interface TestServerHandle {
  baseUrl: string;
  close: () => Promise<void>;
  getProtectedCalls: () => number;
  getAuditEvents: () => SecurityAuditEvent[];
}

async function startMiddlewareTestServer(options: {
  authProvider?: AuthIdentityProvider;
  autorizacaoRepository?: AtelieAutorizacaoRepository;
  failingAuditSink?: boolean;
  skipAuthMiddlewareOnCatalog?: boolean;
}): Promise<TestServerHandle> {
  const app = express();
  app.use(express.json());
  app.use(requestLogger);

  let protectedCalls = 0;
  const auditEvents: SecurityAuditEvent[] = [];

  const auditService = createSecurityAuditService({
    record(event) {
      if (options.failingAuditSink) {
        throw new Error('Erro simulado no logger externo');
      }
      auditEvents.push(event);
    },
  });

  const authenticate = createAuthMiddleware(options.authProvider);
  const requirePerm = createAtelierRbacMiddleware({
    autorizacaoRepository: options.autorizacaoRepository,
    auditService,
  });

  const spyHandler = (req: Request, res: Response) => {
    protectedCalls += 1;
    res.status(200).json({
      ok: true,
      userId: req.auth?.userId ?? null,
      atelierAccess: req.atelierAccess ?? null,
    });
  };

  app.patch('/atelies/:atelieId/chave-pix', authenticate, requirePerm('ALTERAR_CHAVE_PIX'), spyHandler);
  app.get('/atelies/:atelieId/financeiro', authenticate, requirePerm('CONSULTAR_DADOS_FINANCEIROS'), spyHandler);
  app.post('/atelies/:atelieId/curadores', authenticate, requirePerm('GERENCIAR_CURADORES'), spyHandler);
  app.post('/atelies/:atelieId/catalogo', authenticate, requirePerm('GERENCIAR_CATALOGO'), spyHandler);
  app.post('/atelies/:atelieId/etiquetas', authenticate, requirePerm('GERENCIAR_ETIQUETAS'), spyHandler);

  // Rota auxiliar para validar defesa em profundidade quando RBAC for montado sem req.auth
  app.post('/sem-auth/:atelieId/etiquetas', requirePerm('GERENCIAR_ETIQUETAS'), spyHandler);

  app.use(
    (err: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(err, req, res, next),
  );

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Falha ao resolver porta efêmera de teste.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
    getProtectedCalls: () => protectedCalls,
    getAuditEvents: () => auditEvents,
  };
}

function createTokenMapAuthProvider(tokens: Record<string, string>): AuthIdentityProvider {
  return {
    async verify(credentials) {
      if (credentials.bearerToken && tokens[credentials.bearerToken]) {
        return {
          status: 'AUTHENTICATED',
          identity: {
            userId: tokens[credentials.bearerToken],
            email: `${tokens[credentials.bearerToken]}@origem.test`,
          },
        };
      }
      return { status: 'UNAUTHENTICATED', reason: 'Token inválido ou expirado.' };
    },
  };
}

function createInMemoryAuthzRepoForTests(
  table: Record<string, RelacionamentoUsuarioAtelie>,
): AtelieAutorizacaoRepository {
  return {
    async findRelacionamentoUsuarioAtelie(usuarioId, atelieId) {
      return table[`${usuarioId}:${atelieId}`] ?? null;
    },
    async listRelacionamentosUsuario(usuarioId) {
      return Object.entries(table)
        .filter(([key]) => key.startsWith(`${usuarioId}:`))
        .map(([, value]) => value);
    },
  };
}

describe('Etapa C3 — Middleware de autenticação desacoplado (401 e 503)', () => {
  it('retorna 401 sem credencial, com header malformado ou token inválido (ignorando spoofing)', async () => {
    const server = await startMiddlewareTestServer({
      authProvider: createTokenMapAuthProvider({ 'token-valido': 'user-1' }),
      autorizacaoRepository: createInMemoryAuthzRepoForTests({
        'user-1:atelie-1': {
          atelieId: 'atelie-1',
          statusAtelie: 'ATIVO',
          ehTitular: true,
          ehCuradorVinculado: false,
        },
      }),
    });

    try {
      // 1. Sem credencial, mesmo com headers/body falsos de papel e titularidade
      const resNoAuth = await fetch(`${server.baseUrl}/atelies/atelie-1/chave-pix`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-1',
          'x-user-role': 'ARTESAO',
        },
        body: JSON.stringify({ role: 'ARTESAO', ehTitular: true, chavePix: '52998224725' }),
      });
      assert.equal(resNoAuth.status, 401);

      // 2. Esquema Basic / Bearer malformado
      for (const badAuth of ['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'Token abc']) {
        const resMalformed = await fetch(`${server.baseUrl}/atelies/atelie-1/chave-pix`, {
          method: 'PATCH',
          headers: { Authorization: badAuth },
        });
        assert.equal(resMalformed.status, 401);
      }

      // 3. Token rejeitado pelo provedor
      const resInvalid = await fetch(`${server.baseUrl}/atelies/atelie-1/chave-pix`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer token-invalido' },
      });
      assert.equal(resInvalid.status, 401);

      // 4. Defesa em profundidade quando RBAC é acionado sem req.auth
      const resNoReqAuth = await fetch(`${server.baseUrl}/sem-auth/atelie-1/etiquetas`, {
        method: 'POST',
      });
      assert.equal(resNoReqAuth.status, 401);

      assert.equal(server.getProtectedCalls(), 0);
    } finally {
      await server.close();
    }
  });

  it('retorna 503 fail-closed quando o provedor de autenticação não está configurado ou lança exceção', async () => {
    const unconfiguredServer = await startMiddlewareTestServer({
      authProvider: unconfiguredAuthIdentityProvider,
    });

    const crashingServer = await startMiddlewareTestServer({
      authProvider: {
        async verify() {
          throw new Error('Falha de conexão com serviço de identidade');
        },
      },
    });

    try {
      const r1 = await fetch(`${unconfiguredServer.baseUrl}/atelies/atelie-1/financeiro`, {
        headers: { Authorization: 'Bearer algum-token' },
      });
      assert.equal(r1.status, 503);
      const b1 = (await r1.json()) as { codigo?: string };
      assert.equal(b1.codigo, ATELIE_ERROR_CODES.AUTENTICACAO_INDISPONIVEL);
      assert.equal(unconfiguredServer.getProtectedCalls(), 0);

      const r2 = await fetch(`${crashingServer.baseUrl}/atelies/atelie-1/financeiro`, {
        headers: { Authorization: 'Bearer algum-token' },
      });
      assert.equal(r2.status, 503);
      assert.equal(crashingServer.getProtectedCalls(), 0);
    } finally {
      await unconfiguredServer.close();
      await crashingServer.close();
    }
  });
});

describe('Etapa C3 — RBAC contextual por ateliê, persistência indisponível (503) e auditoria (403)', () => {
  it('retorna 503 (nunca 403) quando a persistência está indisponível', async () => {
    const unconfiguredRepoServer = await startMiddlewareTestServer({
      authProvider: createTokenMapAuthProvider({ 'token-u1': 'user-1' }),
      autorizacaoRepository: unconfiguredAtelieAutorizacaoRepository,
    });

    const errorRepoServer = await startMiddlewareTestServer({
      authProvider: createTokenMapAuthProvider({ 'token-u1': 'user-1' }),
      autorizacaoRepository: {
        async findRelacionamentoUsuarioAtelie() {
          throw new Error('ECONNREFUSED postgres');
        },
        async listRelacionamentosUsuario() {
          return [];
        },
      },
    });

    try {
      const r1 = await fetch(`${unconfiguredRepoServer.baseUrl}/atelies/atelie-1/chave-pix`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer token-u1' },
      });
      assert.equal(r1.status, 503);
      const b1 = (await r1.json()) as { codigo?: string };
      assert.equal(b1.codigo, ATELIE_ERROR_CODES.PERSISTENCIA_INDISPONIVEL);
      assert.equal(unconfiguredRepoServer.getProtectedCalls(), 0);

      const r2 = await fetch(`${errorRepoServer.baseUrl}/atelies/atelie-1/catalogo`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-u1' },
      });
      assert.equal(r2.status, 503);
      assert.equal(errorRepoServer.getProtectedCalls(), 0);
    } finally {
      await unconfiguredRepoServer.close();
      await errorRepoServer.close();
    }
  });

  it('bloqueia curador em operações financeiras e gestão de curadores com HTTP 403 e auditoria sem segredos', async () => {
    const server = await startMiddlewareTestServer({
      authProvider: createTokenMapAuthProvider({ 'token-curador': 'user-curador' }),
      autorizacaoRepository: createInMemoryAuthzRepoForTests({
        'user-curador:atelie-1': {
          atelieId: 'atelie-1',
          nomeComercial: 'Ateliê Alto do Moura',
          statusAtelie: 'ATIVO',
          ehTitular: false,
          ehCuradorVinculado: true,
        },
      }),
    });

    const consoleWarnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      consoleWarnings.push(args);
    };

    try {
      // 1. Curador tentando PATCH na Chave Pix (mesmo enviando spoof de papel no body)
      const resPatchPix = await fetch(`${server.baseUrl}/atelies/atelie-1/chave-pix`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-curador',
          Cookie: 'origem_session=COOKIE_SECRETO_CURADOR',
          'X-Request-Id': 'corr-tc02-curador-01',
        },
        body: JSON.stringify({
          chavePix: '52998224725',
          role: 'ARTESAO',
          ehTitular: true,
        }),
      });
      assert.equal(resPatchPix.status, 403);
      const bodyPatch = (await resPatchPix.json()) as { codigo?: string };
      assert.equal(bodyPatch.codigo, ATELIE_ERROR_CODES.ACESSO_FINANCEIRO_BLOQUEADO);

      // 2. Curador tentando consultar dados financeiros privados
      const resGetFin = await fetch(`${server.baseUrl}/atelies/atelie-1/financeiro`, {
        headers: {
          Authorization: 'Bearer token-curador',
          'X-Request-Id': 'corr-tc02-curador-02',
        },
      });
      assert.equal(resGetFin.status, 403);

      // 3. Curador tentando gerenciar curadores
      const resPostCurator = await fetch(`${server.baseUrl}/atelies/atelie-1/curadores`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-curador' },
      });
      assert.equal(resPostCurator.status, 403);

      // Nenhuma chamada alcançou o handler protegido!
      assert.equal(server.getProtectedCalls(), 0);

      // Curador TEM acesso ao catálogo e às etiquetas em ateliê ATIVO
      const resCat = await fetch(`${server.baseUrl}/atelies/atelie-1/catalogo`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-curador' },
      });
      assert.equal(resCat.status, 200);
      const bodyCat = (await resCat.json()) as {
        atelierAccess: { papelNoAtelie: string; permissoes: string[] };
      };
      assert.equal(bodyCat.atelierAccess.papelNoAtelie, 'CURADOR');
      assert.deepEqual(bodyCat.atelierAccess.permissoes, [
        'GERENCIAR_CATALOGO',
        'GERENCIAR_ETIQUETAS',
      ]);

      const resTag = await fetch(`${server.baseUrl}/atelies/atelie-1/etiquetas`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-curador' },
      });
      assert.equal(resTag.status, 200);
      assert.equal(server.getProtectedCalls(), 2);

      // Conferência da trilha de auditoria das 3 tentativas negadas
      const events = server.getAuditEvents();
      assert.equal(events.length, 3);
      assert.equal(events[0]?.eventType, 'FINANCIAL_ACCESS_DENIED');
      assert.equal(events[0]?.reason, 'CURATOR_FINANCIAL_BLOCK');
      assert.equal(events[0]?.correlationId, 'corr-tc02-curador-01');
      assert.equal(events[0]?.userId, 'user-curador');
      assert.equal(events[0]?.atelieId, 'atelie-1');
      assert.equal(events[1]?.eventType, 'FINANCIAL_ACCESS_DENIED');
      assert.equal(events[2]?.eventType, 'CURATOR_MANAGEMENT_DENIED');
      assert.equal(events[2]?.reason, 'CURATOR_GOVERNANCE_BLOCK');

      const serializedAudit = JSON.stringify(events) + JSON.stringify(consoleWarnings);
      assert.equal(serializedAudit.includes('52998224725'), false);
      assert.equal(serializedAudit.includes('token-curador'), false);
      assert.equal(serializedAudit.includes('COOKIE_SECRETO_CURADOR'), false);
    } finally {
      console.warn = originalWarn;
      await server.close();
    }
  });

  it('aplica permissões contextuais diferentes quando o mesmo usuário é titular no ateliê A, curador no ateliê B e sem vínculo em C', async () => {
    const server = await startMiddlewareTestServer({
      authProvider: createTokenMapAuthProvider({ 'token-misto': 'user-misto' }),
      autorizacaoRepository: createInMemoryAuthzRepoForTests({
        'user-misto:atelie-a': {
          atelieId: 'atelie-a',
          statusAtelie: 'ATIVO',
          ehTitular: true,
          ehCuradorVinculado: false,
        },
        'user-misto:atelie-b': {
          atelieId: 'atelie-b',
          statusAtelie: 'ATIVO',
          ehTitular: false,
          ehCuradorVinculado: true,
        },
        'user-misto:atelie-suspenso': {
          atelieId: 'atelie-suspenso',
          statusAtelie: 'SUSPENSO',
          ehTitular: false,
          ehCuradorVinculado: true,
        },
      }),
    });

    try {
      // No Ateliê A (titular): pode alterar Pix, consultar financeiro e gerenciar curadores
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-a/chave-pix`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-a/financeiro`, {
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-a/curadores`, {
            method: 'POST',
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        200,
      );

      // No Ateliê B (curador): bloqueado em finanças e curadores (403), permitido em catálogo (200)
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-b/chave-pix`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-b/financeiro`, {
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-b/curadores`, {
            method: 'POST',
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-b/catalogo`, {
            method: 'POST',
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        200,
      );

      // No Ateliê C (sem vínculo): bloqueado em tudo (403)
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-c/financeiro`, {
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-c/catalogo`, {
            method: 'POST',
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        403,
      );

      // Em ateliê SUSPENSO como curador: catálogo e etiquetas também bloqueados (403)
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-suspenso/catalogo`, {
            method: 'POST',
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await fetch(`${server.baseUrl}/atelies/atelie-suspenso/etiquetas`, {
            method: 'POST',
            headers: { Authorization: 'Bearer token-misto' },
          })
        ).status,
        403,
      );

      // Apenas as 4 chamadas autorizadas alcançaram o handler (3 em A + 1 em B)
      assert.equal(server.getProtectedCalls(), 4);
      // As 7 tentativas negadas geraram 7 eventos de auditoria
      assert.equal(server.getAuditEvents().length, 7);
    } finally {
      await server.close();
    }
  });

  it('mantém bloqueio 403 e impede acesso mesmo se o sink de auditoria falhar', async () => {
    const server = await startMiddlewareTestServer({
      authProvider: createTokenMapAuthProvider({ 'token-curador': 'user-curador' }),
      autorizacaoRepository: createInMemoryAuthzRepoForTests({
        'user-curador:atelie-1': {
          atelieId: 'atelie-1',
          statusAtelie: 'ATIVO',
          ehTitular: false,
          ehCuradorVinculado: true,
        },
      }),
      failingAuditSink: true,
    });

    const errors: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };

    try {
      const res = await fetch(`${server.baseUrl}/atelies/atelie-1/chave-pix`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer token-curador' },
      });
      assert.equal(res.status, 403);
      assert.equal(server.getProtectedCalls(), 0);
      assert.equal(JSON.stringify(errors).includes('[SECURITY_AUDIT_SINK_ERROR]'), true);
    } finally {
      console.error = originalError;
      await server.close();
    }
  });
});
