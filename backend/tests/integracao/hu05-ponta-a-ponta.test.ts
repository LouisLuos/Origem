/**
 * Integração REAL da  (com ,  e ): PostgreSQL + Prisma + JWT + RBAC + sharp
 * + armazenamento em disco, pela API HTTP do app de produção. Sem mocks.
 *
 * Executa apenas com RUN_DB_INTEGRATION=1 e um DATABASE_URL LOCAL (banco isolado, com as
 * migrations aplicadas). Recusa-se a rodar contra qualquer outro host.
 * Uso: npm run test:integration (ver package.json)
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';

const habilitado = process.env.RUN_DB_INTEGRATION === '1';
const urlBanco = process.env.DATABASE_URL ?? '';
const bancoLocal = /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(urlBanco);

if (habilitado && !bancoLocal) {
  throw new Error('Integração recusada: DATABASE_URL precisa apontar para um banco LOCAL isolado.');
}

const PORTA = 3197;
const BASE = `http://127.0.0.1:${PORTA}`;

/** Gera um CPF válido a partir de 9 dígitos (dígitos verificadores calculados). */
function gerarCpf(semente: number): string {
  const base = String(100000000 + (semente % 800000000)).slice(0, 9).split('').map(Number);
  const digito = (numeros: number[]) => {
    const soma = numeros.reduce((acc, n, i) => acc + n * (numeros.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(base);
  const d2 = digito([...base, d1]);
  return [...base, d1, d2].join('');
}

describe('Fluxo ponta a ponta com infraestrutura real (banco isolado)', { skip: !habilitado }, () => {
  let server: Server;
  let dirFotos: string;
  let prisma: typeof import('../../src/config/database.js')['prisma'];
  const sufixo = Date.now();

  async function chamar(metodo: string, rota: string, corpo?: unknown, cookie?: string) {
    const res = await fetch(`${BASE}/api/v1${rota}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
    const texto = await res.text();
    return {
      status: res.status,
      body: (texto ? JSON.parse(texto) : null) as Record<string, any>,
      cookie: res.headers.get('set-cookie')?.split(';')[0],
    };
  }

  async function cadastrarUsuario(apelido: string, semente: number) {
    const res = await chamar('POST', '/auth/register', {
      name: `Usuario ${apelido} Teste`,
      email: `${apelido}.${sufixo}@origem.test`,
      cpfCnpj: gerarCpf(semente),
      whatsapp: '81999990000',
      password: 'Senha@Forte1',
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.cookie);
    return { cookie: res.cookie as string, email: `${apelido}.${sufixo}@origem.test`, id: res.body.user.id as string };
  }

  async function fotoReal(formato: 'jpeg' | 'png', largura: number, altura: number) {
    const imagem = sharp({
      create: { width: largura, height: altura, channels: 3, background: { r: 170, g: 90, b: 60 } },
    });
    const buffer =
      formato === 'jpeg'
        ? await imagem.jpeg({ quality: 90 }).withMetadata({ exif: { IFD0: { Copyright: 'metadado-sensivel' } } }).toBuffer()
        : await imagem.png().toBuffer();
    return { tipoMime: `image/${formato}`, conteudoBase64: buffer.toString('base64') };
  }

  function corpoPeca(fotos: unknown[], extra: Record<string, unknown> = {}) {
    return {
      titulo: 'Boneco de Barro Casal de Feira',
      descricao: 'Modelado à mão no Alto do Moura e queimado em forno a lenha.',
      tipologia: 'Cerâmica Figurativa',
      preco: 189.9,
      pesoGramas: 850,
      comprimentoCm: 30,
      larguraCm: 20,
      alturaCm: 25,
      isFragil: true,
      fotos,
      indiceFotoPrincipal: 1,
      ...extra,
    };
  }

  const atelieValido = {
    nomeComercial: 'Ateliê Casal de Feira',
    poloCultural: 'Alto do Moura',
    endereco: { cep: '55000-000', logradouro: 'Rua do Barro', numero: '10', bairro: 'Alto do Moura', cidade: 'Caruaru', uf: 'pe' },
  };

  const estado: { titular?: Awaited<ReturnType<typeof cadastrarUsuario>>; atelieId?: string; pecaId?: string; fotos?: { url: string; isPrincipal: boolean }[] } = {};

  before(async () => {
    dirFotos = await mkdtemp(path.join(os.tmpdir(), 'origem-hu05-fotos-'));
    process.env.FOTOS_STORAGE_DRIVER = 'local';
    process.env.FOTOS_STORAGE_LOCAL_DIR = dirFotos;
    process.env.FOTOS_PUBLIC_BASE_URL = BASE;
    process.env.PIX_ENCRYPTION_KEY ||= 'a'.repeat(31) + 'b'.repeat(33);
    const { app } = await import('../../src/app.js');
    ({ prisma } = await import('../../src/config/database.js'));
    server = await new Promise((resolve) => {
      const s = app.listen(PORTA, '127.0.0.1', () => resolve(s));
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await prisma?.$disconnect();
    await rm(dirFotos, { recursive: true, force: true });
  });

  it('cadastra usuário real e o habilita como artesão (papel ARTESAO no banco)', async () => {
    estado.titular = await cadastrarUsuario('titular', sufixo);
    const res = await chamar(
      'POST',
      '/artesaos/habilitacao',
      { biografiaCultural: 'Ceramista do Alto do Moura há vinte anos, aprendeu com o pai.', chavePix: estado.titular.email, tipoChavePix: 'EMAIL' },
      estado.titular.cookie,
    );
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const papeis = await prisma.usuarioPapel.findMany({ where: { usuarioId: estado.titular.id } });
    assert.deepEqual(papeis.map((p) => p.papel).sort(), ['ARTESAO', 'COMPRADOR']);
    const artesao = await prisma.artesao.findUnique({ where: { usuarioId: estado.titular.id } });
    assert.ok(artesao && !artesao.chavePixCriptografada.includes(estado.titular.email), 'Chave Pix deve estar cifrada');
  });

  it('cadastra ateliê e endereço atomicamente; segundo cadastro retorna 422', async () => {
    const res = await chamar('POST', '/atelies', atelieValido, estado.titular?.cookie);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.endereco.cep, '55000000');
    assert.equal(res.body.endereco.uf, 'PE');
    estado.atelieId = res.body.id;
    assert.equal(await prisma.endereco.count({ where: { atelieId: estado.atelieId } }), 1);

    const repetido = await chamar('POST', '/atelies', atelieValido, estado.titular?.cookie);
    assert.equal(repetido.status, 422);
  });

  it('usuário não habilitado como artesão não cria ateliê (403)', async () => {
    const comprador = await cadastrarUsuario('sem-artesao', sufixo + 7);
    assert.equal((await chamar('POST', '/atelies', atelieValido, comprador.cookie)).status, 403);
  });

  it('RBAC lista o vínculo de titular com permissão GERENCIAR_CATALOGO', async () => {
    const res = await chamar('GET', '/atelies/meus-vinculos', undefined, estado.titular?.cookie);
    assert.equal(res.status, 200);
    const vinculo = (res.body.dados as any[]).find((v) => v.atelieId === estado.atelieId);
    assert.equal(vinculo.papelNoAtelie, 'TITULAR');
    assert.ok(vinculo.permissoes.includes('GERENCIAR_CATALOGO'));
  });

  it('retorna 422 para peso de 30g sem gravar dados', async () => {
    const fotos = [await fotoReal('jpeg', 800, 600), await fotoReal('png', 600, 800)];
    const res = await chamar('POST', `/atelies/${estado.atelieId}/pecas`, corpoPeca(fotos, { pesoGramas: 30 }), estado.titular?.cookie);
    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'O peso mínimo embalado para cotação de frete é 50g');
    assert.equal(await prisma.peca.count({ where: { atelieId: estado.atelieId } }), 0);
    assert.deepEqual(await readdir(dirFotos), []);
  });

  it('rejeita imagem corrompida sem arquivos nem registros parciais', async () => {
    const corrompida = { tipoMime: 'image/jpeg', conteudoBase64: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]).toString('base64') };
    const res = await chamar('POST', `/atelies/${estado.atelieId}/pecas`, corpoPeca([await fotoReal('png', 300, 300), corrompida]), estado.titular?.cookie);
    assert.equal(res.status, 422);
    assert.equal(res.body.codigo, 'FOTO_INVALIDA');
    assert.equal(await prisma.peca.count({ where: { atelieId: estado.atelieId } }), 0);
    assert.deepEqual(await readdir(dirFotos), []);
  });

  it('publica peça real (201, DISPONIVEL, is_fragil, capa) com fotos otimizadas', async () => {
    const fotos = [await fotoReal('jpeg', 3000, 2000), await fotoReal('png', 1200, 1800)];
    const res = await chamar('POST', `/atelies/${estado.atelieId}/pecas`, corpoPeca(fotos), estado.titular?.cookie);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.status, 'DISPONIVEL');
    assert.equal(res.body.isFragil, true);
    estado.pecaId = res.body.id;
    estado.fotos = res.body.fotos;

    const peca = await prisma.peca.findUnique({ where: { id: estado.pecaId }, include: { fotos: { orderBy: { ordem: 'asc' } } } });
    assert.ok(peca);
    assert.equal(peca.status, 'DISPONIVEL');
    assert.equal(peca.isFragil, true);
    assert.equal(peca.preco.toNumber(), 189.9);
    assert.deepEqual(peca.fotos.map((f) => f.isPrincipal), [false, true]);

    for (const foto of peca.fotos) {
      const arquivo = path.join(dirFotos, foto.caminhoArmazenamento);
      assert.ok(existsSync(arquivo), `arquivo ${foto.caminhoArmazenamento} deve existir`);
      const meta = await sharp(arquivo).metadata();
      assert.equal(meta.format, 'webp');
      assert.ok(Math.max(meta.width ?? 0, meta.height ?? 0) <= 1600, 'maior lado ≤ 1600 px');
      assert.equal(meta.exif, undefined, 'metadados EXIF removidos');
    }
    const [primeira] = peca.fotos;
    const metaPrimeira = await sharp(path.join(dirFotos, primeira!.caminhoArmazenamento)).metadata();
    assert.equal(metaPrimeira.width, 1600);
    assert.equal(metaPrimeira.height, 1067, 'proporção 3:2 preservada');
  });

  it('Vitrine: GET /produtos e /produtos/:id exibem a peça publicada com capa e galeria; catálogo legado preservado', async () => {
    const lista = await chamar('GET', '/produtos?limit=100');
    assert.equal(lista.status, 200);
    const item = (lista.body.dados as any[]).find((p) => p.id === estado.pecaId);
    assert.ok(item, 'peça publicada deve aparecer na vitrine');
    const capa = estado.fotos?.find((f) => f.isPrincipal)?.url;
    assert.equal(item.imageUrl, capa);
    assert.equal(item.gallery[0], capa);
    assert.equal(item.hub, 'Alto do Moura');
    assert.equal(item.technique, 'Cerâmica Figurativa');
    assert.ok((lista.body.dados as any[]).some((p) => p.id === 'p01'), 'catálogo legado (IA) preservado');

    const detalhe = await chamar('GET', `/produtos/${estado.pecaId}`);
    assert.equal(detalhe.status, 200);
    assert.equal(detalhe.body.description, 'Modelado à mão no Alto do Moura e queimado em forno a lenha.');
    assert.equal((await chamar('GET', '/produtos/p01')).status, 200);
    assert.equal((await chamar('GET', '/produtos/00000000-0000-0000-0000-000000000000')).status, 404);

    const imagem = await fetch(capa as string);
    assert.equal(imagem.status, 200);
    assert.equal(imagem.headers.get('content-type'), 'image/webp');
  });

  it('RBAC real: usuário sem vínculo recebe 403 ao catalogar no ateliê alheio', async () => {
    const intruso = await cadastrarUsuario('intruso', sufixo + 13);
    const fotos = [await fotoReal('jpeg', 400, 300), await fotoReal('png', 300, 400)];
    const res = await chamar('POST', `/atelies/${estado.atelieId}/pecas`, corpoPeca(fotos), intruso.cookie);
    assert.equal(res.status, 403);
    assert.equal((await chamar('POST', `/atelies/${estado.atelieId}/pecas`, corpoPeca(fotos))).status, 401);
  });

  it('curador vinculado cataloga peças, mas não acessa dados financeiros (403)', async () => {
    const curador = await cadastrarUsuario('curador', sufixo + 29);
    const vinculo = await chamar('POST', `/atelies/${estado.atelieId}/curadores`, { email: curador.email }, estado.titular?.cookie);
    assert.equal(vinculo.status, 201, JSON.stringify(vinculo.body));

    const fotos = [await fotoReal('jpeg', 500, 500), await fotoReal('jpeg', 500, 500)];
    const peca = await chamar('POST', `/atelies/${estado.atelieId}/pecas`, corpoPeca(fotos, { titulo: 'Peça do curador', indiceFotoPrincipal: 0 }), curador.cookie);
    assert.equal(peca.status, 201, JSON.stringify(peca.body));

    assert.equal((await chamar('GET', `/atelies/${estado.atelieId}/financeiro`, undefined, curador.cookie)).status, 403);
    assert.equal((await chamar('GET', `/atelies/${estado.atelieId}/financeiro`, undefined, estado.titular?.cookie)).status, 200);
  });

  it('Recuperação: falha na persistência remove as fotos já gravadas no disco', async () => {
    const { createPecaService } = await import('../../src/services/peca.service.js');
    const { sharpProcessadorImagemPeca } = await import('../../src/utils/sharpImagemPeca.processor.js');
    const { createLocalDiskArmazenamentoFotosPeca } = await import('../../src/repositories/localDiskFotosPeca.storage.js');
    const { validarCriacaoPeca } = await import('../../src/validators/peca.validator.js');
    const dirIsolado = await mkdtemp(path.join(os.tmpdir(), 'origem-hu05-falha-'));
    try {
      const service = createPecaService({
        processadorImagem: sharpProcessadorImagemPeca,
        armazenamento: createLocalDiskArmazenamentoFotosPeca({ diretorio: dirIsolado, urlPublicaBase: BASE }),
        repository: { async criarComFotos() { throw new Error('banco indisponível'); } },
      });
      const dados = validarCriacaoPeca(corpoPeca([await fotoReal('jpeg', 300, 300), await fotoReal('png', 300, 300)]));
      await assert.rejects(service.criar(estado.atelieId as string, dados), /banco indisponível/);
      const restantes = await readdir(path.join(dirIsolado, 'atelies', estado.atelieId as string)).catch(() => []);
      assert.deepEqual(restantes, [], 'nenhuma foto órfã deve permanecer');
    } finally {
      await rm(dirIsolado, { recursive: true, force: true });
    }
  });

  it('Banco: CHECKs rejeitam cubagem inválida mesmo fora da API (Invariante 2)', async () => {
    await assert.rejects(
      prisma.peca.create({
        data: { atelieId: estado.atelieId as string, titulo: 't', descricao: 'd', tipologia: 'Cordel', preco: 10, pesoGramas: 30, comprimentoCm: 1, larguraCm: 1, alturaCm: 1 },
      }),
      /pecas_peso_minimo_check/,
    );
  });
});
