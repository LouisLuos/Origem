import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import express from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import {
  FRETE_ERROR_CODES,
  type FonteLogisticaPecaRepository,
} from '../../src/repositories/contracts/frete.contracts.js';
import type { ProdutoPublico, ProdutoRepositoryPort } from '../../src/repositories/produto.repository.js';
import { createFreteRoutes } from '../../src/routes/frete.routes.js';
import { createProdutoRoutes } from '../../src/routes/produto.routes.js';
import {
  createFreteService,
  TabeladoLogisticaFreteProvider,
} from '../../src/services/frete.service.js';
import {
  calcularRelevanciaFts,
  createProdutoService,
} from '../../src/services/produto.service.js';
import { listarProdutosQuerySchema } from '../../src/validators/catalog.validator.js';
import { validarSimulacaoFreteInput } from '../../src/validators/frete.validator.js';

const PECA_TRACUNHAEM_DISPONIVEL = '11111111-1111-4111-8111-111111111111';
const PECA_TRACUNHAEM_ESGOTADA = '22222222-2222-4222-8222-222222222222';
const PECA_MARACATU_TITULO = '33333333-3333-4333-8333-333333333333';
const PECA_MARACATU_DESCRICAO = '44444444-4444-4444-8444-444444444444';
const PECA_RENDA_PESQUEIRA = '55555555-5555-4555-8555-555555555555';

const ACERVO_TESTE: ProdutoPublico[] = [
  {
    id: PECA_TRACUNHAEM_DISPONIVEL,
    title: 'Leão de Barro de Tracunhaém',
    description: 'Escultura tradicional modelada em barro vermelho.',
    artisan: 'Mestre Nuca',
    artisanId: 'art-mestre-nuca',
    hub: 'Tracunhaém',
    technique: 'Cerâmica Figurativa',
    price: 310,
    stock: 4,
    active: true,
    status: 'DISPONIVEL',
    imageUrl: 'https://exemplo.com/leao.jpg',
    imageAlt: 'Leão de Barro de Tracunhaém',
  },
  {
    id: PECA_TRACUNHAEM_ESGOTADA,
    title: 'Vaso de Tracunhaém Esgotado',
    description: 'Peça de cerâmica atualmente sem estoque.',
    artisan: 'Mestre Nuca',
    artisanId: 'art-mestre-nuca',
    hub: 'Tracunhaém',
    technique: 'Cerâmica Figurativa',
    price: 180,
    stock: 0,
    active: true,
    status: 'VENDIDA',
    imageUrl: 'https://exemplo.com/vaso.jpg',
    imageAlt: 'Vaso de Tracunhaém Esgotado',
  },
  {
    id: PECA_MARACATU_TITULO,
    title: 'Caboclo de Lança do Maracatu em Barro',
    description: 'Figura expressiva do maracatu rural esculpida em barro cozido na Zona da Mata.',
    artisan: 'Mestre Salustiano Atelier',
    artisanId: 'art-mestre-salustiano',
    hub: 'Tracunhaém',
    technique: 'Cerâmica Figurativa',
    price: 290,
    stock: 2,
    active: true,
    status: 'DISPONIVEL',
    imageUrl: 'https://exemplo.com/maracatu1.jpg',
    imageAlt: 'Caboclo de Lança do Maracatu em Barro',
  },
  {
    id: PECA_MARACATU_DESCRICAO,
    title: 'Estandarte Festivo da Zona da Mata',
    description:
      'Peça decorativa inspirada nos cortejos de maracatu com apliques laterais modelados em barro.',
    artisan: 'Coletivo Nazaré',
    artisanId: 'art-coletivo-nazare',
    hub: 'Nazaré da Mata',
    technique: 'Cerâmica Figurativa',
    price: 220,
    stock: 3,
    active: true,
    status: 'DISPONIVEL',
    imageUrl: 'https://exemplo.com/maracatu2.jpg',
    imageAlt: 'Estandarte Festivo da Zona da Mata',
  },
  {
    id: PECA_RENDA_PESQUEIRA,
    title: 'Toalha Imperial em Renda Renascença',
    description: 'Renda tecida à mão com linha de algodão em Pesqueira.',
    artisan: 'Dona Analu',
    artisanId: 'art-dona-analu',
    hub: 'Pesqueira',
    technique: 'Renda Renascença',
    price: 450,
    stock: 5,
    active: true,
    status: 'DISPONIVEL',
    imageUrl: 'https://exemplo.com/renda.jpg',
    imageAlt: 'Toalha Imperial em Renda Renascença',
  },
];

const fakeProdutoRepo: ProdutoRepositoryPort = {
  async findAll() {
    return [...ACERVO_TESTE];
  },
  async findById(id: string) {
    return ACERVO_TESTE.find((p) => p.id === id) ?? null;
  },
};

const fakeFonteLogisticaRepo: FonteLogisticaPecaRepository = {
  async buscarOrigemLogisticaPorPecaId(pecaId: string) {
    const peca = ACERVO_TESTE.find((p) => p.id === pecaId);
    if (!peca) return null;
    return {
      pecaId: peca.id,
      cepOrigem: '55805000', // Tracunhaém - PE (nunca deve vazar na resposta pública)
      cubagem: {
        pesoGramas: 1400,
        comprimentoCm: 30,
        larguraCm: 20,
        alturaCm: 20,
      },
      isFragil: true,
    };
  },
};

async function withHu07TestServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/produtos', createProdutoRoutes(createProdutoService(fakeProdutoRepo)));
  app.use(
    '/api/v1/frete',
    createFreteRoutes(
      createFreteService(new TabeladoLogisticaFreteProvider(), fakeFonteLogisticaRepo),
    ),
  );
  app.use(errorHandler);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Falha ao abrir porta de teste.');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

describe('HU-07 — Vitrine Cultural com Filtros Dinâmicos, Busca FTS (GIN) e Simulação de Frete', () => {
  it('T-VIT-01: migration SQL define índice GIN em pecas(to_tsvector("portuguese", titulo || descricao))', () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const migrationPath = path.resolve(
      currentDir,
      '../../prisma/migrations/20261123093000_hu07_vitrine_fts_gin/migration.sql',
    );
    assert.equal(fs.existsSync(migrationPath), true, 'Migration da HU-07 deve existir.');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    assert.match(sql, /USING\s+GIN\s*\(\s*to_tsvector\(\s*'portuguese'/i);
    assert.match(sql, /coalesce\("titulo",\s*''\)\s*\|\|\s*' '\s*\|\|\s*coalesce\("descricao",\s*''\)/i);
  });

  it('Cenário 1 (T-VIT-02): filtragem combinada por polo "Tracunhaém" e tipologia "Barro/Cerâmica" retorna apenas peças disponíveis em < 400ms', async () => {
    await withHu07TestServer(async (baseUrl) => {
      const inicio = performance.now();
      const res = await fetch(
        `${baseUrl}/api/v1/produtos?hub=Tracunha%C3%A9m&technique=Barro%2FCer%C3%A2mica`,
      );
      const duracaoMs = performance.now() - inicio;
      const body = (await res.json()) as {
        dados: ProdutoPublico[];
        meta: { totalItens: number };
      };

      assert.equal(res.status, 200);
      assert.ok(duracaoMs < 400, `Listagem demorou ${duracaoMs.toFixed(1)}ms (limite: 400ms)`);
      assert.equal(body.dados.length, 2);

      // Peça esgotada/vendida de Tracunhaém NÃO deve aparecer
      const ids = body.dados.map((p) => p.id);
      assert.ok(ids.includes(PECA_TRACUNHAEM_DISPONIVEL));
      assert.ok(ids.includes(PECA_MARACATU_TITULO));
      assert.ok(!ids.includes(PECA_TRACUNHAEM_ESGOTADA));

      for (const item of body.dados) {
        assert.equal(item.hub, 'Tracunhaém');
        assert.ok(item.stock > 0);
        assert.equal(item.status, 'DISPONIVEL');
      }
    });
  });

  it('Cenário 2 (T-VIT-02 / TC06): busca textual FTS por "maracatu barro" retorna peças correspondentes ordenadas por relevância textual', async () => {
    await withHu07TestServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/produtos?q=maracatu%20barro`);
      const body = (await res.json()) as { dados: ProdutoPublico[] };

      assert.equal(res.status, 200);
      assert.equal(body.dados.length, 2);

      // A peça que contém "Maracatu" e "Barro" no TÍTULO (peso A) deve vir antes da que só menciona na descrição (peso B)
      assert.equal(body.dados[0].id, PECA_MARACATU_TITULO);
      assert.equal(body.dados[1].id, PECA_MARACATU_DESCRICAO);
      assert.ok(
        (body.dados[0].relevanceScore ?? 0) > (body.dados[1].relevanceScore ?? 0),
        'O score de relevância FTS do match no título deve superar o match apenas na descrição.',
      );

      const scoreTitulo = calcularRelevanciaFts(ACERVO_TESTE[2], 'maracatu barro');
      const scoreDescricao = calcularRelevanciaFts(ACERVO_TESTE[3], 'maracatu barro');
      const scoreNaoRelacionado = calcularRelevanciaFts(ACERVO_TESTE[4], 'maracatu barro');
      assert.ok(scoreTitulo > scoreDescricao);
      assert.equal(scoreNaoRelacionado, 0);
    });
  });

  it('Cenário 3 (T-VIT-03): POST /api/v1/frete/simular calcula valor e prazo com base no CEP de origem e cubagem em < 1.800ms sem expor endereço do ateliê (LGPD)', async () => {
    await withHu07TestServer(async (baseUrl) => {
      const inicio = performance.now();
      const resPe = await fetch(`${baseUrl}/api/v1/frete/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pecaId: PECA_TRACUNHAEM_DISPONIVEL,
          cepDestino: '50030-000', // Recife - PE
        }),
      });
      const duracaoMs = performance.now() - inicio;
      const bodyPe = (await resPe.json()) as Record<string, unknown>;

      assert.equal(resPe.status, 200);
      assert.ok(duracaoMs < 1800, `Cotação demorou ${duracaoMs.toFixed(1)}ms (limite: 1800ms)`);
      assert.equal(bodyPe.pecaId, PECA_TRACUNHAEM_DISPONIVEL);
      assert.equal(bodyPe.cepDestino, '50030000');
      assert.equal(typeof bodyPe.valorBrl, 'number');
      assert.equal(typeof bodyPe.prazoEstimadoDias, 'number');
      assert.ok((bodyPe.valorBrl as number) > 0);
      assert.ok((bodyPe.prazoEstimadoDias as number) > 0);
      // Salvaguarda LGPD (RNF-11): cepOrigem do ateliê nunca deve ser exposto na resposta
      assert.equal('cepOrigem' in bodyPe, false);

      // Destino interestadual (São Paulo - SP) deve ter prazo e valor superiores ao envio intraestadual (PE)
      const resSp = await fetch(`${baseUrl}/api/v1/frete/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pecaId: PECA_TRACUNHAEM_DISPONIVEL,
          cepDestino: '01310-100',
        }),
      });
      const bodySp = (await resSp.json()) as { valorBrl: number; prazoEstimadoDias: number };
      assert.equal(resSp.status, 200);
      assert.ok(bodySp.valorBrl > (bodyPe.valorBrl as number));
      assert.ok(bodySp.prazoEstimadoDias > (bodyPe.prazoEstimadoDias as number));

      // Validação de CEP inválido -> 400 e peça inexistente -> 404
      const resCepInvalido = await fetch(`${baseUrl}/api/v1/frete/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pecaId: PECA_TRACUNHAEM_DISPONIVEL,
          cepDestino: '123',
        }),
      });
      assert.equal(resCepInvalido.status, 400);

      const resPecaInexistente = await fetch(`${baseUrl}/api/v1/frete/simular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pecaId: '99999999-9999-4999-8999-999999999999',
          cepDestino: '50030-000',
        }),
      });
      assert.equal(resPecaInexistente.status, 404);
    });
  });

  it('Validators da HU-07: aceita aliases (polo, tipologia, busca) e rejeita CEPs malformados', () => {
    const parsedQuery = listarProdutosQuerySchema.parse({
      polo: 'Tracunhaém',
      tipologia: 'Barro/Cerâmica',
      busca: 'maracatu barro',
      apenasDisponiveis: 'true',
    });
    assert.equal(parsedQuery.hub, 'Tracunhaém');
    assert.equal(parsedQuery.technique, 'Barro/Cerâmica');
    assert.equal(parsedQuery.q, 'maracatu barro');
    assert.equal(parsedQuery.apenasDisponiveis, true);

    const parsedFrete = validarSimulacaoFreteInput({
      produtoId: PECA_TRACUNHAEM_DISPONIVEL,
      cep: '50030-000',
    });
    assert.equal(parsedFrete.pecaId, PECA_TRACUNHAEM_DISPONIVEL);
    assert.equal(parsedFrete.cepDestino, '50030000');

    assert.throws(
      () => validarSimulacaoFreteInput({ pecaId: PECA_TRACUNHAEM_DISPONIVEL, cepDestino: '00000-000' }),
      (err: unknown) =>
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === FRETE_ERROR_CODES.FRETE_DADOS_INVALIDOS,
    );
  });
});

