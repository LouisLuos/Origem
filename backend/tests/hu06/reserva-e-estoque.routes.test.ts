import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import type {
  AtelieAutorizacaoRepository,
  RelacionamentoUsuarioAtelie,
} from '../../src/repositories/contracts/hu03.contracts.js';
import type { PecaPersistida, PecaRepository } from '../../src/repositories/contracts/pecas.contracts.js';
import {
  RESERVA_ERROR_CODES,
  RESERVA_TTL_MINUTOS,
  type GrupoReservaResultado,
  type ReservaEstoqueRepository,
} from '../../src/repositories/contracts/reservas.contracts.js';
import { createEstoqueRoutes } from '../../src/routes/estoque.routes.js';
import { PECAS_ROUTE_PATH, createPecaRoutes, pecaJsonBodyParser } from '../../src/routes/peca.routes.js';
import { createPecaService } from '../../src/services/peca.service.js';
import { createReservaEstoqueService } from '../../src/services/reservaEstoque.service.js';
import { AppError } from '../../src/utils/AppError.js';
import type { SecurityAuditService } from '../../src/utils/securityAudit.util.js';

const USER_TITULAR = '11111111-1111-4111-8111-111111111111';
const USER_CURADOR = '22222222-2222-4222-8222-222222222222';
const USER_COMPRADOR = '33333333-3333-4333-8333-333333333333';
const ATELIE_A = '44444444-4444-4444-8444-444444444444';
const ATELIE_SUSPENSO = '55555555-5555-4555-8555-555555555555';
const PECA_ID = '66666666-6666-4666-8666-666666666666';

const VINCULOS: Record<string, RelacionamentoUsuarioAtelie[]> = {
  [USER_TITULAR]: [{ atelieId: ATELIE_A, statusAtelie: 'ATIVO', ehTitular: true, ehCuradorVinculado: false }],
  [USER_CURADOR]: [
    { atelieId: ATELIE_A, statusAtelie: 'ATIVO', ehTitular: false, ehCuradorVinculado: true },
    { atelieId: ATELIE_SUSPENSO, statusAtelie: 'SUSPENSO', ehTitular: false, ehCuradorVinculado: true },
  ],
  [USER_COMPRADOR]: [],
};

const authProvider: AuthIdentityProvider = {
  async verify({ bearerToken }) {
    const userId = bearerToken?.startsWith('tok:') ? bearerToken.slice(4) : undefined;
    return userId && userId in VINCULOS
      ? { status: 'AUTHENTICATED', identity: { userId } }
      : { status: 'UNAUTHENTICATED', reason: 'Credencial inválida.' };
  },
};

const autorizacaoRepository: AtelieAutorizacaoRepository = {
  async findRelacionamentoUsuarioAtelie(usuarioId, atelieId) {
    return VINCULOS[usuarioId]?.find((v) => v.atelieId === atelieId) ?? null;
  },
  async listRelacionamentosUsuario(usuarioId) {
    return VINCULOS[usuarioId] ?? [];
  },
};

async function withServer(
  expressApp: express.Express,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = await new Promise((resolve) => {
    const s = expressApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  try {
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('HU-06 — Rotas HTTP isoladas de estoque do ateliê e reservas', () => {
  it('protege GET /atelies/:id/pecas e PATCH /atelies/:id/pecas/:pecaId/estoque com autenticação e RBAC GERENCIAR_CATALOGO', async () => {
    const pecas = new Map<string, PecaPersistida>([
      [
        PECA_ID,
        {
          id: PECA_ID,
          atelieId: ATELIE_A,
          titulo: 'Jarra de Barro',
          descricao: 'Modelada manualmente.',
          tipologia: 'Cerâmica Figurativa',
          preco: 120,
          pesoGramas: 900,
          comprimentoCm: 20,
          larguraCm: 20,
          alturaCm: 25,
          isFragil: true,
          quantidadeEstoque: 5,
          status: 'DISPONIVEL',
          fotos: [{ id: 'f1', url: 'https://img.test/1.webp', isPrincipal: true }],
        },
      ],
    ]);

    const repository: PecaRepository = {
      async criarComFotos(dados) {
        const criada: PecaPersistida = {
          ...dados,
          id: crypto.randomUUID(),
          fotos: dados.fotos.map((f, i) => ({ id: `f-${i}`, url: f.url, isPrincipal: f.isPrincipal })),
        };
        pecas.set(criada.id, criada);
        return criada;
      },
      async listarPorAtelie(atelieId) {
        return Array.from(pecas.values()).filter((p) => p.atelieId === atelieId);
      },
      async atualizarEstoque(dados) {
        const atual = pecas.get(dados.pecaId);
        if (!atual || atual.atelieId !== dados.atelieId) return null;
        const novo = dados.modo === 'ABSOLUTO' ? dados.quantidadeEstoque : atual.quantidadeEstoque + dados.delta;
        if (novo < 0) {
          throw new AppError('O estoque não pode ficar negativo.', 409, RESERVA_ERROR_CODES.ESTOQUE_INSUFICIENTE);
        }
        const atualizada: PecaPersistida = { ...atual, quantidadeEstoque: novo };
        pecas.set(atual.id, atualizada);
        return atualizada;
      },
    };

    const auditService: SecurityAuditService = {
      async recordAuthorizationDenial(input) {
        return input as never;
      },
    };

    const app = express();
    app.use(`/api/v1${PECAS_ROUTE_PATH}`, pecaJsonBodyParser);
    app.use(express.json());
    app.use(
      `/api/v1${PECAS_ROUTE_PATH}`,
      createPecaRoutes({
        authProvider,
        autorizacaoRepository,
        auditService,
        pecaService: createPecaService({ repository }),
      }),
    );
    app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(err, req, res, next),
    );

    await withServer(app, async (baseUrl) => {
      // Sem auth -> 401
      assert.equal((await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_A}/pecas`)).status, 401);

      // Comprador sem vínculo -> 403
      const resForbidden = await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_A}/pecas/${PECA_ID}/estoque`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer tok:${USER_COMPRADOR}`,
        },
        body: JSON.stringify({ delta: 1 }),
      });
      assert.equal(resForbidden.status, 403);

      // Curador de ateliê SUSPENSO -> 403
      const resSuspended = await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_SUSPENSO}/pecas`, {
        headers: { Authorization: `Bearer tok:${USER_CURADOR}` },
      });
      assert.equal(resSuspended.status, 403);

      // Titular lista peças e ajusta estoque
      const resList = await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_A}/pecas`, {
        headers: { Authorization: `Bearer tok:${USER_TITULAR}` },
      });
      assert.equal(resList.status, 200);
      const listBody = (await resList.json()) as { dados: PecaPersistida[] };
      assert.equal(listBody.dados.length, 1);
      assert.equal(listBody.dados[0]?.quantidadeEstoque, 5);

      // Curador ativo ajusta via delta -> saldo 7
      const resDelta = await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_A}/pecas/${PECA_ID}/estoque`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer tok:${USER_CURADOR}`,
        },
        body: JSON.stringify({ delta: 2 }),
      });
      assert.equal(resDelta.status, 200);
      assert.equal(((await resDelta.json()) as PecaPersistida).quantidadeEstoque, 7);

      // Ajuste que resultaria em saldo negativo -> 409
      const resNeg = await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_A}/pecas/${PECA_ID}/estoque`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer tok:${USER_TITULAR}`,
        },
        body: JSON.stringify({ delta: -10 }),
      });
      assert.equal(resNeg.status, 409);

      // Corpo inválido -> 422
      const resInvalid = await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_A}/pecas/${PECA_ID}/estoque`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer tok:${USER_TITULAR}`,
        },
        body: JSON.stringify({ quantidadeEstoque: -3 }),
      });
      assert.equal(resInvalid.status, 422);
    });
  });

  it('mapeia corretamente status 401/201/200/409/422 nas rotas de reservas e valida app real fail-closed', async () => {
    const grupos = new Map<string, GrupoReservaResultado>();
    let saldo = 2;

    const repo: ReservaEstoqueRepository = {
      async criarGrupoReserva(input) {
        const chave = `${input.usuarioId}:${input.idempotencyKey}`;
        const existente = grupos.get(chave);
        if (existente) {
          return { ...existente, idempotente: true };
        }
        const qtd = input.itens[0]!.quantidade;
        if (saldo < qtd) {
          throw new AppError('Saldo insuficiente.', 409, RESERVA_ERROR_CODES.ESTOQUE_INSUFICIENTE);
        }
        saldo -= qtd;
        const grupoId = crypto.randomUUID();
        const now = new Date().toISOString();
        const expiraEm = new Date(Date.now() + 900_000).toISOString();
        const criado: GrupoReservaResultado = {
          grupoId,
          usuarioId: input.usuarioId,
          idempotencyKey: input.idempotencyKey,
          idempotente: false,
          criadoEm: now,
          expiraEm,
          ttlMinutos: RESERVA_TTL_MINUTOS,
          itens: input.itens.map((item) => ({
            id: crypto.randomUUID(),
            grupoId,
            usuarioId: input.usuarioId,
            pecaId: item.pecaId,
            quantidade: item.quantidade,
            status: 'ATIVA',
            idempotencyKey: input.idempotencyKey,
            criadoEm: now,
            expiraEm,
            atualizadoEm: now,
            finalizadoEm: null,
            estoqueDevolvidoEm: null,
          })),
        };
        grupos.set(chave, criado);
        return criado;
      },
      async listarReservasUsuario(usuarioId) {
        return Array.from(grupos.values()).filter((g) => g.usuarioId === usuarioId);
      },
      async cancelarPorGrupo(grupoId, usuarioId) {
        const match = Array.from(grupos.values()).find((g) => g.grupoId === grupoId);
        if (!match) throw new AppError('Não encontrado.', 404);
        if (match.usuarioId !== usuarioId) throw new AppError('Proibido.', 403);
        return {
          grupoId,
          usuarioId,
          jaFinalizada: false,
          itensCancelados: match.itens.length,
          unidadesDevolvidas: match.itens.reduce((acc, i) => acc + i.quantidade, 0),
          itens: match.itens,
        };
      },
      async cancelarReservaItem() {
        throw new AppError('Não usado neste teste.', 501);
      },
      async confirmarPorGrupo(grupoId, usuarioId) {
        const match = Array.from(grupos.values()).find((g) => g.grupoId === grupoId);
        if (!match) throw new AppError('Não encontrado.', 404);
        if (match.usuarioId !== usuarioId) throw new AppError('Proibido.', 403);
        return {
          grupoId,
          usuarioId,
          jaConfirmada: false,
          itensConfirmados: match.itens.length,
          itens: match.itens,
        };
      },
      async expirarReservasVencidas() {
        return { reservasExpiradas: 0, unidadesDevolvidas: 0, pecasAtualizadas: 0 };
      },
    };

    const app = express();
    app.use(express.json());
    app.use(
      '/api/v1/estoque',
      createEstoqueRoutes({
        authProvider,
        reservaService: createReservaEstoqueService({ repository: repo }),
      }),
    );
    app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(err, req, res, next),
    );

    await withServer(app, async (baseUrl) => {
      // 401 sem credencial
      const noAuth = await fetch(`${baseUrl}/api/v1/estoque/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: [{ pecaId: PECA_ID, quantidade: 1 }] }),
      });
      assert.equal(noAuth.status, 401);

      // 422 legado 'p01'
      const legacy = await fetch(`${baseUrl}/api/v1/estoque/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer tok:${USER_COMPRADOR}`,
        },
        body: JSON.stringify({ lines: [{ productId: 'p01', quantity: 1 }] }),
      });
      assert.equal(legacy.status, 422);
      assert.equal(((await legacy.json()) as { codigo: string }).codigo, RESERVA_ERROR_CODES.PECA_NAO_PERSISTIDA);

      // 201 primeira reserva (idempotência 'k1')
      const res1 = await fetch(`${baseUrl}/api/v1/estoque/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer tok:${USER_COMPRADOR}`,
          'Idempotency-Key': 'k1',
        },
        body: JSON.stringify({ itens: [{ pecaId: PECA_ID, quantidade: 2 }] }),
      });
      assert.equal(res1.status, 201);
      const body1 = (await res1.json()) as GrupoReservaResultado;
      assert.equal(body1.idempotente, false);
      assert.equal(saldo, 0);

      // 200 repetição idempotente sem novo débito
      const resReplay = await fetch(`${baseUrl}/api/v1/estoque/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer tok:${USER_COMPRADOR}`,
          'Idempotency-Key': 'k1',
        },
        body: JSON.stringify({ itens: [{ pecaId: PECA_ID, quantidade: 2 }] }),
      });
      assert.equal(resReplay.status, 200);
      assert.equal(((await resReplay.json()) as GrupoReservaResultado).idempotente, true);
      assert.equal(saldo, 0);

      // 409 sem saldo para outro usuário
      const res409 = await fetch(`${baseUrl}/api/v1/estoque/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer tok:${USER_CURADOR}`,
        },
        body: JSON.stringify({ itens: [{ pecaId: PECA_ID, quantidade: 1 }] }),
      });
      assert.equal(res409.status, 409);

      // 403 cancelamento por terceiro
      const res403 = await fetch(`${baseUrl}/api/v1/estoque/reservas/${body1.grupoId}/cancelar`, {
        method: 'POST',
        headers: { Authorization: `Bearer tok:${USER_TITULAR}` },
      });
      assert.equal(res403.status, 403);
    });

    // App real fail-closed sem credencial
    const { app: realApp } = await import('../../src/app.js');
    await withServer(realApp, async (baseUrl) => {
      assert.equal(
        (await fetch(`${baseUrl}/api/v1/estoque/reservas`, { method: 'POST' })).status,
        401,
      );
      assert.equal(
        (await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_A}/pecas`)).status,
        401,
      );
      assert.equal(
        (await fetch(`${baseUrl}/api/v1/atelies/${ATELIE_A}/pecas/${PECA_ID}/estoque`, { method: 'PATCH' })).status,
        401,
      );
    });
  });
});
