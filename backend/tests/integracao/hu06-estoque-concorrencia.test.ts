/**
 * Integração REAL e testes de concorrência da HU-06 contra PostgreSQL/Supabase real:
 * Prisma + Express app real + JWT + RBAC + transações ACID (`FOR UPDATE` + `UPDATE` condicional).
 *
 * Executa somente com `RUN_HU06_DB_INTEGRATION=1`, criando registros efêmeros rastreados
 * e removendo apenas esses registros no `after()` sem afetar dados existentes no Supabase.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import sharp from 'sharp';
import { RESERVA_ERROR_CODES } from '../../src/repositories/contracts/reservas.contracts.js';

const habilitado = process.env.RUN_HU06_DB_INTEGRATION === '1';

const PORTA = 3199;
const BASE = `http://127.0.0.1:${PORTA}`;

function gerarCpf(semente: number): string {
  const base = String(200000000 + (semente % 700000000))
    .slice(0, 9)
    .split('')
    .map(Number);
  const digito = (numeros: number[]) => {
    const soma = numeros.reduce((acc, n, i) => acc + n * (numeros.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(base);
  const d2 = digito([...base, d1]);
  return [...base, d1, d2].join('');
}

describe(
  'HU-06 — Integração Real e Concorrência no PostgreSQL (Supabase)',
  { skip: !habilitado },
  () => {
    let server: Server;
    let dirFotos: string;
    let prisma: typeof import('../../src/config/database.js')['prisma'];
    let reservaRepo: typeof import('../../src/repositories/prismaReserva.repository.js')['prismaReservaEstoqueRepository'];
    let baselineCounts: {
      usuarios: number;
      artesaos: number;
      atelies: number;
      pecas: number;
      reservasGrupos: number;
      reservas: number;
    };

    const sufixo = `${Date.now()}-${crypto.randomInt(1000, 9999)}`;
    let cpfCounter = Math.floor(Date.now() % 1000000) * 100;

    const trackedUsuarios: string[] = [];
    const trackedAtelies: string[] = [];
    const trackedArtesaos: string[] = [];
    const trackedPecas: string[] = [];
    const trackedGrupos: string[] = [];

    let cachedFotos: Array<{ tipoMime: string; conteudoBase64: string }>;

    async function chamar(
      metodo: string,
      rota: string,
      corpo?: unknown,
      cookie?: string,
      headersExtras: Record<string, string> = {},
    ) {
      const res = await fetch(`${BASE}/api/v1${rota}`, {
        method: metodo,
        headers: {
          ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headersExtras,
        },
        ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
      });
      const texto = await res.text();
      return {
        status: res.status,
        body: (texto ? JSON.parse(texto) : null) as Record<string, any>,
        cookie: res.headers.get('set-cookie')?.split(';')[0],
      };
    }

    async function cadastrarComprador(apelido: string) {
      cpfCounter += 1;
      const email = `hu06.${apelido}.${sufixo}@origem.test`;
      const res = await chamar('POST', '/auth/register', {
        name: `HU06 ${apelido}`,
        email,
        cpfCnpj: gerarCpf(cpfCounter),
        whatsapp: '81999990000',
        password: 'Senha@Forte1',
      });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.ok(res.cookie);
      const id = res.body.user.id as string;
      trackedUsuarios.push(id);
      return { id, email, cookie: res.cookie as string };
    }

    async function cadastrarTitularComAtelie(apelido: string) {
      const titular = await cadastrarComprador(apelido);
      const hab = await chamar(
        'POST',
        '/artesaos/habilitacao',
        {
          biografiaCultural: 'Ceramista pernambucana especializada em lotes autorais numerados.',
          chavePix: titular.email,
          tipoChavePix: 'EMAIL',
        },
        titular.cookie,
      );
      assert.equal(hab.status, 201, JSON.stringify(hab.body));
      trackedArtesaos.push(hab.body.artesaoId as string);

      const atelie = await chamar(
        'POST',
        '/atelies',
        {
          nomeComercial: `Ateliê HU06 ${apelido}`,
          poloCultural: 'Alto do Moura',
          endereco: {
            cep: '55000000',
            logradouro: 'Rua da Olaria',
            numero: '42',
            bairro: 'Alto do Moura',
            cidade: 'Caruaru',
            uf: 'PE',
          },
        },
        titular.cookie,
      );
      assert.equal(atelie.status, 201, JSON.stringify(atelie.body));
      trackedAtelies.push(atelie.body.id as string);

      return { ...titular, atelieId: atelie.body.id as string };
    }

    async function criarPecaNoBanco(
      cookie: string,
      atelieId: string,
      titulo: string,
      quantidadeEstoque?: number,
    ) {
      const res = await chamar(
        'POST',
        `/atelies/${atelieId}/pecas`,
        {
          titulo,
          descricao: 'Peça artesanal para validação real de controle de lote e concorrência.',
          tipologia: 'Cerâmica Figurativa',
          preco: 149.9,
          pesoGramas: 700,
          comprimentoCm: 25,
          larguraCm: 18,
          alturaCm: 22,
          isFragil: true,
          ...(quantidadeEstoque !== undefined ? { quantidadeEstoque } : {}),
          fotos: cachedFotos,
        },
        cookie,
      );
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const id = res.body.id as string;
      trackedPecas.push(id);
      return res.body as { id: string; quantidadeEstoque: number; status: string };
    }

    async function executarReservaComRastreio(
      cookie: string,
      itens: Array<{ pecaId: string; quantidade: number }>,
      idempotencyKey?: string,
    ) {
      const res = await chamar(
        'POST',
        '/estoque/reservas',
        { itens },
        cookie,
        idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      );
      if ((res.status === 201 || res.status === 200) && res.body?.grupoId) {
        if (!trackedGrupos.includes(res.body.grupoId)) {
          trackedGrupos.push(res.body.grupoId as string);
        }
      }
      return res;
    }

    let titular!: Awaited<ReturnType<typeof cadastrarTitularComAtelie>>;
    let comprador1!: Awaited<ReturnType<typeof cadastrarComprador>>;
    let comprador2!: Awaited<ReturnType<typeof cadastrarComprador>>;
    let compradoresPool: Array<Awaited<ReturnType<typeof cadastrarComprador>>> = [];

    before(async () => {
      dirFotos = await mkdtemp(path.join(os.tmpdir(), 'origem-hu06-fotos-'));
      process.env.FOTOS_STORAGE_DRIVER = 'local';
      process.env.FOTOS_STORAGE_LOCAL_DIR = dirFotos;
      process.env.FOTOS_PUBLIC_BASE_URL = BASE;
      process.env.PIX_ENCRYPTION_KEY ||= 'a'.repeat(31) + 'b'.repeat(33);

      const img = sharp({
        create: { width: 400, height: 300, channels: 3, background: { r: 179, g: 78, b: 36 } },
      });
      const jpegB64 = (await img.clone().jpeg().toBuffer()).toString('base64');
      const pngB64 = (await img.clone().png().toBuffer()).toString('base64');
      cachedFotos = [
        { tipoMime: 'image/jpeg', conteudoBase64: jpegB64 },
        { tipoMime: 'image/png', conteudoBase64: pngB64 },
      ];

      ({ prisma } = await import('../../src/config/database.js'));
      ({ prismaReservaEstoqueRepository: reservaRepo } = await import(
        '../../src/repositories/prismaReserva.repository.js'
      ));
      const { app } = await import('../../src/app.js');

      const [usuarios, artesaos, atelies, pecas, reservasGrupos, reservas] = await Promise.all([
        prisma.usuario.count(),
        prisma.artesao.count(),
        prisma.atelie.count(),
        prisma.peca.count(),
        prisma.reservaGrupo.count(),
        prisma.reserva.count(),
      ]);
      baselineCounts = { usuarios, artesaos, atelies, pecas, reservasGrupos, reservas };

      server = await new Promise((resolve) => {
        const s = app.listen(PORTA, '127.0.0.1', () => resolve(s));
      });

      titular = await cadastrarTitularComAtelie('titular');
      comprador1 = await cadastrarComprador('comp1');
      comprador2 = await cadastrarComprador('comp2');
    });

    after(async () => {
      try {
        if (prisma) {
          if (trackedGrupos.length > 0 || trackedPecas.length > 0 || trackedUsuarios.length > 0) {
            await prisma.reserva.deleteMany({
              where: {
                OR: [
                  ...(trackedGrupos.length ? [{ grupoId: { in: trackedGrupos } }] : []),
                  ...(trackedPecas.length ? [{ pecaId: { in: trackedPecas } }] : []),
                  ...(trackedUsuarios.length ? [{ usuarioId: { in: trackedUsuarios } }] : []),
                ],
              },
            });
            await prisma.reservaGrupo.deleteMany({
              where: {
                OR: [
                  ...(trackedGrupos.length ? [{ id: { in: trackedGrupos } }] : []),
                  ...(trackedUsuarios.length ? [{ usuarioId: { in: trackedUsuarios } }] : []),
                ],
              },
            });
          }

          if (trackedPecas.length > 0) {
            await prisma.peca.deleteMany({ where: { id: { in: trackedPecas } } });
          }

          if (trackedAtelies.length > 0) {
            await prisma.atelie.deleteMany({ where: { id: { in: trackedAtelies } } });
          }

          if (trackedArtesaos.length > 0) {
            await prisma.artesao.deleteMany({ where: { id: { in: trackedArtesaos } } });
          }

          if (trackedUsuarios.length > 0) {
            await prisma.usuario.deleteMany({ where: { id: { in: trackedUsuarios } } });
          }

          const [usuarios, artesaos, atelies, pecas, reservasGrupos, reservas] = await Promise.all([
            prisma.usuario.count(),
            prisma.artesao.count(),
            prisma.atelie.count(),
            prisma.peca.count(),
            prisma.reservaGrupo.count(),
            prisma.reserva.count(),
          ]);
          assert.deepEqual(
            { usuarios, artesaos, atelies, pecas, reservasGrupos, reservas },
            baselineCounts,
            'Limpeza após os testes deve preservar exatamente os dados preexistentes no Supabase.',
          );
        }
      } finally {
        await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
        await prisma?.$disconnect();
        await rm(dirFotos, { recursive: true, force: true });
      }
    });

    it('Cenário BDD 1: cadastra lote com estoque 10, persiste no PostgreSQL e exibe na vitrine', async () => {
      const peca = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Lote Dez ${sufixo}`, 10);
      assert.equal(peca.quantidadeEstoque, 10);
      assert.equal(peca.status, 'DISPONIVEL');

      const pecaDb = await prisma.peca.findUnique({ where: { id: peca.id } });
      assert.ok(pecaDb);
      assert.equal(pecaDb.quantidadeEstoque, 10);

      const detalhe = await chamar('GET', `/produtos/${peca.id}`);
      assert.equal(detalhe.status, 200);
      assert.equal(detalhe.body.stock, 10);

      const lista = await chamar('GET', '/produtos?limit=100');
      assert.equal(lista.status, 200);
      const encontrada = (lista.body.dados as Array<Record<string, unknown>>).find(
        (p) => p.id === peca.id,
      );
      assert.ok(encontrada);
      assert.equal(encontrada.stock, 10);
    });

    it('Gestão de estoque do ateliê e RBAC: ajusta lote e mantém peça visível como Esgotado (stock=0)', async () => {
      const peca = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Gestão Painel ${sufixo}`);
      assert.equal(peca.quantidadeEstoque, 1);

      // Comprador alheio não pode consultar nem alterar estoque do ateliê -> 403
      assert.equal(
        (await chamar('GET', `/atelies/${titular.atelieId}/pecas`, undefined, comprador1.cookie)).status,
        403,
      );
      assert.equal(
        (
          await chamar(
            'PATCH',
            `/atelies/${titular.atelieId}/pecas/${peca.id}/estoque`,
            { delta: 5 },
            comprador1.cookie,
          )
        ).status,
        403,
      );

      // Titular zera estoque -> continua visível na vitrine com stock = 0
      const zeroRes = await chamar(
        'PATCH',
        `/atelies/${titular.atelieId}/pecas/${peca.id}/estoque`,
        { quantidadeEstoque: 0 },
        titular.cookie,
      );
      assert.equal(zeroRes.status, 200);
      assert.equal(zeroRes.body.quantidadeEstoque, 0);

      const detalheZero = await chamar('GET', `/produtos/${peca.id}`);
      assert.equal(detalheZero.status, 200);
      assert.equal(detalheZero.body.stock, 0);

      // Tentativa de decrementar abaixo de 0 -> 409
      const negRes = await chamar(
        'PATCH',
        `/atelies/${titular.atelieId}/pecas/${peca.id}/estoque`,
        { delta: -1 },
        titular.cookie,
      );
      assert.equal(negRes.status, 409);

      // Titular restaura saldo -> 4
      const plusRes = await chamar(
        'PATCH',
        `/atelies/${titular.atelieId}/pecas/${peca.id}/estoque`,
        { delta: 4 },
        titular.cookie,
      );
      assert.equal(plusRes.status, 200);
      assert.equal(plusRes.body.quantidadeEstoque, 4);
    });

    it('Cenário BDD 2: lote com estoque 5 decrementa atomicamente para 3 ao reservar 2 unidades', async () => {
      const peca = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Lote Cinco ${sufixo}`, 5);
      const res = await executarReservaComRastreio(comprador1.cookie, [
        { pecaId: peca.id, quantidade: 2 },
      ]);
      assert.equal(res.status, 201, JSON.stringify(res.body));
      assert.equal(res.body.itens.length, 1);
      assert.equal(res.body.itens[0].quantidade, 2);
      assert.equal(res.body.itens[0].status, 'ATIVA');

      const pecaDb = await prisma.peca.findUnique({ where: { id: peca.id } });
      assert.equal(pecaDb?.quantidadeEstoque, 3);
      assert.equal(pecaDb?.status, 'DISPONIVEL');

      const detalhe = await chamar('GET', `/produtos/${peca.id}`);
      assert.equal(detalhe.status, 200);
      assert.equal(detalhe.body.stock, 3);
    });

    it('Cenário BDD 3: concorrência real com 2 compradores para 1 unidade garante exatamente 1 sucesso, 1 HTTP 409 e saldo 0', async () => {
      const peca = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Unidade Concorrente ${sufixo}`, 1);

      const [r1, r2] = await Promise.all([
        executarReservaComRastreio(comprador1.cookie, [{ pecaId: peca.id, quantidade: 1 }]),
        executarReservaComRastreio(comprador2.cookie, [{ pecaId: peca.id, quantidade: 1 }]),
      ]);

      const statuses = [r1.status, r2.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [201, 409], `Esperado [201, 409], obtido ${JSON.stringify(statuses)}`);

      const pecaDb = await prisma.peca.findUnique({ where: { id: peca.id } });
      assert.equal(pecaDb?.quantidadeEstoque, 0);
      assert.equal(pecaDb?.status, 'RESERVADA');

      // Vitrine continua exibindo a peça como esgotada (stock = 0)
      const detalhe = await chamar('GET', `/produtos/${peca.id}`);
      assert.equal(detalhe.status, 200);
      assert.equal(detalhe.body.stock, 0);
    });

    it('TC-STRESS-01: concorrência em escala (50 compradores para 1 unidade e 10 compradores para lote de 3) sem overselling', async () => {
      // Pré-cadastra pool reutilizável de 25 compradores distintos (50 requisições usando 25 cookies x 2 ou 50 compradores reais)
      compradoresPool = [comprador1, comprador2];
      while (compradoresPool.length < 50) {
        const lote = await Promise.all(
          Array.from({ length: 12 }, (_, idx) =>
            cadastrarComprador(`stress-${compradoresPool.length + idx}`),
          ),
        );
        compradoresPool.push(...lote);
      }
      const cinquentaCompradores = compradoresPool.slice(0, 50);

      // A) 50 compradores simultâneos disputando 1 única peça
      const pecaUnica = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Stress 50x1 ${sufixo}`, 1);
      const respostas50 = await Promise.all(
        cinquentaCompradores.map((comp) =>
          executarReservaComRastreio(comp.cookie, [{ pecaId: pecaUnica.id, quantidade: 1 }]),
        ),
      );
      const sucessos50 = respostas50.filter((r) => r.status === 201);
      const conflitos50 = respostas50.filter((r) => r.status === 409);
      assert.equal(sucessos50.length, 1, 'Exatamente 1 comprador deve obter a reserva');
      assert.equal(conflitos50.length, 49, 'Exatamente 49 compradores devem receber HTTP 409');

      const pecaUnicaDb = await prisma.peca.findUnique({ where: { id: pecaUnica.id } });
      assert.equal(pecaUnicaDb?.quantidadeEstoque, 0);
      assert.equal(pecaUnicaDb?.status, 'RESERVADA');

      // B) 10 compradores simultâneos disputando lote limitado com 3 unidades
      const pecaLote = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Stress 10x3 ${sufixo}`, 3);
      const respostas10 = await Promise.all(
        cinquentaCompradores.slice(0, 10).map((comp) =>
          executarReservaComRastreio(comp.cookie, [{ pecaId: pecaLote.id, quantidade: 1 }]),
        ),
      );
      assert.equal(respostas10.filter((r) => r.status === 201).length, 3);
      assert.equal(respostas10.filter((r) => r.status === 409).length, 7);

      const pecaLoteDb = await prisma.peca.findUnique({ where: { id: pecaLote.id } });
      assert.equal(pecaLoteDb?.quantidadeEstoque, 0);
      assert.equal(
        await prisma.reserva.count({ where: { pecaId: pecaLote.id, status: 'ATIVA' } }),
        3,
      );
    });

    it('Atomicidade multi-item, rollback integral em falha parcial, ordenação anti-deadlock e idempotência', async () => {
      const pecaA = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Multi A ${sufixo}`, 4);
      const pecaB = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Multi B ${sufixo}`, 1);

      // 1) Item B pede 2 (só tem 1): item A (que tinha 4) NÃO pode perder estoque (rollback integral)
      const falhaParcial = await executarReservaComRastreio(comprador1.cookie, [
        { pecaId: pecaA.id, quantidade: 2 },
        { pecaId: pecaB.id, quantidade: 2 },
      ]);
      assert.equal(falhaParcial.status, 409);
      assert.equal((await prisma.peca.findUnique({ where: { id: pecaA.id } }))?.quantidadeEstoque, 4);
      assert.equal((await prisma.peca.findUnique({ where: { id: pecaB.id } }))?.quantidadeEstoque, 1);
      assert.equal(
        await prisma.reserva.count({ where: { pecaId: { in: [pecaA.id, pecaB.id] } } }),
        0,
      );

      // 2) Idempotência concorrente (mesma Idempotency-Key e consolidação de itens repetidos)
      const key = `idem-multi-${sufixo}`;
      const [c1, c1Replay] = await Promise.all([
        executarReservaComRastreio(
          comprador1.cookie,
          [
            { pecaId: pecaB.id, quantidade: 1 },
            { pecaId: pecaA.id, quantidade: 1 },
            { pecaId: pecaA.id, quantidade: 1 },
          ],
          key,
        ),
        executarReservaComRastreio(
          comprador1.cookie,
          [
            { pecaId: pecaA.id, quantidade: 2 },
            { pecaId: pecaB.id, quantidade: 1 },
          ],
          key,
        ),
      ]);

      const statusesC1 = [c1.status, c1Replay.status].sort((a, b) => a - b);
      assert.deepEqual(statusesC1, [200, 201]);
      assert.equal(c1.body.grupoId, c1Replay.body.grupoId);
      assert.equal((await prisma.peca.findUnique({ where: { id: pecaA.id } }))?.quantidadeEstoque, 2);
      assert.equal((await prisma.peca.findUnique({ where: { id: pecaB.id } }))?.quantidadeEstoque, 0);

      // Mesmo payload divergente com a mesma chave deve retornar 409 CHAVE_IDEMPOTENCIA_CONFLITO
      const keyConflict = await executarReservaComRastreio(
        comprador1.cookie,
        [{ pecaId: pecaA.id, quantidade: 1 }],
        key,
      );
      assert.equal(keyConflict.status, 409);
      assert.equal(keyConflict.body.codigo, RESERVA_ERROR_CODES.CHAVE_IDEMPOTENCIA_CONFLITO);

      // 3) Concorrência cruzada multi-item ([X, Y] vs [Y, X]) — ordenação determinística sem deadlock
      const pecaX = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Cross X ${sufixo}`, 2);
      const pecaY = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Cross Y ${sufixo}`, 1);

      const [cross1, cross2] = await Promise.all([
        executarReservaComRastreio(comprador1.cookie, [
          { pecaId: pecaX.id, quantidade: 1 },
          { pecaId: pecaY.id, quantidade: 1 },
        ]),
        executarReservaComRastreio(comprador2.cookie, [
          { pecaId: pecaY.id, quantidade: 1 },
          { pecaId: pecaX.id, quantidade: 1 },
        ]),
      ]);

      assert.deepEqual([cross1.status, cross2.status].sort((a, b) => a - b), [201, 409]);
      assert.equal((await prisma.peca.findUnique({ where: { id: pecaX.id } }))?.quantidadeEstoque, 1);
      assert.equal((await prisma.peca.findUnique({ where: { id: pecaY.id } }))?.quantidadeEstoque, 0);
    });

    it('Cancelamento devolve estoque sem duplicidade e confirmação nunca devolve saldo', async () => {
      const peca = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Ciclo Vida ${sufixo}`, 2);

      // Reserva todas as 2 unidades -> saldo 0, RESERVADA
      const res = await executarReservaComRastreio(comprador1.cookie, [{ pecaId: peca.id, quantidade: 2 }]);
      assert.equal(res.status, 201);
      const grupoId = res.body.grupoId as string;
      assert.equal((await prisma.peca.findUnique({ where: { id: peca.id } }))?.quantidadeEstoque, 0);

      // Cancelamento concorrente duplicado -> apenas 1 devolução, saldo final exato = 2 e DISPONIVEL
      const [canc1, canc2] = await Promise.all([
        chamar('POST', `/estoque/reservas/${grupoId}/cancelar`, undefined, comprador1.cookie),
        chamar('POST', `/estoque/reservas/${grupoId}/cancelar`, undefined, comprador1.cookie),
      ]);
      assert.equal(canc1.status, 200);
      assert.equal(canc2.status, 200);
      assert.equal(canc1.body.unidadesDevolvidas + canc2.body.unidadesDevolvidas, 2);

      const pecaAposCancelamento = await prisma.peca.findUnique({ where: { id: peca.id } });
      assert.equal(pecaAposCancelamento?.quantidadeEstoque, 2);
      assert.equal(pecaAposCancelamento?.status, 'DISPONIVEL');

      // Nova reserva de 2 seguida de confirmação -> saldo continua 0, status VENDIDA, confirmação repetida não credita
      const resConf = await executarReservaComRastreio(comprador2.cookie, [
        { pecaId: peca.id, quantidade: 2 },
      ]);
      assert.equal(resConf.status, 201);
      const grupoConfId = resConf.body.grupoId as string;

      const conf1 = await chamar(
        'POST',
        `/estoque/reservas/${grupoConfId}/confirmar`,
        undefined,
        comprador2.cookie,
      );
      const conf2 = await chamar(
        'POST',
        `/estoque/reservas/${grupoConfId}/confirmar`,
        undefined,
        comprador2.cookie,
      );
      assert.equal(conf1.status, 200);
      assert.equal(conf1.body.jaConfirmada, false);
      assert.equal(conf2.status, 200);
      assert.equal(conf2.body.jaConfirmada, true);

      const pecaConfirmada = await prisma.peca.findUnique({ where: { id: peca.id } });
      assert.equal(pecaConfirmada?.quantidadeEstoque, 0);
      assert.equal(pecaConfirmada?.status, 'VENDIDA');

      // Cancelar reserva já confirmada -> 409 sem devolver estoque
      const cancPosConf = await chamar(
        'POST',
        `/estoque/reservas/${grupoConfId}/cancelar`,
        undefined,
        comprador2.cookie,
      );
      assert.equal(cancPosConf.status, 409);
      assert.equal((await prisma.peca.findUnique({ where: { id: peca.id } }))?.quantidadeEstoque, 0);
    });

    it('Expiração após 15 minutos devolve estoque e corrida expiração × confirmação mantém consistência', async () => {
      // 1) Expiração pura e idempotência da rotina
      const pecaExp = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Expiração 15m ${sufixo}`, 1);
      const resExp = await executarReservaComRastreio(comprador1.cookie, [
        { pecaId: pecaExp.id, quantidade: 1 },
      ]);
      assert.equal(resExp.status, 201);
      const grupoExpId = resExp.body.grupoId as string;

      // Antes de 15 min não expira
      const antes = await reservaRepo.expirarReservasVencidas(new Date());
      assert.equal(antes.reservasExpiradas, 0);

      // Recua somente a reserva de teste para simular >15 min decorridos sem afetar outras reservas da suíte
      await prisma.reserva.updateMany({
        where: { grupoId: grupoExpId },
        data: {
          criadoEm: new Date(Date.now() - 16 * 60 * 1000),
          expiraEm: new Date(Date.now() - 60 * 1000),
        },
      });

      // Após 15 min no relógio atual, expira exatamente uma vez e reabre para novo comprador
      const agoraExp = new Date();
      const expResult1 = await reservaRepo.expirarReservasVencidas(agoraExp);
      assert.equal(expResult1.reservasExpiradas, 1);
      assert.equal(expResult1.unidadesDevolvidas, 1);
      const expResult2 = await reservaRepo.expirarReservasVencidas(agoraExp);
      assert.equal(expResult2.reservasExpiradas, 0);

      const pecaReaberta = await prisma.peca.findUnique({ where: { id: pecaExp.id } });
      assert.equal(pecaReaberta?.quantidadeEstoque, 1);
      assert.equal(pecaReaberta?.status, 'DISPONIVEL');
      const reservaExp = await prisma.reserva.findFirst({ where: { grupoId: grupoExpId } });
      assert.equal(reservaExp?.status, 'EXPIRADA');
      assert.ok(reservaExp?.estoqueDevolvidoEm);

      // 2) Corrida simultânea entre confirmação e expiração com tempo exatamente vencido
      const pecaRace = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Race ExpConf ${sufixo}`, 1);
      const resRace = await executarReservaComRastreio(comprador2.cookie, [
        { pecaId: pecaRace.id, quantidade: 1 },
      ]);
      assert.equal(resRace.status, 201);
      const grupoRaceId = resRace.body.grupoId as string;

      // Recua `criado_em` e `expira_em` apenas desta reserva de teste para simular >15 min decorridos no relógio do servidor
      const passado = new Date(Date.now() - 20 * 60 * 1000);
      const expirou = new Date(Date.now() - 5 * 60 * 1000);
      await prisma.reserva.updateMany({
        where: { grupoId: grupoRaceId },
        data: { criadoEm: passado, expiraEm: expirou },
      });

      const [resConfirmar, resExpirar] = await Promise.all([
        chamar('POST', `/estoque/reservas/${grupoRaceId}/confirmar`, undefined, comprador2.cookie),
        reservaRepo.expirarReservasVencidas(),
      ]);

      // Expirada antes de confirmar: confirmação DEVE ser recusada (409) e saldo devolvido exatamente 1 vez
      assert.equal(resConfirmar.status, 409);
      assert.equal(resExpirar.unidadesDevolvidas <= 1, true);
      const pecaRaceFinal = await prisma.peca.findUnique({ where: { id: pecaRace.id } });
      assert.equal(pecaRaceFinal?.quantidadeEstoque, 1);
      assert.equal(pecaRaceFinal?.status, 'DISPONIVEL');

      // 3) Corrida simultânea no limite exato com exclusão mútua entre confirmação (antes de vencer) e expiração (após vencer)
      const pecaMutex = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Race Mutex ${sufixo}`, 1);
      const resMutex = await executarReservaComRastreio(comprador1.cookie, [
        { pecaId: pecaMutex.id, quantidade: 1 },
      ]);
      assert.equal(resMutex.status, 201);
      const grupoMutexId = resMutex.body.grupoId as string;

      await prisma.reserva.updateMany({
        where: { grupoId: grupoMutexId },
        data: {
          criadoEm: new Date(Date.now() - (15 * 60 * 1000 + 2000)),
          expiraEm: new Date(Date.now() - 2000),
        },
      });

      const antesDeVencer = new Date(Date.now() - 10_000);
      const depoisDeVencer = new Date();

      const [confMutex, expMutex] = await Promise.all([
        reservaRepo.confirmarPorGrupo(grupoMutexId, comprador1.id, antesDeVencer).catch((e: unknown) => e),
        reservaRepo.expirarReservasVencidas(depoisDeVencer),
      ]);

      const reservaMutexFinal = await prisma.reserva.findFirst({ where: { grupoId: grupoMutexId } });
      const pecaMutexFinal = await prisma.peca.findUnique({ where: { id: pecaMutex.id } });
      assert.ok(reservaMutexFinal && pecaMutexFinal);

      if (reservaMutexFinal.status === 'CONFIRMADA') {
        assert.equal('jaConfirmada' in (confMutex as object), true);
        assert.equal(reservaMutexFinal.estoqueDevolvidoEm, null);
        assert.equal(pecaMutexFinal.quantidadeEstoque, 0);
        assert.equal(pecaMutexFinal.status, 'VENDIDA');
        assert.equal(expMutex.reservasExpiradas, 0);
      } else {
        assert.equal(reservaMutexFinal.status, 'EXPIRADA');
        assert.ok(reservaMutexFinal.estoqueDevolvidoEm);
        assert.equal(pecaMutexFinal.quantidadeEstoque, 1);
        assert.equal(pecaMutexFinal.status, 'DISPONIVEL');
      }
    });

    it('Rejeita entradas inválidas (negativa, zero, fracionária, acima do saldo e item legado p01)', async () => {
      const peca = await criarPecaNoBanco(titular.cookie, titular.atelieId, `Entradas Inválidas ${sufixo}`, 2);

      for (const quantidade of [0, -2, 1.5]) {
        const res = await executarReservaComRastreio(comprador1.cookie, [{ pecaId: peca.id, quantidade }]);
        assert.equal(res.status, 422);
      }

      const acimaSaldo = await executarReservaComRastreio(comprador1.cookie, [
        { pecaId: peca.id, quantidade: 3 },
      ]);
      assert.equal(acimaSaldo.status, 409);

      const legado = await executarReservaComRastreio(comprador1.cookie, [
        { pecaId: 'p01' as string, quantidade: 1 },
      ]);
      assert.equal(legado.status, 422);
      assert.equal(legado.body.codigo, RESERVA_ERROR_CODES.PECA_NAO_PERSISTIDA);
    });
  },
);
