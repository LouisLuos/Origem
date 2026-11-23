import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { app as realApp } from '../../src/app.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { requestLogger } from '../../src/middlewares/requestLogger.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import {
  PERMISSOES_CURADOR_ATELIE,
  PERMISSOES_TITULAR_ATELIE,
  type ArtesaoPerfilRegistro,
  type AtelieAutorizacaoRepository,
  type AtelieFinanceiroRepository,
  type CuradorVinculoPersistido,
  type CuradorVinculoRepository,
  type DadosFinanceirosAteliePersistidos,
  type HabilitacaoArtesaoRepository,
  type RelacionamentoUsuarioAtelie,
  type UsuarioAtivoResumo,
} from '../../src/repositories/contracts/hu03.contracts.js';
import { ATELIE_ERROR_CODES } from '../../src/repositories/unconfiguredHu03.repository.js';
import { createArtesaoRoutes } from '../../src/routes/artesao.routes.js';
import { createAtelieRoutes } from '../../src/routes/atelie.routes.js';
import {
  buildPixKeyAad,
  createAtelieFinanceiroService,
} from '../../src/services/atelieFinanceiro.service.js';
import { createCuradoriaService } from '../../src/services/curadoria.service.js';
import { createHabilitacaoArtesaoService } from '../../src/services/habilitacaoArtesao.service.js';
import { createPixCryptoService } from '../../src/utils/pixCrypto.util.js';
import {
  createSecurityAuditService,
  type SecurityAuditEvent,
} from '../../src/utils/securityAudit.util.js';

const TEST_AES_KEY = crypto.randomBytes(32).toString('hex');

interface MockDatabaseState {
  usuarios: Map<string, UsuarioAtivoResumo>;
  artesaos: Map<string, ArtesaoPerfilRegistro>;
  atelies: Map<string, { id: string; nomeComercial: string; titularUsuarioId: string; status: 'ATIVO' | 'SUSPENSO' }>;
  vinculos: Map<string, CuradorVinculoPersistido>;
  financeiros: Map<string, DadosFinanceirosAteliePersistidos>;
  financeiroUpdateCalls: number;
  financeiroReadCalls: number;
  curadorWriteCalls: number;
  auditEvents: SecurityAuditEvent[];
}

function createIsolatedHu03Context() {
  const cryptoService = createPixCryptoService(() => TEST_AES_KEY);

  const initialCipherA = cryptoService.encrypt('52998224725', buildPixKeyAad('user-titular-a'));
  const initialCipherB = cryptoService.encrypt('mestre.b@origem.pe', buildPixKeyAad('user-titular-b'));

  const state: MockDatabaseState = {
    usuarios: new Map<string, UsuarioAtivoResumo>([
      ['user-comum', { id: 'user-comum', nome: 'Dona Maria', email: 'maria@origem.test', status: 'ATIVO' }],
      ['user-inativo', { id: 'user-inativo', nome: 'Conta Pausada', email: 'inativo@origem.test', status: 'INATIVO' }],
      ['user-titular-a', { id: 'user-titular-a', nome: 'Mestre A', email: 'titular.a@origem.test', status: 'ATIVO' }],
      ['user-titular-b', { id: 'user-titular-b', nome: 'Mestre B', email: 'titular.b@origem.test', status: 'ATIVO' }],
      ['user-curador', { id: 'user-curador', nome: 'Curador Operacional', email: 'curador@origem.test', status: 'ATIVO' }],
      ['user-sem-vinculo', { id: 'user-sem-vinculo', nome: 'Terceiro', email: 'terceiro@origem.test', status: 'ATIVO' }],
    ]),
    artesaos: new Map<string, ArtesaoPerfilRegistro>([
      [
        'user-titular-a',
        {
          id: 'art-db-1',
          usuarioId: 'user-titular-a',
          biografiaCultural: 'Ceramista tradicional do Alto do Moura.',
          tipoChavePix: 'CPF',
          chavePixCriptografada: initialCipherA,
        },
      ],
    ]),
    atelies: new Map([
      ['atelie-a', { id: 'atelie-a', nomeComercial: 'Ateliê Barro Vivo', titularUsuarioId: 'user-titular-a', status: 'ATIVO' }],
      ['atelie-b', { id: 'atelie-b', nomeComercial: 'Ateliê Xilo Agreste', titularUsuarioId: 'user-titular-b', status: 'ATIVO' }],
      ['atelie-s', { id: 'atelie-s', nomeComercial: 'Ateliê Suspenso', titularUsuarioId: 'user-titular-b', status: 'SUSPENSO' }],
    ]),
    vinculos: new Map<string, CuradorVinculoPersistido>([
      [
        'atelie-a:user-curador',
        {
          vinculoId: 'vinc-1',
          atelieId: 'atelie-a',
          usuarioId: 'user-curador',
          nome: 'Curador Operacional',
          email: 'curador@origem.test',
          criadoEm: '2026-11-18T10:00:00.000Z',
        },
      ],
      // user-titular-a também atua como curador nos ateliês B (ATIVO) e S (SUSPENSO)
      [
        'atelie-b:user-titular-a',
        {
          vinculoId: 'vinc-2',
          atelieId: 'atelie-b',
          usuarioId: 'user-titular-a',
          nome: 'Mestre A',
          email: 'titular.a@origem.test',
          criadoEm: '2026-11-18T10:05:00.000Z',
        },
      ],
      [
        'atelie-s:user-titular-a',
        {
          vinculoId: 'vinc-3',
          atelieId: 'atelie-s',
          usuarioId: 'user-titular-a',
          nome: 'Mestre A',
          email: 'titular.a@origem.test',
          criadoEm: '2026-11-18T10:10:00.000Z',
        },
      ],
    ]),
    financeiros: new Map<string, DadosFinanceirosAteliePersistidos>([
      [
        'atelie-a',
        {
          atelieId: 'atelie-a',
          artesaoId: 'art-db-1',
          titularUsuarioId: 'user-titular-a',
          tipoChavePix: 'CPF',
          chavePixCriptografada: initialCipherA,
          atualizadoEm: '2026-11-18T09:00:00.000Z',
        },
      ],
      [
        'atelie-b',
        {
          atelieId: 'atelie-b',
          artesaoId: 'art-db-2',
          titularUsuarioId: 'user-titular-b',
          tipoChavePix: 'EMAIL',
          chavePixCriptografada: initialCipherB,
          atualizadoEm: '2026-11-18T09:00:00.000Z',
        },
      ],
    ]),
    financeiroUpdateCalls: 0,
    financeiroReadCalls: 0,
    curadorWriteCalls: 0,
    auditEvents: [],
  };

  const authProvider: AuthIdentityProvider = {
    async verify(credentials) {
      const token = credentials.bearerToken;
      if (token && token.startsWith('tok:')) {
        const userId = token.slice(4);
        if (state.usuarios.has(userId) || userId === 'user-fantasma') {
          return {
            status: 'AUTHENTICATED',
            identity: { userId, email: `${userId}@origem.test` },
          };
        }
      }
      return { status: 'UNAUTHENTICATED', reason: 'Credencial inválida.' };
    },
  };

  const habilitacaoRepo: HabilitacaoArtesaoRepository = {
    async findUsuarioPorId(usuarioId) {
      return state.usuarios.get(usuarioId) ?? null;
    },
    async findArtesaoPorUsuarioId(usuarioId) {
      return state.artesaos.get(usuarioId) ?? null;
    },
    async habilitarArtesaoComPapel(dados) {
      const registro: ArtesaoPerfilRegistro = {
        id: `art-db-${state.artesaos.size + 1}`,
        usuarioId: dados.usuarioId,
        biografiaCultural: dados.biografiaCultural,
        tipoChavePix: dados.tipoChavePix,
        chavePixCriptografada: dados.chavePixCriptografada,
        criadoEm: '2026-11-18T12:00:00.000Z',
      };
      state.artesaos.set(dados.usuarioId, registro);
      return registro;
    },
  };

  const autorizacaoRepo: AtelieAutorizacaoRepository = {
    async findRelacionamentoUsuarioAtelie(usuarioId, atelieId) {
      const atelie = state.atelies.get(atelieId);
      if (!atelie) return null;
      return {
        atelieId: atelie.id,
        nomeComercial: atelie.nomeComercial,
        statusAtelie: atelie.status,
        ehTitular: atelie.titularUsuarioId === usuarioId,
        ehCuradorVinculado: state.vinculos.has(`${atelieId}:${usuarioId}`),
      };
    },
    async listRelacionamentosUsuario(usuarioId) {
      const list: RelacionamentoUsuarioAtelie[] = [];
      for (const atelie of state.atelies.values()) {
        const ehTitular = atelie.titularUsuarioId === usuarioId;
        const ehCuradorVinculado = state.vinculos.has(`${atelie.id}:${usuarioId}`);
        if (ehTitular || ehCuradorVinculado) {
          list.push({
            atelieId: atelie.id,
            nomeComercial: atelie.nomeComercial,
            statusAtelie: atelie.status,
            ehTitular,
            ehCuradorVinculado,
          });
        }
      }
      return list;
    },
  };

  const financeiroRepo: AtelieFinanceiroRepository = {
    async findDadosFinanceirosPorAtelie(atelieId) {
      state.financeiroReadCalls += 1;
      return state.financeiros.get(atelieId) ?? null;
    },
    async atualizarChavePixCriptografada(atelieId, chavePixCriptografada, tipoChavePix) {
      state.financeiroUpdateCalls += 1;
      const current = state.financeiros.get(atelieId)!;
      const updatedAt = '2026-11-18T20:30:00.000Z';
      state.financeiros.set(atelieId, {
        ...current,
        chavePixCriptografada,
        tipoChavePix,
        atualizadoEm: updatedAt,
      });
      return {
        atelieId,
        artesaoId: current.artesaoId,
        tipoChavePix,
        atualizadoEm: updatedAt,
      };
    },
  };

  const curadorRepo: CuradorVinculoRepository = {
    async findUsuarioPorEmail(emailNormalizado) {
      for (const user of state.usuarios.values()) {
        if (user.email === emailNormalizado) return user;
      }
      return null;
    },
    async findVinculo(atelieId, usuarioId) {
      return state.vinculos.get(`${atelieId}:${usuarioId}`) ?? null;
    },
    async listVinculosPorAtelie(atelieId) {
      const result: CuradorVinculoPersistido[] = [];
      for (const vinculo of state.vinculos.values()) {
        if (vinculo.atelieId === atelieId) {
          result.push(vinculo);
        }
      }
      return result;
    },
    async vincularCuradorNoAtelie(atelieId, curadorUsuarioId) {
      state.curadorWriteCalls += 1;
      const user = state.usuarios.get(curadorUsuarioId)!;
      const created: CuradorVinculoPersistido = {
        vinculoId: `vinc-${state.vinculos.size + 10}`,
        atelieId,
        usuarioId: curadorUsuarioId,
        nome: user.nome,
        email: user.email,
        criadoEm: '2026-11-18T20:35:00.000Z',
      };
      state.vinculos.set(`${atelieId}:${curadorUsuarioId}`, created);
      return created;
    },
    async desvincularCuradorDoAtelie(atelieId, curadorUsuarioId) {
      state.curadorWriteCalls += 1;
      return state.vinculos.delete(`${atelieId}:${curadorUsuarioId}`);
    },
  };

  const auditService = createSecurityAuditService({
    record(event) {
      state.auditEvents.push(event);
    },
  });

  const testApp = express();
  testApp.use(express.json());
  testApp.use(requestLogger);

  testApp.use(
    '/api/v1/artesaos',
    createArtesaoRoutes({
      authProvider,
      habilitacaoService: createHabilitacaoArtesaoService({
        repository: habilitacaoRepo,
        cryptoService,
      }),
    }),
  );

  testApp.use(
    '/api/v1/atelies',
    createAtelieRoutes({
      authProvider,
      autorizacaoRepository: autorizacaoRepo,
      auditService,
      financeiroService: createAtelieFinanceiroService({
        repository: financeiroRepo,
        cryptoService,
      }),
      curadoriaService: createCuradoriaService({
        curadorRepository: curadorRepo,
        autorizacaoRepository: autorizacaoRepo,
      }),
    }),
  );

  testApp.use(
    (err: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(err, req, res, next),
  );

  return { state, testApp, cryptoService, authProvider, initialCipherA };
}

async function listenEphemeral(expressApp: express.Express): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server: Server = await new Promise((resolve) => {
    const s = expressApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Falha ao obter porta efêmera.');
  }
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

describe('Etapa C4 — Rotas isoladas com mocks (cenário TC02 e regras de domínio)', () => {
  it('TC02 isolado: bloqueia CURADOR tentando PATCH de Chave Pix e GET financeiro com 403 antes de tocar no repositório financeiro', async () => {
    const { state, testApp, initialCipherA } = createIsolatedHu03Context();
    const { baseUrl, close } = await listenEphemeral(testApp);

    try {
      const resPatch = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/chave-pix`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok:user-curador',
          'X-Request-Id': 'corr-tc02-patch-01',
        },
        body: JSON.stringify({ chavePix: '+5581999998888', role: 'ARTESAO', ehTitular: true }),
      });

      assert.equal(resPatch.status, 403);
      const patchBody = (await resPatch.json()) as { codigo?: string };
      assert.equal(patchBody.codigo, ATELIE_ERROR_CODES.ACESSO_FINANCEIRO_BLOQUEADO);

      const resFin = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/financeiro`, {
        headers: { Authorization: 'Bearer tok:user-curador', 'X-Request-Id': 'corr-tc02-get-01' },
      });
      assert.equal(resFin.status, 403);

      const resCurators = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores`, {
        headers: { Authorization: 'Bearer tok:user-curador' },
      });
      assert.equal(resCurators.status, 403);

      // Invariante crítica: repositório financeiro não foi chamado e ciphertext original segue intocado
      assert.equal(state.financeiroUpdateCalls, 0);
      assert.equal(state.financeiroReadCalls, 0);
      assert.equal(state.financeiros.get('atelie-a')?.chavePixCriptografada, initialCipherA);

      // Auditoria gravada sem vazar Chave Pix nem Bearer token
      assert.equal(state.auditEvents.length, 3);
      assert.equal(state.auditEvents[0]?.eventType, 'FINANCIAL_ACCESS_DENIED');
      assert.equal(state.auditEvents[0]?.correlationId, 'corr-tc02-patch-01');
      const serialized = JSON.stringify(state.auditEvents);
      assert.equal(serialized.includes('5581999998888'), false);
      assert.equal(serialized.includes('tok:user-curador'), false);
    } finally {
      await close();
    }
  });

  it('habilita artesão titular, criptografa Pix e bloqueia usuário inválido ou duplicado', async () => {
    const { state, testApp, cryptoService } = createIsolatedHu03Context();
    const { baseUrl, close } = await listenEphemeral(testApp);

    try {
      // Habilitação válida para usuário comum ativo
      const okRes = await fetch(`${baseUrl}/api/v1/artesaos/habilitacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok:user-comum',
        },
        body: JSON.stringify({
          biografiaCultural: 'Trabalho com renda renascença em Pesqueira desde 2010.',
          chavePix: '529.982.247-25',
        }),
      });
      assert.equal(okRes.status, 201);
      const okJson = (await okRes.json()) as {
        usuarioId: string;
        papelAssociado: string;
        chavePix: { tipo: string; mascarada: string; verificacaoDict: string };
      };
      assert.equal(okJson.usuarioId, 'user-comum');
      assert.equal(okJson.papelAssociado, 'ARTESAO');
      assert.equal(okJson.chavePix.tipo, 'CPF');
      assert.equal(okJson.chavePix.mascarada, '***.982.247-**');
      assert.equal(okJson.chavePix.verificacaoDict, 'NAO_VERIFICADA_LOCALMENTE');
      assert.equal(JSON.stringify(okJson).includes('52998224725'), false);

      // Ciphertext armazenado ≠ plaintext e descriptografa com o AAD do usuário
      const saved = state.artesaos.get('user-comum');
      assert.ok(saved);
      assert.notEqual(saved.chavePixCriptografada, '52998224725');
      assert.equal(
        cryptoService.decrypt(saved.chavePixCriptografada, buildPixKeyAad('user-comum')),
        '52998224725',
      );

      // Segunda tentativa (duplicada) -> 409
      const dupRes = await fetch(`${baseUrl}/api/v1/artesaos/habilitacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-comum' },
        body: JSON.stringify({
          biografiaCultural: 'Tentativa repetida com mais de vinte caracteres.',
          chavePix: '52998224725',
        }),
      });
      assert.equal(dupRes.status, 409);

      // Entrada inválida -> 400
      const badRes = await fetch(`${baseUrl}/api/v1/artesaos/habilitacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-sem-vinculo' },
        body: JSON.stringify({ biografiaCultural: 'curta', chavePix: '11111111111' }),
      });
      assert.equal(badRes.status, 400);

      // Usuário inativo -> 422
      const inactiveRes = await fetch(`${baseUrl}/api/v1/artesaos/habilitacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-inativo' },
        body: JSON.stringify({
          biografiaCultural: 'Biografia válida para usuário com conta suspensa.',
          chavePix: '52998224725',
        }),
      });
      assert.equal(inactiveRes.status, 422);

      // Usuário inexistente no banco -> 404
      const ghostRes = await fetch(`${baseUrl}/api/v1/artesaos/habilitacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-fantasma' },
        body: JSON.stringify({
          biografiaCultural: 'Biografia válida para usuário inexistente no banco.',
          chavePix: '52998224725',
        }),
      });
      assert.equal(ghostRes.status, 404);
    } finally {
      await close();
    }
  });

  it('permite titular consultar/atualizar Pix do próprio ateliê (mascarado e criptografado) e bloqueia acesso ao ateliê alheio', async () => {
    const { state, testApp, cryptoService } = createIsolatedHu03Context();
    const { baseUrl, close } = await listenEphemeral(testApp);

    try {
      // Titular A consulta resumo financeiro de A -> 200 sem plaintext
      const resGetA = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/financeiro`, {
        headers: { Authorization: 'Bearer tok:user-titular-a' },
      });
      assert.equal(resGetA.status, 200);
      const getABody = (await resGetA.json()) as {
        atelieId: string;
        chavePix: { cadastrada: boolean; tipo: string; mascarada: string };
      };
      assert.equal(getABody.atelieId, 'atelie-a');
      assert.equal(getABody.chavePix.cadastrada, true);
      assert.equal(getABody.chavePix.mascarada, '***.982.247-**');
      assert.equal(JSON.stringify(getABody).includes('52998224725'), false);

      // Titular A atualiza Pix de A -> 200
      const resPatchA = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/chave-pix`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-titular-a' },
        body: JSON.stringify({ chavePix: '+55 (81) 99999-8888' }),
      });
      assert.equal(resPatchA.status, 200);
      const patchABody = (await resPatchA.json()) as {
        chavePix: { tipo: string; mascarada: string };
      };
      assert.equal(patchABody.chavePix.tipo, 'TELEFONE');
      assert.equal(patchABody.chavePix.mascarada, '+5581*****8888');
      assert.equal(
        cryptoService.decrypt(
          state.financeiros.get('atelie-a')!.chavePixCriptografada,
          buildPixKeyAad('user-titular-a'),
        ),
        '+5581999998888',
      );

      // GET /financeiro reflete nova chave mascarada sem vazar plaintext
      const resGetAAfter = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/financeiro`, {
        headers: { Authorization: 'Bearer tok:user-titular-a' },
      });
      const getAAfterBody = (await resGetAAfter.json()) as { chavePix: { mascarada: string } };
      assert.equal(getAAfterBody.chavePix.mascarada, '+5581*****8888');

      // Titular A tenta alterar Pix do Ateliê B (onde é apenas curador) -> 403 + auditoria
      const resCrossPatch = await fetch(`${baseUrl}/api/v1/atelies/atelie-b/chave-pix`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-titular-a' },
        body: JSON.stringify({ chavePix: '52998224725' }),
      });
      assert.equal(resCrossPatch.status, 403);
      assert.equal(state.auditEvents.length, 1);
    } finally {
      await close();
    }
  });

  it('lista vínculos contextuais múltiplos e executa gestão completa de curadores', async () => {
    const { testApp } = createIsolatedHu03Context();
    const { baseUrl, close } = await listenEphemeral(testApp);

    try {
      // GET /meus-vinculos (estática antes de /:atelieId) retorna titularidade em A e curadoria em B/S
      const resLinks = await fetch(`${baseUrl}/api/v1/atelies/meus-vinculos`, {
        headers: { Authorization: 'Bearer tok:user-titular-a' },
      });
      assert.equal(resLinks.status, 200);
      const linksBody = (await resLinks.json()) as {
        dados: Array<{ atelieId: string; papelNoAtelie: string; permissoes: string[] }>;
      };
      assert.equal(linksBody.dados.length, 3);
      const ctxA = linksBody.dados.find((c) => c.atelieId === 'atelie-a');
      const ctxB = linksBody.dados.find((c) => c.atelieId === 'atelie-b');
      const ctxS = linksBody.dados.find((c) => c.atelieId === 'atelie-s');
      assert.equal(ctxA?.papelNoAtelie, 'TITULAR');
      assert.deepEqual(ctxA?.permissoes, PERMISSOES_TITULAR_ATELIE);
      assert.equal(ctxB?.papelNoAtelie, 'CURADOR');
      assert.deepEqual(ctxB?.permissoes, PERMISSOES_CURADOR_ATELIE);
      assert.equal(ctxS?.papelNoAtelie, 'CURADOR');
      assert.deepEqual(ctxS?.permissoes, []);

      // Listar curadores existentes de A -> 200
      const listBefore = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores`, {
        headers: { Authorization: 'Bearer tok:user-titular-a' },
      });
      assert.equal(listBefore.status, 200);
      assert.equal(((await listBefore.json()) as { dados: unknown[] }).dados.length, 1);

      // Associar novo curador ativo por e-mail -> 201 com permissões estritas de catálogo e etiquetas
      const addOk = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-titular-a' },
        body: JSON.stringify({ email: '  MARIA@ORIGEM.TEST ' }),
      });
      assert.equal(addOk.status, 201);
      const addBody = (await addOk.json()) as {
        usuarioId: string;
        papelNoAtelie: string;
        permissoes: string[];
      };
      assert.equal(addBody.usuarioId, 'user-comum');
      assert.equal(addBody.papelNoAtelie, 'CURADOR');
      assert.deepEqual(addBody.permissoes, PERMISSOES_CURADOR_ATELIE);

      // Duplicidade -> 409
      const addDup = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-titular-a' },
        body: JSON.stringify({ email: 'maria@origem.test' }),
      });
      assert.equal(addDup.status, 409);

      // Usuário inexistente -> 404 (não cria automaticamente)
      const addMissing = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-titular-a' },
        body: JSON.stringify({ email: 'naoexiste@origem.test' }),
      });
      assert.equal(addMissing.status, 404);

      // Usuário inativo -> 422
      const addInactive = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-titular-a' },
        body: JSON.stringify({ email: 'inativo@origem.test' }),
      });
      assert.equal(addInactive.status, 422);

      // Auto-vinculação do titular -> 422
      const addSelf = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok:user-titular-a' },
        body: JSON.stringify({ email: 'titular.a@origem.test' }),
      });
      assert.equal(addSelf.status, 422);

      // Remover curador vinculado -> 204
      const delOk = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores/user-comum`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok:user-titular-a' },
      });
      assert.equal(delOk.status, 204);

      // Remover novamente -> 404
      const delMissing = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores/user-comum`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok:user-titular-a' },
      });
      assert.equal(delMissing.status, 404);

      // Tentar remover a própria titularidade -> 422
      const delSelf = await fetch(`${baseUrl}/api/v1/atelies/atelie-a/curadores/user-titular-a`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok:user-titular-a' },
      });
      assert.equal(delSelf.status, 422);
    } finally {
      await close();
    }
  });

  it('retorna 503 quando a persistência padrão está ausente', async () => {
    const { authProvider } = createIsolatedHu03Context();
    const appNoDb = express();
    appNoDb.use(express.json());
    // As instâncias de produção usam repositórios Prisma reais; aqui os adaptadores fail-closed
    // (padrão das factories) são injetados explicitamente para comprovar o 503 sem persistência.
    appNoDb.use(
      '/api/v1/artesaos',
      createArtesaoRoutes({ authProvider, habilitacaoService: createHabilitacaoArtesaoService() }),
    );
    appNoDb.use(
      '/api/v1/atelies',
      createAtelieRoutes({
        authProvider,
        // Auditoria em memória: testes unitários nunca gravam no banco compartilhado
        auditService: createSecurityAuditService({ record: () => undefined }),
        financeiroService: createAtelieFinanceiroService(),
        curadoriaService: createCuradoriaService(),
      }),
    );
    appNoDb.use(
      (err: unknown, req: Request, res: Response, next: NextFunction) =>
        errorHandler(err, req, res, next),
    );

    const { baseUrl, close } = await listenEphemeral(appNoDb);
    try {
      const checks: Array<{ method: string; path: string; body?: unknown }> = [
        {
          method: 'POST',
          path: '/api/v1/artesaos/habilitacao',
          body: {
            biografiaCultural: 'Ceramista tradicional de Pernambuco há vinte anos.',
            chavePix: '52998224725',
          },
        },
        { method: 'GET', path: '/api/v1/atelies/meus-vinculos' },
        { method: 'GET', path: '/api/v1/atelies/atelie-a/financeiro' },
        {
          method: 'PATCH',
          path: '/api/v1/atelies/atelie-a/chave-pix',
          body: { chavePix: '52998224725' },
        },
        { method: 'GET', path: '/api/v1/atelies/atelie-a/curadores' },
        {
          method: 'POST',
          path: '/api/v1/atelies/atelie-a/curadores',
          body: { email: 'curador@origem.test' },
        },
        { method: 'DELETE', path: '/api/v1/atelies/atelie-a/curadores/user-curador' },
      ];

      for (const check of checks) {
        const res = await fetch(`${baseUrl}${check.path}`, {
          method: check.method,
          headers: {
            Authorization: 'Bearer tok:user-titular-a',
            ...(check.body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(check.body ? { body: JSON.stringify(check.body) } : {}),
        });
        assert.equal(res.status, 503);
        const json = (await res.json()) as { codigo?: string };
        assert.equal(json.codigo, ATELIE_ERROR_CODES.PERSISTENCIA_INDISPONIVEL);
      }
    } finally {
      await close();
    }
  });
});

describe('Etapa C4 — Aplicação real (app.ts): não regressão e modo fail-closed em produção', () => {
  it('preserva /health, /produtos e /artesaos existentes sem regressão', async () => {
    const { baseUrl, close } = await listenEphemeral(realApp);

    try {
      const resHealth = await fetch(`${baseUrl}/api/v1/health`);
      assert.equal(resHealth.status, 200);
      assert.ok(resHealth.headers.get('x-correlation-id'));

      const resProdutoP01 = await fetch(`${baseUrl}/api/v1/produtos/p01`);
      assert.equal(resProdutoP01.status, 200);
      const produtoP01Body = (await resProdutoP01.json()) as { id: string };
      assert.equal(produtoP01Body.id, 'p01');

      const resProdutos = await fetch(`${baseUrl}/api/v1/produtos`);
      assert.equal(resProdutos.status, 200);
      const produtosBody = (await resProdutos.json()) as {
        dados: unknown[];
        meta: { totalItens: number };
      };
      assert.equal(produtosBody.meta.totalItens, 14);
      assert.equal(produtosBody.dados.length, 10);

      const resProdutosLimit = await fetch(`${baseUrl}/api/v1/produtos?limit=100`);
      assert.equal(resProdutosLimit.status, 200);
      const produtosLimitBody = (await resProdutosLimit.json()) as {
        dados: unknown[];
        meta: { totalItens: number; itensPorPagina: number };
      };
      assert.equal(produtosLimitBody.meta.totalItens, 14);
      assert.equal(produtosLimitBody.meta.itensPorPagina, 100);
      assert.equal(produtosLimitBody.dados.length, 14);

      const resArtesaos = await fetch(`${baseUrl}/api/v1/artesaos`);
      assert.equal(resArtesaos.status, 200);
      const artesaosBody = (await resArtesaos.json()) as {
        dados: Array<{ id: string }>;
        meta: { totalItens: number };
      };
      assert.ok(artesaosBody.meta.totalItens >= 10);
      assert.equal(artesaosBody.dados.length, 10);

      const resArtesaosLimit = await fetch(`${baseUrl}/api/v1/artesaos?limit=100`);
      assert.equal(resArtesaosLimit.status, 200);
      const artesaosLimitBody = (await resArtesaosLimit.json()) as {
        dados: Array<{ id: string }>;
        meta: { totalItens: number; itensPorPagina: number };
      };
      assert.equal(artesaosLimitBody.meta.itensPorPagina, 100);
      assert.equal(artesaosLimitBody.dados.length, artesaosLimitBody.meta.totalItens);

      const resMestre = await fetch(`${baseUrl}/api/v1/artesaos/art-mestre-severino`);
      assert.equal(resMestre.status, 200);
      const mestreBody = (await resMestre.json()) as { id: string; name: string };
      assert.equal(mestreBody.id, 'art-mestre-severino');
    } finally {
      await close();
    }
  });

  it('retorna 401 sem credencial e falha fechado sem autenticação configurada', async () => {
    const { baseUrl, close } = await listenEphemeral(realApp);

    const hu03Routes: Array<{ method: string; path: string }> = [
      { method: 'POST', path: '/api/v1/artesaos/habilitacao' },
      { method: 'GET', path: '/api/v1/atelies/meus-vinculos' },
      { method: 'GET', path: '/api/v1/atelies/atelie-a/financeiro' },
      { method: 'PATCH', path: '/api/v1/atelies/atelie-a/chave-pix' },
      { method: 'GET', path: '/api/v1/atelies/atelie-a/curadores' },
      { method: 'POST', path: '/api/v1/atelies/atelie-a/curadores' },
      { method: 'DELETE', path: '/api/v1/atelies/atelie-a/curadores/user-2' },
    ];

    try {
      for (const route of hu03Routes) {
        const resNoAuth = await fetch(`${baseUrl}${route.path}`, { method: route.method });
        assert.equal(resNoAuth.status, 401);

        const resWithBearer = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers: { Authorization: 'Bearer token-qualquer-sem-hu01' },
        });
        assert.equal(resWithBearer.status, 401);
      }
    } finally {
      await close();
    }
  });
});
