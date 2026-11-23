import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import {
  RESERVA_ERROR_CODES,
  type GrupoReservaResultado,
} from '../../src/repositories/contracts/reservas.contracts.js';
import {
  cancelarGrupoReservaNaTransacao,
  createPrismaReservaEstoqueRepository,
  type PrismaReservaDbClient,
  type PrismaTransactionClient,
} from '../../src/repositories/prismaReserva.repository.js';
import { createEstoqueRoutes } from '../../src/routes/estoque.routes.js';
import { createReservaEstoqueService } from '../../src/services/reservaEstoque.service.js';
import { AppError } from '../../src/utils/AppError.js';
import { validarCriacaoReserva } from '../../src/validators/reserva.validator.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const PECA_UNICA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PECA_LOTE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

interface FakePeca {
  id: string;
  titulo: string;
  quantidade_estoque: number;
  status: 'DISPONIVEL' | 'RESERVADA' | 'VENDIDA' | 'ARQUIVADA';
  atualizado_em: Date;
}

interface FakeGrupo {
  id: string;
  usuarioId: string;
  idempotencyKey: string;
  payloadHash: string;
  criadoEm: Date;
}

interface FakeReserva {
  id: string;
  grupoId: string;
  usuarioId: string;
  pecaId: string;
  quantidade: number;
  status: 'ATIVA' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA';
  idempotencyKey: string;
  criadoEm: Date;
  expiraEm: Date;
  atualizadoEm: Date;
  finalizadoEm: Date | null;
  estoqueDevolvidoEm: Date | null;
}

interface FakePedido {
  id: string;
  codigoPedido: string;
  reservaGrupoId: string;
  status:
    | 'PENDENTE_PAGAMENTO'
    | 'APROVADO'
    | 'RECUSADO'
    | 'EXPIRADO'
    | 'CANCELADO'
    | 'RECONCILIACAO_ESTORNO';
  criadoEm: Date;
}

function createFakeTransactionalDb(options?: {
  onBeforePecaLockAcquire?: (pecaIds: readonly string[]) => Promise<void> | void;
}) {
  const pecas = new Map<string, FakePeca>([
    [
      PECA_UNICA,
      {
        id: PECA_UNICA,
        titulo: 'Moranga Esculpida Única',
        quantidade_estoque: 1,
        status: 'DISPONIVEL',
        atualizado_em: new Date('2026-11-23T10:00:00.000Z'),
      },
    ],
    [
      PECA_LOTE,
      {
        id: PECA_LOTE,
        titulo: 'Prato de Barro Pintado',
        quantidade_estoque: 5,
        status: 'DISPONIVEL',
        atualizado_em: new Date('2026-11-23T10:00:00.000Z'),
      },
    ],
  ]);

  const grupos = new Map<string, FakeGrupo>();
  const reservas = new Map<string, FakeReserva>();
  const pedidos = new Map<string, FakePedido>();

  let lockChain: Promise<void> = Promise.resolve();

  async function acquirePecasLock(pecaIds: readonly string[]): Promise<() => void> {
    if (options?.onBeforePecaLockAcquire) {
      await options.onBeforePecaLockAcquire(pecaIds);
    }

    let release!: () => void;
    const waitPrev = lockChain;
    lockChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await waitPrev;
    return release;
  }

  function listarPedidosPorGrupo(grupoId: string): FakePedido[] {
    return Array.from(pedidos.values())
      .filter((p) => p.reservaGrupoId === grupoId)
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  }

  function incluirRelacoesGrupo(
    grupo: FakeGrupo,
    include?: {
      itens?: { where?: { usuarioId?: string } };
      pedidos?: { take?: number };
    },
  ) {
    const itensGrupo = Array.from(reservas.values())
      .filter(
        (r) =>
          r.grupoId === grupo.id &&
          (!include?.itens?.where?.usuarioId || r.usuarioId === include.itens.where.usuarioId),
      )
      .sort((a, b) => a.pecaId.localeCompare(b.pecaId));

    const pedidosGrupo = include?.pedidos
      ? listarPedidosPorGrupo(grupo.id).slice(0, include.pedidos.take ?? 5)
      : [];

    return {
      ...grupo,
      itens: itensGrupo,
      ...(include?.pedidos ? { pedidos: pedidosGrupo } : {}),
    };
  }

  const db: PrismaReservaDbClient = {
    async $transaction<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
      const releases: Array<() => void> = [];
      let txLockHeld = false;

      const txFake = {
        async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
          const sql = strings.join('?');

          if (sql.includes('INSERT INTO "reservas_grupos"')) {
            const [usuarioId, idempotencyKey, payloadHash, agora] = values as [
              string,
              string,
              string,
              Date,
            ];
            const duplicado = Array.from(grupos.values()).find(
              (g) => g.usuarioId === usuarioId && g.idempotencyKey === idempotencyKey,
            );
            if (duplicado) return [];
            const criado: FakeGrupo = {
              id: crypto.randomUUID(),
              usuarioId,
              idempotencyKey,
              payloadHash,
              criadoEm: agora,
            };
            grupos.set(criado.id, criado);
            return [{ id: criado.id, criado_em: criado.criadoEm }];
          }

          if (sql.includes('FROM "pecas"') && sql.includes('FOR UPDATE')) {
            const [pecaIds] = values as [string[]];
            if (!txLockHeld) {
              releases.push(await acquirePecasLock(pecaIds));
              txLockHeld = true;
            }
            return pecaIds
              .map((id) => pecas.get(id))
              .filter((p): p is FakePeca => Boolean(p))
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((p) => ({
                id: p.id,
                titulo: p.titulo,
                quantidade_estoque: p.quantidade_estoque,
                status: p.status,
              }));
          }

          if (sql.includes('SELECT DISTINCT r."grupo_id", r."peca_id"')) {
            const [usuarioId, agora] = values as [string, Date];
            const encontrados = new Map<string, { grupo_id: string; peca_id: string }>();
            for (const r of reservas.values()) {
              if (
                r.usuarioId === usuarioId &&
                r.status === 'ATIVA' &&
                r.expiraEm.getTime() <= agora.getTime()
              ) {
                const temPedidoAtivo = listarPedidosPorGrupo(r.grupoId).some(
                  (p) =>
                    p.status === 'PENDENTE_PAGAMENTO' ||
                    p.status === 'APROVADO' ||
                    p.status === 'RECONCILIACAO_ESTORNO',
                );
                if (!temPedidoAtivo) {
                  encontrados.set(`${r.grupoId}:${r.pecaId}`, {
                    grupo_id: r.grupoId,
                    peca_id: r.pecaId,
                  });
                }
              }
            }
            return Array.from(encontrados.values()).sort(
              (a, b) => a.peca_id.localeCompare(b.peca_id) || a.grupo_id.localeCompare(b.grupo_id),
            );
          }

          if (sql.includes('UPDATE "reservas"') && sql.includes("'EXPIRADA'")) {
            let agora: Date;
            let pecaIds: string[];
            let grupoIds: Set<string> | undefined;
            let cutoff: Date;

            if (sql.includes('"grupo_id" = ANY(')) {
              const [a, , , pIds, gIds, c] = values as [Date, Date, Date, string[], string[], Date];
              agora = a;
              pecaIds = pIds;
              grupoIds = new Set(gIds);
              cutoff = c;
            } else if (sql.includes('"grupo_id" = ')) {
              const [a, , , pIds, gId, c] = values as [Date, Date, Date, string[], string, Date];
              agora = a;
              pecaIds = pIds;
              grupoIds = new Set([gId]);
              cutoff = c;
            } else {
              const [a, , , pIds, c] = values as [Date, Date, Date, string[], Date];
              agora = a;
              pecaIds = pIds;
              cutoff = c;
            }

            const pecaSet = new Set(pecaIds);
            const result: Array<{ peca_id: string; quantidade: number }> = [];
            for (const r of reservas.values()) {
              if (
                pecaSet.has(r.pecaId) &&
                (!grupoIds || grupoIds.has(r.grupoId)) &&
                r.status === 'ATIVA' &&
                r.expiraEm.getTime() <= cutoff.getTime()
              ) {
                r.status = 'EXPIRADA';
                r.finalizadoEm = agora;
                r.estoqueDevolvidoEm = agora;
                r.atualizadoEm = agora;
                result.push({ peca_id: r.pecaId, quantidade: r.quantidade });
              }
            }
            return result;
          }

          if (sql.includes('UPDATE "reservas"') && sql.includes("'CANCELADA'")) {
            const [agora, , , alvoId, usuarioId] = values as [Date, Date, Date, string, string];
            const porGrupo = sql.includes('WHERE "grupo_id" =');
            const result: Array<{ peca_id: string; quantidade: number }> = [];
            for (const r of reservas.values()) {
              const matchAlvo = porGrupo ? r.grupoId === alvoId : r.id === alvoId;
              if (matchAlvo && r.usuarioId === usuarioId && r.status === 'ATIVA') {
                r.status = 'CANCELADA';
                r.finalizadoEm = agora;
                r.estoqueDevolvidoEm = agora;
                r.atualizadoEm = agora;
                result.push({ peca_id: r.pecaId, quantidade: r.quantidade });
              }
            }
            return result;
          }

          if (sql.includes('UPDATE "pecas"') && sql.includes('"quantidade_estoque" +')) {
            const [incremento, , agora, pecaId] = values as [number, number, Date, string];
            const peca = pecas.get(pecaId);
            if (!peca) return [];
            peca.quantidade_estoque += incremento;
            if (peca.status === 'RESERVADA' && peca.quantidade_estoque > 0) {
              peca.status = 'DISPONIVEL';
            }
            peca.atualizado_em = agora;
            return [{ quantidade_estoque: peca.quantidade_estoque, status: peca.status }];
          }

          if (sql.includes('UPDATE "pecas"') && sql.includes('"quantidade_estoque" -')) {
            const [qtd, , agora, pecaId] = values as [number, number, Date, string, number];
            const peca = pecas.get(pecaId);
            if (!peca || peca.status !== 'DISPONIVEL' || peca.quantidade_estoque < qtd) {
              return [];
            }
            peca.quantidade_estoque -= qtd;
            if (peca.quantidade_estoque === 0) {
              peca.status = 'RESERVADA';
            }
            peca.atualizado_em = agora;
            return [
              {
                id: peca.id,
                quantidade_estoque: peca.quantidade_estoque,
                status: peca.status,
              },
            ];
          }

          throw new Error(`Query raw inesperada no double de teste: ${sql}`);
        },

        reservaGrupo: {
          async findUnique(args: {
            where: {
              id?: string;
              usuarioId_idempotencyKey?: { usuarioId: string; idempotencyKey: string };
            };
            include?: {
              itens?: { where?: { usuarioId?: string } };
              pedidos?: { take?: number };
            };
          }) {
            let encontrado: FakeGrupo | undefined;
            if (args.where.id) {
              encontrado = grupos.get(args.where.id);
            } else if (args.where.usuarioId_idempotencyKey) {
              const { usuarioId, idempotencyKey } = args.where.usuarioId_idempotencyKey;
              encontrado = Array.from(grupos.values()).find(
                (g) => g.usuarioId === usuarioId && g.idempotencyKey === idempotencyKey,
              );
            }
            return encontrado ? incluirRelacoesGrupo(encontrado, args.include) : null;
          },

          async findMany(args: {
            where: { usuarioId: string };
            include?: {
              itens?: { where?: { usuarioId?: string } };
              pedidos?: { take?: number };
            };
            take?: number;
          }) {
            return Array.from(grupos.values())
              .filter((g) => g.usuarioId === args.where.usuarioId)
              .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
              .slice(0, args.take ?? 25)
              .map((g) => incluirRelacoesGrupo(g, args.include));
          },
        },

        reserva: {
          async findMany(args: { where: { grupoId: string; usuarioId: string } }) {
            return Array.from(reservas.values())
              .filter(
                (r) =>
                  r.grupoId === args.where.grupoId && r.usuarioId === args.where.usuarioId,
              )
              .sort((a, b) => a.pecaId.localeCompare(b.pecaId));
          },
          async findUnique(args: { where: { id: string } }) {
            return reservas.get(args.where.id) ?? null;
          },
          async create(args: { data: Omit<FakeReserva, 'id'> }) {
            const criada: FakeReserva = {
              id: crypto.randomUUID(),
              ...args.data,
            };
            reservas.set(criada.id, criada);
            return criada;
          },
          async count(args: { where: { pecaId: string; status: FakeReserva['status'] } }) {
            return Array.from(reservas.values()).filter(
              (r) => r.pecaId === args.where.pecaId && r.status === args.where.status,
            ).length;
          },
        },

        peca: {
          async update(args: {
            where: { id: string };
            data: { status?: FakePeca['status']; atualizadoEm?: Date };
          }) {
            const peca = pecas.get(args.where.id);
            if (!peca) throw new Error('Peça ausente');
            if (args.data.status) peca.status = args.data.status;
            if (args.data.atualizadoEm) peca.atualizado_em = args.data.atualizadoEm;
            return peca;
          },
        },

        pedido: {
          async findFirst(args: {
            where: { reservaGrupoId: string; status: { in: FakePedido['status'][] } };
          }) {
            const match = listarPedidosPorGrupo(args.where.reservaGrupoId).find((p) =>
              args.where.status.in.includes(p.status),
            );
            return match ?? null;
          },
          async findMany(args: {
            where: { reservaGrupoId: { in: string[] }; status: { in: FakePedido['status'][] } };
          }) {
            const gSet = new Set(args.where.reservaGrupoId.in);
            return Array.from(pedidos.values()).filter(
              (p) => gSet.has(p.reservaGrupoId) && args.where.status.in.includes(p.status),
            );
          },
        },
      };

      try {
        return await fn(txFake as unknown as PrismaTransactionClient);
      } finally {
        for (const release of releases) {
          release();
        }
      }
    },
  };

  return { db, pecas, grupos, reservas, pedidos };
}

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

const authProvider: AuthIdentityProvider = {
  async verify({ bearerToken }) {
    const userId = bearerToken?.startsWith('tok:') ? bearerToken.slice(4) : undefined;
    return userId
      ? { status: 'AUTHENTICATED', identity: { userId } }
      : { status: 'UNAUTHENTICATED', reason: 'Token ausente.' };
  },
};

describe('HU-09 Etapa 1 — Recuperação, expiração lazy no GET e proteção contra pedidos ativos', () => {
  it('GET /api/v1/estoque/reservas/minhas retorna 401 sem auth e devolve servidorAgora, grupoId, expiraEm e vínculo com pedido', async () => {
    const { db, pedidos } = createFakeTransactionalDb();
    const repository = createPrismaReservaEstoqueRepository(db);
    const service = createReservaEstoqueService({ repository });

    const criada = await repository.criarGrupoReserva({
      usuarioId: USER_A,
      idempotencyKey: 'idem-hu09-get-1',
      payloadHash: 'hash-a',
      itens: [{ pecaId: PECA_UNICA, quantidade: 1 }],
      agora: new Date('2026-11-23T12:00:00.000Z'),
    });

    pedidos.set('ped-1', {
      id: '33333333-3333-4333-8333-333333333333',
      codigoPedido: 'OR-20261123-AA0001',
      reservaGrupoId: criada.grupoId,
      status: 'PENDENTE_PAGAMENTO',
      criadoEm: new Date('2026-11-23T12:01:00.000Z'),
    });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/estoque', createEstoqueRoutes({ authProvider, reservaService: service }));
    app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(err, req, res, next),
    );

    await withServer(app, async (baseUrl) => {
      const unauth = await fetch(`${baseUrl}/api/v1/estoque/reservas/minhas`);
      assert.equal(unauth.status, 401);

      const res = await fetch(`${baseUrl}/api/v1/estoque/reservas/minhas`, {
        headers: { Authorization: `Bearer tok:${USER_A}` },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        servidorAgora: string;
        dados: GrupoReservaResultado[];
      };

      assert.ok(Date.parse(body.servidorAgora) > 0);
      assert.equal(body.dados.length, 1);
      const grupo = body.dados[0]!;
      assert.equal(grupo.grupoId, criada.grupoId);
      assert.equal(grupo.expiraEm, '2026-11-23T12:15:00.000Z');
      assert.equal(grupo.servidorAgora, body.servidorAgora);
      assert.equal(grupo.possuiPedidoAtivo, true);
      assert.deepEqual(grupo.pedidoVinculado, {
        pedidoId: '33333333-3333-4333-8333-333333333333',
        codigoPedido: 'OR-20261123-AA0001',
        status: 'PENDENTE_PAGAMENTO',
        ativo: true,
      });
    });
  });

  it('expira reserva solta vencida no listarReservasUsuario, devolve estoque e mantém idempotência sob concorrência', async () => {
    const { db, pecas } = createFakeTransactionalDb();
    const repository = createPrismaReservaEstoqueRepository(db);

    const t0 = new Date('2026-11-23T12:00:00.000Z');
    const reserva = await repository.criarGrupoReserva({
      usuarioId: USER_A,
      idempotencyKey: 'idem-hu09-lazy-1',
      payloadHash: 'hash-lazy',
      itens: [{ pecaId: PECA_UNICA, quantidade: 1 }],
      agora: t0,
    });
    assert.equal(pecas.get(PECA_UNICA)?.quantidade_estoque, 0);
    assert.equal(pecas.get(PECA_UNICA)?.status, 'RESERVADA');

    // Antes dos 15 minutos, mantém ativa
    const tAntes = new Date('2026-11-23T12:14:59.000Z');
    const antes = await repository.listarReservasUsuario(USER_A, tAntes);
    assert.equal(antes[0]?.itens[0]?.status, 'ATIVA');
    assert.equal(pecas.get(PECA_UNICA)?.quantidade_estoque, 0);

    // Após os 15 minutos, duas chamadas simultâneas (Promise.all) + chamada repetida devolvem estoque apenas 1 vez
    const tDepois = new Date('2026-11-23T12:15:01.000Z');
    const [r1, r2] = await Promise.all([
      repository.listarReservasUsuario(USER_A, tDepois),
      repository.listarReservasUsuario(USER_A, tDepois),
    ]);
    const r3 = await repository.listarReservasUsuario(USER_A, new Date('2026-11-23T12:20:00.000Z'));

    assert.equal(pecas.get(PECA_UNICA)?.quantidade_estoque, 1, 'Saldo não pode ser creditado mais de uma vez');
    assert.equal(pecas.get(PECA_UNICA)?.status, 'DISPONIVEL');
    assert.equal(r1[0]?.grupoId, reserva.grupoId);
    assert.equal(r1[0]?.itens[0]?.status, 'EXPIRADA');
    assert.equal(r2[0]?.itens[0]?.status, 'EXPIRADA');
    assert.equal(r3[0]?.itens[0]?.status, 'EXPIRADA');
    assert.equal(r1[0]?.possuiPedidoAtivo, false);
    assert.equal(r1[0]?.pedidoVinculado, null);
  });

  it('NÃO expira nem devolve estoque de reserva vencida vinculada a pedido ativo (PENDENTE_PAGAMENTO / APROVADO / RECONCILIACAO_ESTORNO)', async () => {
    for (const statusAtivo of ['PENDENTE_PAGAMENTO', 'APROVADO', 'RECONCILIACAO_ESTORNO'] as const) {
      const { db, pecas, pedidos } = createFakeTransactionalDb();
      const repository = createPrismaReservaEstoqueRepository(db);

      const criada = await repository.criarGrupoReserva({
        usuarioId: USER_A,
        idempotencyKey: `idem-${statusAtivo}`,
        payloadHash: `hash-${statusAtivo}`,
        itens: [{ pecaId: PECA_UNICA, quantidade: 1 }],
        agora: new Date('2026-11-23T12:00:00.000Z'),
      });

      pedidos.set(`ped-${statusAtivo}`, {
        id: crypto.randomUUID(),
        codigoPedido: `OR-${statusAtivo}`,
        reservaGrupoId: criada.grupoId,
        status: statusAtivo,
        criadoEm: new Date('2026-11-23T12:02:00.000Z'),
      });

      const listagem = await repository.listarReservasUsuario(
        USER_A,
        new Date('2026-11-23T12:20:00.000Z'),
      );

      assert.equal(pecas.get(PECA_UNICA)?.quantidade_estoque, 0);
      assert.equal(pecas.get(PECA_UNICA)?.status, 'RESERVADA');
      assert.equal(listagem[0]?.itens[0]?.status, 'ATIVA');
      assert.equal(listagem[0]?.possuiPedidoAtivo, true);
      assert.equal(listagem[0]?.pedidoVinculado?.status, statusAtivo);
      assert.equal(listagem[0]?.pedidoVinculado?.ativo, true);
    }
  });

  it('revalidação pós-lock protege contra corrida entre expiração no GET e abertura simultânea de pedido no checkout', async () => {
    let checkoutDisparado = false;
    let grupoIdCriado = '';
    const refDb = createFakeTransactionalDb({
      onBeforePecaLockAcquire() {
        if (!checkoutDisparado && grupoIdCriado) {
          checkoutDisparado = true;
          refDb.pedidos.set('ped-corrida', {
            id: '44444444-4444-4444-8444-444444444444',
            codigoPedido: 'OR-CORRIDA-01',
            reservaGrupoId: grupoIdCriado,
            status: 'PENDENTE_PAGAMENTO',
            criadoEm: new Date('2026-11-23T12:15:00.000Z'),
          });
        }
      },
    });

    const repository = createPrismaReservaEstoqueRepository(refDb.db);
    const criada = await repository.criarGrupoReserva({
      usuarioId: USER_A,
      idempotencyKey: 'idem-corrida-get-checkout',
      payloadHash: 'hash-corrida',
      itens: [{ pecaId: PECA_UNICA, quantidade: 1 }],
      agora: new Date('2026-11-23T12:00:00.000Z'),
    });
    grupoIdCriado = criada.grupoId;

    const listagem = await repository.listarReservasUsuario(
      USER_A,
      new Date('2026-11-23T12:15:01.000Z'),
    );

    assert.equal(checkoutDisparado, true);
    assert.equal(refDb.pecas.get(PECA_UNICA)?.quantidade_estoque, 0);
    assert.equal(listagem[0]?.itens[0]?.status, 'ATIVA');
    assert.equal(listagem[0]?.possuiPedidoAtivo, true);
    assert.equal(listagem[0]?.pedidoVinculado?.codigoPedido, 'OR-CORRIDA-01');
  });

  it('expira normalmente reserva cujo pedido vinculado está em estado terminal (RECUSADO / EXPIRADO / CANCELADO)', async () => {
    const { db, pecas, pedidos } = createFakeTransactionalDb();
    const repository = createPrismaReservaEstoqueRepository(db);

    const criada = await repository.criarGrupoReserva({
      usuarioId: USER_A,
      idempotencyKey: 'idem-terminal',
      payloadHash: 'hash-terminal',
      itens: [{ pecaId: PECA_LOTE, quantidade: 2 }],
      agora: new Date('2026-11-23T12:00:00.000Z'),
    });
    assert.equal(pecas.get(PECA_LOTE)?.quantidade_estoque, 3);

    pedidos.set('ped-recusado', {
      id: '55555555-5555-4555-8555-555555555555',
      codigoPedido: 'OR-TERMINAL-01',
      reservaGrupoId: criada.grupoId,
      status: 'RECUSADO',
      criadoEm: new Date('2026-11-23T12:03:00.000Z'),
    });

    const listagem = await repository.listarReservasUsuario(
      USER_A,
      new Date('2026-11-23T12:16:00.000Z'),
    );

    assert.equal(pecas.get(PECA_LOTE)?.quantidade_estoque, 5);
    assert.equal(listagem[0]?.itens[0]?.status, 'EXPIRADA');
    assert.equal(listagem[0]?.possuiPedidoAtivo, false);
    assert.equal(listagem[0]?.pedidoVinculado?.status, 'RECUSADO');
    assert.equal(listagem[0]?.pedidoVinculado?.ativo, false);
  });

  it('bloqueia cancelamento público de grupo ou item vinculado a pedido ativo (HTTP 409) preservando fluxo interno da HU-10', async () => {
    const { db, pecas, pedidos } = createFakeTransactionalDb();
    const repository = createPrismaReservaEstoqueRepository(db);
    const service = createReservaEstoqueService({ repository });

    const criada = await repository.criarGrupoReserva({
      usuarioId: USER_A,
      idempotencyKey: 'idem-prot-cancel',
      payloadHash: 'hash-prot',
      itens: [{ pecaId: PECA_UNICA, quantidade: 1 }],
      agora: new Date('2026-11-23T12:00:00.000Z'),
    });
    const reservaItemId = criada.itens[0]!.id;

    pedidos.set('ped-pendente', {
      id: '66666666-6666-4666-8666-666666666666',
      codigoPedido: 'OR-PIX-ATIVO',
      reservaGrupoId: criada.grupoId,
      status: 'PENDENTE_PAGAMENTO',
      criadoEm: new Date('2026-11-23T12:01:00.000Z'),
    });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/estoque', createEstoqueRoutes({ authProvider, reservaService: service }));
    app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(err, req, res, next),
    );

    await withServer(app, async (baseUrl) => {
      const rotasBloqueadas = [
        { method: 'POST', path: `/api/v1/estoque/reservas/${criada.grupoId}/cancelar` },
        { method: 'DELETE', path: `/api/v1/estoque/reservas/${criada.grupoId}` },
        { method: 'POST', path: `/api/v1/estoque/reservas/itens/${reservaItemId}/cancelar` },
      ];

      for (const rota of rotasBloqueadas) {
        const res = await fetch(`${baseUrl}${rota.path}`, {
          method: rota.method,
          headers: { Authorization: `Bearer tok:${USER_A}` },
        });
        assert.equal(res.status, 409);
        const body = (await res.json()) as { codigo: string };
        assert.equal(body.codigo, RESERVA_ERROR_CODES.RESERVA_VINCULADA_A_PEDIDO_ATIVO);
      }

      assert.equal(pecas.get(PECA_UNICA)?.quantidade_estoque, 0);
    });

    // Caminho interno transacional da HU-10 (sem bloquearSePedidoAtivo) continua funcionando para recusa/expiração
    const cancelamentoHu10 = await db.$transaction((tx) =>
      cancelarGrupoReservaNaTransacao(tx, criada.grupoId, USER_A, new Date('2026-11-23T12:05:00.000Z')),
    );
    assert.equal(cancelamentoHu10.unidadesDevolvidas, 1);
    assert.equal(cancelamentoHu10.itens[0]?.status, 'CANCELADA');
    assert.equal(pecas.get(PECA_UNICA)?.quantidade_estoque, 1);
    assert.equal(pecas.get(PECA_UNICA)?.status, 'DISPONIVEL');
  });

  it('replay idempotente em criarGrupoReserva preserva expiraEm original e informa servidorAgora e pedido vinculado', async () => {
    const { db, pecas, pedidos } = createFakeTransactionalDb();
    const repository = createPrismaReservaEstoqueRepository(db);

    const entrada = validarCriacaoReserva(
      { lines: [{ productId: PECA_LOTE, quantity: 2 }] },
      'idem-replay-hu09',
    );
    const t0 = new Date('2026-11-23T12:00:00.000Z');
    const primeira = await repository.criarGrupoReserva({
      usuarioId: USER_B,
      idempotencyKey: entrada.idempotencyKey,
      payloadHash: entrada.payloadHash,
      itens: entrada.itens,
      agora: t0,
    });
    assert.equal(primeira.idempotente, false);
    assert.equal(primeira.expiraEm, '2026-11-23T12:15:00.000Z');
    assert.equal(primeira.possuiPedidoAtivo, false);
    assert.equal(pecas.get(PECA_LOTE)?.quantidade_estoque, 3);

    pedidos.set('ped-replay', {
      id: '77777777-7777-4777-8777-777777777777',
      codigoPedido: 'OR-REPLAY-01',
      reservaGrupoId: primeira.grupoId,
      status: 'PENDENTE_PAGAMENTO',
      criadoEm: new Date('2026-11-23T12:01:00.000Z'),
    });

    const t1 = new Date('2026-11-23T12:04:00.000Z');
    const replay = await repository.criarGrupoReserva({
      usuarioId: USER_B,
      idempotencyKey: entrada.idempotencyKey,
      payloadHash: entrada.payloadHash,
      itens: entrada.itens,
      agora: t1,
    });

    assert.equal(replay.idempotente, true);
    assert.equal(replay.grupoId, primeira.grupoId);
    assert.equal(replay.expiraEm, '2026-11-23T12:15:00.000Z', 'expiraEm original não pode ser reiniciado');
    assert.equal(replay.servidorAgora, t1.toISOString());
    assert.equal(replay.possuiPedidoAtivo, true);
    assert.equal(replay.pedidoVinculado?.codigoPedido, 'OR-REPLAY-01');
    assert.equal(pecas.get(PECA_LOTE)?.quantidade_estoque, 3, 'Replay não pode debitar duas vezes');
  });
});
