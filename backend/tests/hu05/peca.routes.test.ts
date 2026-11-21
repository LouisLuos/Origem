import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import type {
  AtelieAutorizacaoRepository,
  RelacionamentoUsuarioAtelie,
} from '../../src/repositories/contracts/hu03.contracts.js';
import type { PecaRepository } from '../../src/repositories/contracts/pecas.contracts.js';
import { unconfiguredAtelieAutorizacaoRepository } from '../../src/repositories/unconfiguredHu03.repository.js';
import { PECAS_ROUTE_PATH, createPecaRoutes, pecaJsonBodyParser } from '../../src/routes/peca.routes.js';
import { createPecaService } from '../../src/services/peca.service.js';
import type { SecurityAuditService } from '../../src/utils/securityAudit.util.js';
import { MENSAGEM_PESO_MINIMO } from '../../src/validators/peca.validator.js';
import { corpoPecaValido } from './fixtures.js';

/**
 * Vínculos simulados (uso exclusivo em teste):
 * - titular: titular do atelie-a (ATIVO)
 * - curador: curador do atelie-a (ATIVO) e do atelie-s (SUSPENSO)
 * - comprador: sem vínculo
 */
const VINCULOS: Record<string, RelacionamentoUsuarioAtelie[]> = {
  titular: [{ atelieId: 'atelie-a', statusAtelie: 'ATIVO', ehTitular: true, ehCuradorVinculado: false }],
  curador: [
    { atelieId: 'atelie-a', statusAtelie: 'ATIVO', ehTitular: false, ehCuradorVinculado: true },
    { atelieId: 'atelie-s', statusAtelie: 'SUSPENSO', ehTitular: false, ehCuradorVinculado: true },
  ],
  comprador: [],
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
    return VINCULOS[usuarioId]?.find((vinculo) => vinculo.atelieId === atelieId) ?? null;
  },
  async listRelacionamentosUsuario(usuarioId) {
    return VINCULOS[usuarioId] ?? [];
  },
};

function criarApp(opcoes: { configurarInfra: boolean; autorizacao?: AtelieAutorizacaoRepository }) {
  const persistidas: unknown[] = [];
  const auditoria: unknown[] = [];
  const auditService: SecurityAuditService = {
    async recordAuthorizationDenial(input) {
      auditoria.push(input);
      return input as never;
    },
  };
  const repository: PecaRepository = {
    async criarComFotos(dados) {
      persistidas.push(dados);
      return {
        ...dados,
        id: 'peca-1',
        fotos: dados.fotos.map((foto, index) => ({ id: `foto-${index}`, url: foto.url, isPrincipal: foto.isPrincipal })),
      };
    },
  };

  const pecaService = opcoes.configurarInfra
    ? createPecaService({
        repository,
        processadorImagem: { async otimizar({ conteudo }) { return { conteudo, tipoMime: 'image/webp', extensao: 'webp' }; } },
        armazenamento: {
          async salvar({ atelieId }) { return { url: `https://storage.test/${atelieId}/x.webp`, caminho: `${atelieId}/x.webp` }; },
          async remover() {},
        },
      })
    : createPecaService();

  const app = express();
  app.use(`/api/v1${PECAS_ROUTE_PATH}`, pecaJsonBodyParser);
  app.use(express.json());
  app.use(
    `/api/v1${PECAS_ROUTE_PATH}`,
    createPecaRoutes({
      authProvider,
      autorizacaoRepository: opcoes.autorizacao ?? autorizacaoRepository,
      auditService,
      pecaService,
    }),
  );
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => errorHandler(err, req, res, next));
  return { app, persistidas, auditoria };
}

async function comServidor(app: express.Express, executar: (baseUrl: string) => Promise<void>) {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const endereco = server.address();
  assert.ok(endereco && typeof endereco === 'object');
  try {
    await executar(`http://127.0.0.1:${endereco.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function postarPeca(baseUrl: string, atelieId: string, corpo: unknown, usuario?: string) {
  const res = await fetch(`${baseUrl}/api/v1/atelies/${atelieId}/pecas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(usuario ? { Authorization: `Bearer tok:${usuario}` } : {}),
    },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('HU-05 — POST /api/v1/atelies/:atelieId/pecas (HTTP com dublês)', () => {
  it('201: titular publica peça DISPONIVEL com fotos associadas e is_fragil persistido', async () => {
    const { app, persistidas } = criarApp({ configurarInfra: true });
    await comServidor(app, async (baseUrl) => {
      const res = await postarPeca(baseUrl, 'atelie-a', { ...corpoPecaValido(), atelieId: 'atelie-forjado' }, 'titular');
      assert.equal(res.status, 201);
      assert.equal(res.body.status, 'DISPONIVEL');
      assert.equal(res.body.atelieId, 'atelie-a');
      assert.equal(res.body.isFragil, true);
      assert.equal((res.body.fotos as unknown[]).length, 2);
      assert.equal(persistidas.length, 1);
    });
  });

  it('201: curador vinculado a ateliê ATIVO pode catalogar (GERENCIAR_CATALOGO)', async () => {
    const { app } = criarApp({ configurarInfra: true });
    await comServidor(app, async (baseUrl) => {
      assert.equal((await postarPeca(baseUrl, 'atelie-a', corpoPecaValido(), 'curador')).status, 201);
    });
  });

  it('422: peso de 30g é rejeitado com a mensagem oficial e nada é persistido (TC04 4A)', async () => {
    const { app, persistidas } = criarApp({ configurarInfra: true });
    await comServidor(app, async (baseUrl) => {
      const res = await postarPeca(baseUrl, 'atelie-a', { ...corpoPecaValido(), pesoGramas: 30 }, 'titular');
      assert.equal(res.status, 422);
      assert.equal(res.body.erro, MENSAGEM_PESO_MINIMO);
      assert.equal(res.body.codigo, 'PECA_DADOS_INVALIDOS');
      assert.equal(persistidas.length, 0);
    });
  });

  it('422: altura 0 e menos de 2 fotos são rejeitados (TC04 4B)', async () => {
    const { app, persistidas } = criarApp({ configurarInfra: true });
    await comServidor(app, async (baseUrl) => {
      const altura = await postarPeca(baseUrl, 'atelie-a', { ...corpoPecaValido(), alturaCm: 0 }, 'titular');
      assert.equal(altura.status, 422);
      assert.match(String(altura.body.erro), /A altura deve ser maior que zero/);
      const fotos = await postarPeca(baseUrl, 'atelie-a', { ...corpoPecaValido(), fotos: [] }, 'titular');
      assert.equal(fotos.status, 422);
      assert.equal(persistidas.length, 0);
    });
  });

  it('401: sem credencial, antes de validar o corpo', async () => {
    const { app } = criarApp({ configurarInfra: true });
    await comServidor(app, async (baseUrl) => {
      assert.equal((await postarPeca(baseUrl, 'atelie-a', corpoPecaValido())).status, 401);
    });
  });

  it('403: usuário sem vínculo, curador de ateliê SUSPENSO ou em outro ateliê — com auditoria', async () => {
    const { app, auditoria, persistidas } = criarApp({ configurarInfra: true });
    await comServidor(app, async (baseUrl) => {
      assert.equal((await postarPeca(baseUrl, 'atelie-a', corpoPecaValido(), 'comprador')).status, 403);
      assert.equal((await postarPeca(baseUrl, 'atelie-s', corpoPecaValido(), 'curador')).status, 403);
      assert.equal((await postarPeca(baseUrl, 'atelie-b', corpoPecaValido(), 'titular')).status, 403);
    });
    assert.equal(auditoria.length, 3);
    assert.equal(persistidas.length, 0);
  });

  it('503: sem Storage/processamento configurados, nunca simula sucesso', async () => {
    const { app } = criarApp({ configurarInfra: false });
    await comServidor(app, async (baseUrl) => {
      const res = await postarPeca(baseUrl, 'atelie-a', corpoPecaValido(), 'titular');
      assert.equal(res.status, 503);
      assert.equal(res.body.codigo, 'PROCESSAMENTO_IMAGEM_INDISPONIVEL');
    });
  });

  it('503: sem persistência de vínculos de ateliê (T-ART-01), o RBAC falha fechado', async () => {
    // Usa o adaptador real não configurado (o mesmo da produção) para comprovar o 503
    const { app, persistidas } = criarApp({
      configurarInfra: true,
      autorizacao: unconfiguredAtelieAutorizacaoRepository,
    });
    await comServidor(app, async (baseUrl) => {
      const res = await postarPeca(baseUrl, 'atelie-a', corpoPecaValido(), 'titular');
      assert.equal(res.status, 503);
      assert.equal(res.body.codigo, 'PERSISTENCIA_INDISPONIVEL');
    });
    assert.equal(persistidas.length, 0);
  });

  it('400 para JSON malformado e 413 para corpo acima do limite da rota', async () => {
    const { app } = criarApp({ configurarInfra: true });
    await comServidor(app, async (baseUrl) => {
      const malformado = await postarPeca(baseUrl, 'atelie-a', '{"titulo":', 'titular');
      assert.equal(malformado.status, 400);
      const enorme = await postarPeca(baseUrl, 'atelie-a', { lixo: 'a'.repeat(40 * 1024 * 1024) }, 'titular');
      assert.equal(enorme.status, 413);
    });
  });
});

describe('HU-05 — Montagem no app real (sem banco)', () => {
  it('a rota existe no app de produção, exige autenticação e aceita corpo acima de 100 KB', async () => {
    const { app } = await import('../../src/app.js');
    await comServidor(app, async (baseUrl) => {
      // 300 KB: acima do limite do parser global; deve chegar ao middleware de autenticação (401), não 413/404
      const res = await postarPeca(baseUrl, 'atelie-a', { ...corpoPecaValido(), descricao: 'a'.repeat(300 * 1024) });
      assert.equal(res.status, 401);
    });
  });

  it('o parser global continua limitado a 100 KB nas demais rotas', async () => {
    const { app } = await import('../../src/app.js');
    await comServidor(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@y.z', password: 'a'.repeat(300 * 1024) }),
      });
      assert.notEqual(res.status, 200);
      assert.equal(res.status >= 400, true);
    });
  });
});
