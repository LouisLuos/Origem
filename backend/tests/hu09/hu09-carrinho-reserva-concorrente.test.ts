import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import {
  RESERVA_ERROR_CODES,
  RESERVA_TTL_MINUTOS,
  type CancelamentoReservaResultado,
  type ConfirmacaoReservaResultado,
  type CriarGrupoReservaInput,
  type ExpiracaoReservasResultado,
  type GrupoReservaResultado,
  type ReservaEstoqueRepository,
  type ReservaItemPersistido,
} from '../../src/repositories/contracts/reservas.contracts.js';
import { createEstoqueRoutes } from '../../src/routes/estoque.routes.js';
import { createReservaEstoqueService } from '../../src/services/reservaEstoque.service.js';
import { iniciarAgendadorExpiracaoReservas } from '../../src/services/reservaExpiracao.scheduler.js';
import { validarCriacaoReserva } from '../../src/validators/reserva.validator.js';
import { AppError } from '../../src/utils/AppError.js';

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

/**
 * Cria um repositório concorrente simulando a semântica exata de Lock Pessimista
 * (`SELECT ... FOR UPDATE`) do PostgreSQL na tabela `pecas` e `reservas`.
 */
function createConcurrentPessimisticReservaRepository(initialPecaStock: number) {
  let pecaEstoque = initialPecaStock;
  const reservas = new Map<string, ReservaItemPersistido>();
  const grupos = new Map<string, GrupoReservaResultado>();
  const idempotencyMap = new Map<string, GrupoReservaResultado>();

  // Mutex para simular fila de locks de tupla do PostgreSQL no nível da peça
  let lockChain: Promise<void> = Promise.resolve();
  function withPecaLock<T>(task: () => Promise<T>): Promise<T> {
    const next = lockChain.then(task, task);
    lockChain = next.then(() => undefined, () => undefined);
    return next;
  }

  const repo: ReservaEstoqueRepository = {
    async criarGrupoReserva(input: CriarGrupoReservaInput): Promise<GrupoReservaResultado> {
      const idempotencyComposite = `${input.usuarioId}:${input.idempotencyKey}`;
      const existing = idempotencyMap.get(idempotencyComposite);
      if (existing) {
        return { ...existing, idempotente: true };
      }

      return withPecaLock(async () => {
        // Checagem pós-lock (SELECT ... FOR UPDATE)
        const recheckExisting = idempotencyMap.get(idempotencyComposite);
        if (recheckExisting) {
          return { ...recheckExisting, idempotente: true };
        }

        const requestedQty = input.itens.reduce((acc, it) => acc + it.quantidade, 0);
        if (pecaEstoque < requestedQty) {
          throw new AppError(
            'Estoque insuficiente para a quantidade solicitada.',
            409,
            RESERVA_ERROR_CODES.ESTOQUE_INSUFICIENTE,
          );
        }

        // Decremento atômico
        pecaEstoque -= requestedQty;

        const grupoId = crypto.randomUUID();
        const now = new Date();
        const expiraEm = new Date(now.getTime() + 15 * 60 * 1000);

        const itemsPersistidos: ReservaItemPersistido[] = input.itens.map((it) => {
          const id = crypto.randomUUID();
          const item: ReservaItemPersistido = {
            id,
            grupoId,
            usuarioId: input.usuarioId,
            pecaId: it.pecaId,
            quantidade: it.quantidade,
            status: 'ATIVA',
            idempotencyKey: input.idempotencyKey,
            criadoEm: now.toISOString(),
            expiraEm: expiraEm.toISOString(),
            atualizadoEm: now.toISOString(),
            finalizadoEm: null,
            estoqueDevolvidoEm: null,
          };
          reservas.set(id, item);
          return item;
        });

        const grupoResult: GrupoReservaResultado = {
          grupoId,
          usuarioId: input.usuarioId,
          idempotencyKey: input.idempotencyKey,
          idempotente: false,
          criadoEm: now.toISOString(),
          expiraEm: expiraEm.toISOString(),
          ttlMinutos: RESERVA_TTL_MINUTOS,
          itens: itemsPersistidos,
        };

        grupos.set(grupoId, grupoResult);
        idempotencyMap.set(idempotencyComposite, grupoResult);
        return grupoResult;
      });
    },

    async listarReservasUsuario(usuarioId: string): Promise<GrupoReservaResultado[]> {
      return Array.from(grupos.values()).filter((g) => g.usuarioId === usuarioId);
    },

    async cancelarPorGrupo(grupoId: string, usuarioId: string): Promise<CancelamentoReservaResultado> {
      return withPecaLock(async () => {
        const grupo = grupos.get(grupoId);
        if (!grupo || grupo.usuarioId !== usuarioId) {
          throw new AppError('Reserva não encontrada.', 404);
        }

        let devolvidas = 0;
        const itensAtualizados: ReservaItemPersistido[] = [];
        for (const it of grupo.itens) {
          const itemAtual = reservas.get(it.id);
          if (itemAtual && itemAtual.status === 'ATIVA') {
            const atualizado: ReservaItemPersistido = {
              ...itemAtual,
              status: 'CANCELADA',
              atualizadoEm: new Date().toISOString(),
              estoqueDevolvidoEm: new Date().toISOString(),
            };
            reservas.set(it.id, atualizado);
            itensAtualizados.push(atualizado);
            pecaEstoque += it.quantidade;
            devolvidas += it.quantidade;
          }
        }

        return {
          grupoId,
          usuarioId,
          jaFinalizada: false,
          itensCancelados: itensAtualizados.length,
          unidadesDevolvidas: devolvidas,
          itens: itensAtualizados,
        };
      });
    },

    async cancelarReservaItem(reservaId: string, usuarioId: string): Promise<CancelamentoReservaResultado> {
      return withPecaLock(async () => {
        const item = reservas.get(reservaId);
        if (!item || item.usuarioId !== usuarioId) {
          throw new AppError('Item de reserva não encontrado.', 404);
        }
        let devolvidas = 0;
        const itensAtualizados: ReservaItemPersistido[] = [];
        if (item.status === 'ATIVA') {
          const atualizado: ReservaItemPersistido = {
            ...item,
            status: 'CANCELADA',
            atualizadoEm: new Date().toISOString(),
            estoqueDevolvidoEm: new Date().toISOString(),
          };
          reservas.set(reservaId, atualizado);
          itensAtualizados.push(atualizado);
          pecaEstoque += item.quantidade;
          devolvidas += item.quantidade;
        }
        return {
          grupoId: item.grupoId,
          usuarioId,
          jaFinalizada: false,
          itensCancelados: itensAtualizados.length,
          unidadesDevolvidas: devolvidas,
          itens: itensAtualizados,
        };
      });
    },

    async confirmarPorGrupo(grupoId: string, usuarioId: string): Promise<ConfirmacaoReservaResultado> {
      const grupo = grupos.get(grupoId);
      if (!grupo || grupo.usuarioId !== usuarioId) {
        throw new AppError('Reserva não encontrada.', 404);
      }
      return {
        grupoId,
        usuarioId,
        jaConfirmada: false,
        itensConfirmados: grupo.itens.length,
        itens: grupo.itens.map((it) => ({ ...it, status: 'CONFIRMADA' })),
      };
    },

    async expirarReservasVencidas(agora = new Date()): Promise<ExpiracaoReservasResultado> {
      return withPecaLock(async () => {
        let expiradas = 0;
        let devolvidas = 0;
        const pecasAfetadas = new Set<string>();

        for (const [id, item] of reservas.entries()) {
          if (item.status === 'ATIVA' && new Date(item.expiraEm) <= agora) {
            const atualizado: ReservaItemPersistido = {
              ...item,
              status: 'EXPIRADA',
              atualizadoEm: agora.toISOString(),
              estoqueDevolvidoEm: agora.toISOString(),
            };
            reservas.set(id, atualizado);
            pecaEstoque += item.quantidade;
            expiradas += 1;
            devolvidas += item.quantidade;
            pecasAfetadas.add(item.pecaId);
          }
        }

        return {
          reservasExpiradas: expiradas,
          unidadesDevolvidas: devolvidas,
          pecasAtualizadas: pecasAfetadas.size,
        };
      });
    },
  };

  return {
    repo,
    getEstoqueAtual: () => pecaEstoque,
    getReservas: () => Array.from(reservas.values()),
  };
}

describe('HU-09 — Carrinho Fracionado e Reserva Concorrente de Peça Única (Invariante 1)', () => {
  const PECA_UNICA_ID = '99999999-9999-4999-8999-999999999999';

  it('TC-STRESS-01: 50 compradores simultâneos disputando 1 peça única (estoque = 1) -> 1 HTTP 201 e 49 HTTP 409', async () => {
    // Cenário 2 BDD: Dado que uma peça única possui estoque = 1
    const { repo, getEstoqueAtual } = createConcurrentPessimisticReservaRepository(1);

    const authProvider: AuthIdentityProvider = {
      async verify({ bearerToken }) {
        const userId = bearerToken?.replace(/^tok:/, '');
        return userId
          ? { status: 'AUTHENTICATED', identity: { userId } }
          : { status: 'UNAUTHENTICATED', reason: 'Token ausente.' };
      },
    };

    const service = createReservaEstoqueService({ repository: repo });
    const app = express();
    app.use(express.json());
    app.use('/api/v1/estoque', createEstoqueRoutes({ authProvider, reservaService: service }));
    app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(err, req, res, next),
    );

    await withServer(app, async (baseUrl) => {
      // Dispara 50 requisições simultâneas de compradores distintos
      const totalCompradores = 50;
      const promessas = Array.from({ length: totalCompradores }, async (_, index) => {
        const compradorId = crypto.randomUUID();
        const idempotencyKey = `req-${index}-${crypto.randomUUID()}`;

        const res = await fetch(`${baseUrl}/api/v1/estoque/reservas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer tok:${compradorId}`,
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            lines: [{ productId: PECA_UNICA_ID, quantity: 1 }],
          }),
        });

        const status = res.status;
        const body = (await res.json()) as Record<string, unknown>;
        return { status, body };
      });

      const resultados = await Promise.all(promessas);

      const status201 = resultados.filter((r) => r.status === 201);
      const status409 = resultados.filter((r) => r.status === 409);

      // Critério BDD: Exatamente 1 comprador obtém a reserva com HTTP 201 Created
      assert.equal(status201.length, 1, 'Exatamente 1 comprador deve obter HTTP 201 Created');

      // Critério BDD: Exatamente 49 compradores recebem notificação de conflito com HTTP 409
      assert.equal(status409.length, 49, 'Exatamente 49 compradores devem receber HTTP 409 Conflict');

      // Zero Overselling: o estoque final não pode ser negativo
      assert.equal(getEstoqueAtual(), 0, 'Estoque final deve ser exatamente 0 (peça reservada)');
    });
  });

  it('Cenário 3 BDD: Expiração automática da reserva aos 15 minutos com devolução ao catálogo', async () => {
    const { repo, getEstoqueAtual } = createConcurrentPessimisticReservaRepository(1);

    const service = createReservaEstoqueService({ repository: repo });
    const compradorId = crypto.randomUUID();

    // 1. Reserva com sucesso (estoque vai de 1 para 0)
    const entradaValidada = validarCriacaoReserva(
      { lines: [{ productId: PECA_UNICA_ID, quantity: 1 }] },
      'idemp-expira-15m',
    );
    const grupo = await service.reservar(compradorId, entradaValidada);
    assert.equal(grupo.itens.length, 1);
    assert.equal(grupo.itens[0]?.status, 'ATIVA');
    assert.equal(getEstoqueAtual(), 0, 'Estoque deve ser debitado para 0');

    // 2. Simula o passar de 15 minutos e 1 segundo
    const tempoFuturo = new Date(Date.now() + 15 * 60 * 1000 + 1000);

    // 3. Executa a varredura do agendador
    const agendador = iniciarAgendadorExpiracaoReservas({ service, intervaloMs: 60_000 });
    try {
      const resultado = await service.expirarVencidas(tempoFuturo);
      assert.equal(resultado.reservasExpiradas, 1, '1 reserva deve ser expirada');
      assert.equal(resultado.unidadesDevolvidas, 1, '1 unidade deve ser devolvida');

      // 4. Critério BDD: Peça retorna imediatamente para status disponível no estoque
      assert.equal(getEstoqueAtual(), 1, 'Estoque deve retornar para 1');
    } finally {
      agendador.parar();
    }
  });

  it('Invariante de Idempotência: Repetição da mesma requisição pelo mesmo comprador não duplica reserva nem reduz estoque', async () => {
    const { repo, getEstoqueAtual } = createConcurrentPessimisticReservaRepository(1);
    const service = createReservaEstoqueService({ repository: repo });
    const compradorId = crypto.randomUUID();
    const chaveIdempotencia = 'chave-idempotencia-estavel-123';
    const entradaValidada = validarCriacaoReserva(
      { lines: [{ productId: PECA_UNICA_ID, quantity: 1 }] },
      chaveIdempotencia,
    );

    // Primeira chamada
    const res1 = await service.reservar(compradorId, entradaValidada);
    assert.equal(res1.idempotente, false);
    assert.equal(getEstoqueAtual(), 0);

    // Segunda chamada idêntica (retry de rede)
    const res2 = await service.reservar(compradorId, entradaValidada);
    assert.equal(res2.idempotente, true);
    assert.equal(res2.grupoId, res1.grupoId);
    assert.equal(getEstoqueAtual(), 0, 'Estoque não pode ficar negativo nem ser debitado duas vezes');
  });
});
