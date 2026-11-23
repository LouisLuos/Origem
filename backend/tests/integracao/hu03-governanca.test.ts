/**
 * Integração REAL da  (com  e ): PostgreSQL + Prisma + JWT + RBAC contextual +
 * auditoria durável, pela API HTTP do app de produção. Sem mocks.
 *
 * Executa apenas com RUN_DB_INTEGRATION=1 e DATABASE_URL LOCAL (banco isolado com migrations).
 * Os triggers de falha usados nos testes de rollback (L3) são criados e removidos SOMENTE no banco
 * isolado.
 */
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

const habilitado = process.env.RUN_DB_INTEGRATION === '1';
const bancoLocal = /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(process.env.DATABASE_URL ?? '');
if (habilitado && !bancoLocal) {
  throw new Error('Integração recusada: DATABASE_URL precisa apontar para um banco LOCAL isolado.');
}

const PORTA = 3196;
const BASE = `http://127.0.0.1:${PORTA}`;

function gerarCpf(semente: number): string {
  const base = String(100000000 + (semente % 800000000)).slice(0, 9).split('').map(Number);
  const digito = (numeros: number[]) => {
    const resto = (numeros.reduce((acc, n, i) => acc + n * (numeros.length + 1 - i), 0) * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(base);
  return [...base, d1, digito([...base, d1])].join('');
}

interface Usuario {
  readonly id: string;
  readonly email: string;
  readonly cookie: string;
}

describe('Governança com infraestrutura real (banco isolado)', { skip: !habilitado }, () => {
  let server: Server;
  let prisma: typeof import('../../src/config/database.js')['prisma'];
  let pixCrypto: typeof import('../../src/utils/pixCrypto.util.js')['pixCryptoService'];
  let buildPixKeyAad: typeof import('../../src/services/atelieFinanceiro.service.js')['buildPixKeyAad'];
  const sufixo = Date.now();
  let semente = sufixo;

  async function chamar(metodo: string, rota: string, corpo?: unknown, cookie?: string, correlationId?: string) {
    const res = await fetch(`${BASE}/api/v1${rota}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(correlationId ? { 'X-Request-Id': correlationId } : {}),
      },
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
    const texto = await res.text();
    return {
      status: res.status,
      body: (texto ? JSON.parse(texto) : null) as Record<string, any>,
      texto,
      cookie: res.headers.get('set-cookie')?.split(';')[0],
    };
  }

  async function cadastrar(apelido: string): Promise<Usuario> {
    semente += 7919;
    const email = `${apelido}.${sufixo}@origem.test`;
    const res = await chamar('POST', '/auth/register', {
      name: `Usuario ${apelido} Teste`,
      email,
      cpfCnpj: gerarCpf(semente),
      whatsapp: '81988887777',
      password: 'Senha@Forte1',
    });
    assert.equal(res.status, 201, res.texto);
    return { id: res.body.user.id, email, cookie: res.cookie as string };
  }

  async function habilitar(usuario: Usuario, chavePix = usuario.email) {
    return chamar(
      'POST',
      '/artesaos/habilitacao',
      { biografiaCultural: 'Rendeira de Pesqueira há trinta anos, ensina a técnica às netas.', chavePix, tipoChavePix: 'EMAIL' },
      usuario.cookie,
    );
  }

  async function criarAtelie(usuario: Usuario, nome: string) {
    const res = await chamar(
      'POST',
      '/atelies',
      {
        nomeComercial: nome,
        poloCultural: 'Pesqueira',
        endereco: { cep: '55200000', logradouro: 'Rua da Renda', numero: '5', bairro: 'Centro', cidade: 'Pesqueira', uf: 'PE' },
      },
      usuario.cookie,
    );
    assert.equal(res.status, 201, res.texto);
    return res.body.id as string;
  }

  async function papeis(usuarioId: string) {
    return (await prisma.usuarioPapel.findMany({ where: { usuarioId } })).map((p) => p.papel).sort();
  }

  const estado: { titular?: Usuario; titularB?: Usuario; curador?: Usuario; atelieA?: string; atelieB?: string } = {};

  before(async () => {
    process.env.PIX_ENCRYPTION_KEY ||= 'a'.repeat(31) + 'b'.repeat(33);
    const { app } = await import('../../src/app.js');
    ({ prisma } = await import('../../src/config/database.js'));
    ({ pixCryptoService: pixCrypto } = await import('../../src/utils/pixCrypto.util.js'));
    ({ buildPixKeyAad } = await import('../../src/services/atelieFinanceiro.service.js'));
    server = await new Promise((resolve) => {
      const s = app.listen(PORTA, '127.0.0.1', () => resolve(s));
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma?.$disconnect();
  });

  it('Cenário 1: habilitação persiste artesão, associa ARTESAO e cifra a Chave Pix sem expô-la', async () => {
    estado.titular = await cadastrar('titular');
    const res = await habilitar(estado.titular);
    assert.equal(res.status, 201, res.texto);
    assert.equal(res.body.papelAssociado, 'ARTESAO');
    assert.ok(!res.texto.includes(estado.titular.email), 'resposta não pode conter a Chave Pix em claro');

    assert.deepEqual(await papeis(estado.titular.id), ['ARTESAO', 'COMPRADOR']);
    const artesao = await prisma.artesao.findUnique({ where: { usuarioId: estado.titular.id } });
    assert.ok(artesao);
    assert.ok(!artesao.chavePixCriptografada.includes(estado.titular.email));
    assert.equal(pixCrypto.decrypt(artesao.chavePixCriptografada, buildPixKeyAad(estado.titular.id)), estado.titular.email);
  });

  it('L1: papel duplicado é impedido pelo banco e a habilitação repetida responde 409 sem duplicar', async () => {
    const titular = estado.titular as Usuario;
    await assert.rejects(
      prisma.usuarioPapel.create({ data: { usuarioId: titular.id, papel: 'ARTESAO' } }),
      (err: { code?: string }) => err.code === 'P2002',
    );
    assert.equal((await habilitar(titular)).status, 409);
    assert.equal(await prisma.usuarioPapel.count({ where: { usuarioId: titular.id, papel: 'ARTESAO' } }), 1);
    assert.equal(await prisma.artesao.count({ where: { usuarioId: titular.id } }), 1);
  });

  it('Cenário 3: titular vincula curador ativo; vínculo criado, papel CURADOR e permissões só de catálogo/etiquetas', async () => {
    estado.atelieA = await criarAtelie(estado.titular as Usuario, 'Ateliê Renda A');
    estado.curador = await cadastrar('curador');

    const res = await chamar('POST', `/atelies/${estado.atelieA}/curadores`, { email: estado.curador.email }, estado.titular?.cookie);
    assert.equal(res.status, 201, res.texto);
    assert.equal(await prisma.atelieCurador.count({ where: { atelieId: estado.atelieA, usuarioId: estado.curador.id } }), 1);
    assert.deepEqual(await papeis(estado.curador.id), ['COMPRADOR', 'CURADOR']);

    const vinculos = await chamar('GET', '/atelies/meus-vinculos', undefined, estado.curador.cookie);
    assert.equal(vinculos.status, 200);
    const contexto = (vinculos.body.dados as any[]).find((v) => v.atelieId === estado.atelieA);
    assert.equal(contexto.papelNoAtelie, 'CURADOR');
    assert.deepEqual([...contexto.permissoes].sort(), ['GERENCIAR_CATALOGO', 'GERENCIAR_ETIQUETAS']);

    const lista = await chamar('GET', `/atelies/${estado.atelieA}/curadores`, undefined, estado.titular?.cookie);
    assert.equal(lista.status, 200);
    assert.ok((lista.body.dados as any[]).some((c) => c.usuarioId === estado.curador?.id));
  });

  it('Cenário 2: curador tenta alterar a Chave Pix → 403, nada muda e o evento fica gravado no banco sem segredos', async () => {
    const curador = estado.curador as Usuario;
    const antes = await prisma.artesao.findUnique({ where: { usuarioId: estado.titular?.id } });
    const novaChave = `nova.chave.${sufixo}@origem.test`;
    const correlationId = `tc02-${sufixo}`;

    const res = await chamar('PATCH', `/atelies/${estado.atelieA}/chave-pix`, { chavePix: novaChave, tipoChavePix: 'EMAIL' }, curador.cookie, correlationId);
    assert.equal(res.status, 403, res.texto);

    const depois = await prisma.artesao.findUnique({ where: { usuarioId: estado.titular?.id } });
    assert.equal(depois?.chavePixCriptografada, antes?.chavePixCriptografada);
    assert.equal(depois?.atualizadoEm.getTime(), antes?.atualizadoEm.getTime());

    const eventos = await prisma.auditoriaSeguranca.findMany({ where: { correlationId } });
    assert.equal(eventos.length, 1);
    const [evento] = eventos;
    assert.equal(evento?.tipoEvento, 'FINANCIAL_ACCESS_DENIED');
    assert.equal(evento?.decisao, 'DENY');
    assert.equal(evento?.motivo, 'CURATOR_FINANCIAL_BLOCK');
    assert.equal(evento?.operacao, 'ALTERAR_CHAVE_PIX');
    assert.equal(evento?.usuarioId, curador.id);
    assert.equal(evento?.atelieId, estado.atelieA);
    assert.equal(evento?.metodoHttp, 'PATCH');
    assert.equal(evento?.caminho, `/api/v1/atelies/${estado.atelieA}/chave-pix`);
    assert.ok(evento?.ocorridoEm instanceof Date);

    const serializado = JSON.stringify(evento);
    const tokenSessao = curador.cookie.split('=')[1] as string;
    for (const segredo of [novaChave, estado.titular?.email as string, tokenSessao, 'Senha@Forte1']) {
      assert.ok(!serializado.includes(segredo), 'auditoria não pode conter Chave Pix, JWT ou senha');
    }
  });

  it('Auditoria: leitura financeira e gestão de curadores por curador também são negadas (403) e registradas', async () => {
    const curador = estado.curador as Usuario;
    const idFin = `fin-${sufixo}`;
    const idCur = `cur-${sufixo}`;
    assert.equal((await chamar('GET', `/atelies/${estado.atelieA}/financeiro`, undefined, curador.cookie, idFin)).status, 403);
    assert.equal(
      (await chamar('POST', `/atelies/${estado.atelieA}/curadores`, { email: 'x@origem.test' }, curador.cookie, idCur)).status,
      403,
    );
    const fin = await prisma.auditoriaSeguranca.findFirst({ where: { correlationId: idFin } });
    const cur = await prisma.auditoriaSeguranca.findFirst({ where: { correlationId: idCur } });
    assert.equal(fin?.tipoEvento, 'FINANCIAL_ACCESS_DENIED');
    assert.equal(fin?.operacao, 'CONSULTAR_DADOS_FINANCEIROS');
    assert.equal(cur?.tipoEvento, 'CURATOR_MANAGEMENT_DENIED');
    assert.equal(cur?.motivo, 'CURATOR_GOVERNANCE_BLOCK');

    const titularFin = await chamar('GET', `/atelies/${estado.atelieA}/financeiro`, undefined, estado.titular?.cookie);
    assert.equal(titularFin.status, 200);
    assert.ok(!titularFin.texto.includes(estado.titular?.email as string), 'resumo financeiro devolve só a chave mascarada');
  });

  it('Auditoria: a trilha é somente inserção (UPDATE, DELETE e TRUNCATE rejeitados)', async () => {
    const evento = await prisma.auditoriaSeguranca.findFirst({ where: { correlationId: `tc02-${sufixo}` } });
    assert.ok(evento);
    await assert.rejects(prisma.auditoriaSeguranca.update({ where: { id: evento.id }, data: { motivo: 'X' } }), /somente inserção/);
    await assert.rejects(prisma.auditoriaSeguranca.delete({ where: { id: evento.id } }), /somente inserção/);
    await assert.rejects(prisma.$executeRawUnsafe('TRUNCATE "auditoria_seguranca"'), /somente inserção/);
    assert.ok(await prisma.auditoriaSeguranca.findUnique({ where: { id: evento.id } }));
  });

  it('L2: curador em dois ateliês; remover um vínculo preserva o outro e o papel; o último remove CURADOR e mantém os demais', async () => {
    estado.titularB = await cadastrar('titular-b');
    assert.equal((await habilitar(estado.titularB)).status, 201);
    estado.atelieB = await criarAtelie(estado.titularB, 'Ateliê Renda B');
    const curador = estado.curador as Usuario;
    assert.equal(
      (await chamar('POST', `/atelies/${estado.atelieB}/curadores`, { email: curador.email }, estado.titularB.cookie)).status,
      201,
    );
    assert.equal(await prisma.atelieCurador.count({ where: { usuarioId: curador.id } }), 2);
    assert.equal(await prisma.usuarioPapel.count({ where: { usuarioId: curador.id, papel: 'CURADOR' } }), 1);

    assert.equal((await chamar('DELETE', `/atelies/${estado.atelieA}/curadores/${curador.id}`, undefined, estado.titular?.cookie)).status, 204);
    assert.equal(await prisma.atelieCurador.count({ where: { usuarioId: curador.id, atelieId: estado.atelieB } }), 1);
    assert.deepEqual(await papeis(curador.id), ['COMPRADOR', 'CURADOR']);

    // Sem vínculo com o ateliê A, o curador perde o acesso ao catálogo dele, mas mantém o de B.
    const vinculos = await chamar('GET', '/atelies/meus-vinculos', undefined, curador.cookie);
    assert.deepEqual((vinculos.body.dados as any[]).map((v) => v.atelieId), [estado.atelieB]);

    assert.equal((await chamar('DELETE', `/atelies/${estado.atelieB}/curadores/${curador.id}`, undefined, estado.titularB.cookie)).status, 204);
    assert.equal(await prisma.atelieCurador.count({ where: { usuarioId: curador.id } }), 0);
    assert.deepEqual(await papeis(curador.id), ['COMPRADOR']);
    assert.equal((await chamar('DELETE', `/atelies/${estado.atelieB}/curadores/${curador.id}`, undefined, estado.titularB.cookie)).status, 404);
  });

  describe('L3: rollback real das operações compostas (falha forçada no 2º passo)', () => {
    const FUNCAO = 'teste_hu03_falha_papel';

    async function instalarFalha(evento: 'INSERT' | 'DELETE', papel: string) {
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION ${FUNCAO}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF COALESCE(NEW.papel, OLD.papel)::text = '${papel}' THEN
            RAISE EXCEPTION 'falha forçada de teste';
          END IF;
          RETURN COALESCE(NEW, OLD);
        END $$;`);
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${FUNCAO}_trg BEFORE ${evento} ON "usuarios_papeis" FOR EACH ROW EXECUTE FUNCTION ${FUNCAO}()`,
      );
    }

    async function removerFalha() {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${FUNCAO}_trg ON "usuarios_papeis"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${FUNCAO}()`);
    }

    it('habilitação: falha ao associar ARTESAO desfaz o registro de artesão', async () => {
      const usuario = await cadastrar('rollback-hab');
      await instalarFalha('INSERT', 'ARTESAO');
      try {
        assert.equal((await habilitar(usuario)).status, 500);
      } finally {
        await removerFalha();
      }
      assert.equal(await prisma.artesao.count({ where: { usuarioId: usuario.id } }), 0);
      assert.deepEqual(await papeis(usuario.id), ['COMPRADOR']);
      assert.equal((await habilitar(usuario)).status, 201, 'após a falha, a operação pode ser refeita');
    });

    it('vinculação: falha ao associar CURADOR desfaz o vínculo', async () => {
      const candidato = await cadastrar('rollback-vinc');
      await instalarFalha('INSERT', 'CURADOR');
      try {
        const res = await chamar('POST', `/atelies/${estado.atelieA}/curadores`, { email: candidato.email }, estado.titular?.cookie);
        assert.equal(res.status, 500);
      } finally {
        await removerFalha();
      }
      assert.equal(await prisma.atelieCurador.count({ where: { usuarioId: candidato.id } }), 0);
      assert.deepEqual(await papeis(candidato.id), ['COMPRADOR']);
    });

    it('desvinculação: falha ao remover CURADOR mantém o vínculo intacto', async () => {
      const candidato = await cadastrar('rollback-desv');
      assert.equal(
        (await chamar('POST', `/atelies/${estado.atelieA}/curadores`, { email: candidato.email }, estado.titular?.cookie)).status,
        201,
      );
      await instalarFalha('DELETE', 'CURADOR');
      try {
        const res = await chamar('DELETE', `/atelies/${estado.atelieA}/curadores/${candidato.id}`, undefined, estado.titular?.cookie);
        assert.equal(res.status, 500);
      } finally {
        await removerFalha();
      }
      assert.equal(await prisma.atelieCurador.count({ where: { usuarioId: candidato.id } }), 1);
      assert.deepEqual(await papeis(candidato.id), ['COMPRADOR', 'CURADOR']);
    });
  });
});
