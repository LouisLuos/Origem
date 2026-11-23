import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import { app as realApp } from '../../src/app.js';
import {
  artesaoIdParamSchema,
  listarArtesaosQuerySchema,
  listarProdutosQuerySchema,
  produtoIdParamSchema,
} from '../../src/validators/catalog.validator.js';
import {
  MAX_PAGE_LIMIT,
  optionalPositiveIntQuery,
  optionalTextQuery,
} from '../../src/validators/request.validator.js';

async function listenEphemeral(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server: Server = await new Promise((resolve) => {
    const s = realApp.listen(0, '127.0.0.1', () => resolve(s));
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

describe('request.validator & catalog.validator — Validação Zod v4 de query strings opcionais', () => {
  it('aceita query vazia e parâmetros parciais mantendo campos omitidos como undefined', () => {
    const emptyProducts = listarProdutosQuerySchema.safeParse({});
    assert.equal(emptyProducts.success, true);
    if (emptyProducts.success) {
      assert.equal(emptyProducts.data.page, undefined);
      assert.equal(emptyProducts.data.limit, undefined);
      assert.equal(emptyProducts.data.technique, undefined);
      assert.equal(emptyProducts.data.hub, undefined);
    }

    const partialProducts = listarProdutosQuerySchema.safeParse({
      limit: String(MAX_PAGE_LIMIT),
      hub: '  Caruaru  ',
    });
    assert.equal(partialProducts.success, true);
    if (partialProducts.success) {
      assert.equal(partialProducts.data.page, undefined);
      assert.equal(partialProducts.data.limit, 100);
      assert.equal(partialProducts.data.technique, undefined);
      assert.equal(partialProducts.data.hub, '  Caruaru  ');
    }

    const emptyArtisans = listarArtesaosQuerySchema.safeParse({});
    assert.equal(emptyArtisans.success, true);
    if (emptyArtisans.success) {
      assert.equal(emptyArtisans.data.page, undefined);
      assert.equal(emptyArtisans.data.limit, undefined);
      assert.equal(emptyArtisans.data.hub, undefined);
      assert.equal(emptyArtisans.data.technique, undefined);
      assert.equal(emptyArtisans.data.q, undefined);
    }

    const aliasArtisans = listarArtesaosQuerySchema.safeParse({
      page: '2',
      nome: 'Severino',
    });
    assert.equal(aliasArtisans.success, true);
    if (aliasArtisans.success) {
      assert.equal(aliasArtisans.data.page, 2);
      assert.equal(aliasArtisans.data.limit, undefined);
      assert.equal(aliasArtisans.data.hub, undefined);
      assert.equal(aliasArtisans.data.technique, undefined);
      assert.equal(aliasArtisans.data.q, 'Severino');
    }

    const precedenceArtisans = listarArtesaosQuerySchema.safeParse({
      q: 'Vitalino',
      nome: 'Ignorado',
      technique: '   ',
    });
    assert.equal(precedenceArtisans.success, true);
    if (precedenceArtisans.success) {
      assert.equal(precedenceArtisans.data.page, undefined);
      assert.equal(precedenceArtisans.data.limit, undefined);
      assert.equal(precedenceArtisans.data.hub, undefined);
      assert.equal(precedenceArtisans.data.technique, undefined);
      assert.equal(precedenceArtisans.data.q, 'Vitalino');
    }
  });

  it('converte strings vazias ou com espaços para undefined em optionalPositiveIntQuery e optionalTextQuery', () => {
    const intSchema = optionalPositiveIntQuery('limit', MAX_PAGE_LIMIT);
    const textSchema = optionalTextQuery('hub');

    for (const value of [undefined, '', '   ']) {
      const intParsed = intSchema.safeParse(value);
      assert.equal(intParsed.success, true);
      if (intParsed.success) {
        assert.equal(intParsed.data, undefined);
      }

      const textParsed = textSchema.safeParse(value);
      assert.equal(textParsed.success, true);
      if (textParsed.success) {
        assert.equal(textParsed.data, undefined);
      }
    }
  });

  it('rejeita valores inválidos e fora do intervalo permitido', () => {
    const invalidProductQueries: Array<Record<string, unknown>> = [
      { page: '0' },
      { page: '-1' },
      { page: '1.5' },
      { page: 'abc' },
      { limit: '0' },
      { limit: String(MAX_PAGE_LIMIT + 1) },
      { limit: 'abc' },
      { limit: 10 },
      { hub: 123 },
      { technique: { nested: true } },
    ];

    for (const invalidQuery of invalidProductQueries) {
      const parsed = listarProdutosQuerySchema.safeParse(invalidQuery);
      assert.equal(
        parsed.success,
        false,
        `Deveria rejeitar query inválida: ${JSON.stringify(invalidQuery)}`,
      );
    }

    const emptyParam = produtoIdParamSchema.safeParse({ id: '   ' });
    assert.equal(emptyParam.success, false);
    const missingParam = artesaoIdParamSchema.safeParse({});
    assert.equal(missingParam.success, false);
  });

  it('rejeita parâmetros repetidos representados como arrays pelo parser de query do Express', () => {
    const repeatedProductQueries: Array<Record<string, unknown>> = [
      { page: ['1', '2'] },
      { limit: ['10', '20'] },
      { technique: ['barro', 'renda'] },
      { hub: ['Caruaru', 'Olinda'] },
    ];

    for (const query of repeatedProductQueries) {
      const parsed = listarProdutosQuerySchema.safeParse(query);
      assert.equal(parsed.success, false);
    }

    const repeatedArtisanQueries: Array<Record<string, unknown>> = [
      { q: ['a', 'b'] },
      { nome: ['a', 'b'] },
      { page: ['1', '2'] },
      { limit: ['10', '50'] },
    ];

    for (const query of repeatedArtisanQueries) {
      const parsed = listarArtesaosQuerySchema.safeParse(query);
      assert.equal(parsed.success, false);
    }
  });
});

describe('Rotas públicas de catálogo — Integração HTTP com app real', () => {
  it('responde HTTP 200 nos endpoints públicos sem query params e com ?limit=100', async () => {
    const { baseUrl, close } = await listenEphemeral();

    try {
      const resProdutos = await fetch(`${baseUrl}/api/v1/produtos`);
      assert.equal(resProdutos.status, 200);
      const produtosBody = (await resProdutos.json()) as {
        dados: unknown[];
        meta: { totalItens: number; paginaAtual: number; itensPorPagina: number };
      };
      assert.equal(produtosBody.meta.totalItens, 14);
      assert.equal(produtosBody.meta.paginaAtual, 1);
      assert.equal(produtosBody.meta.itensPorPagina, 10);
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
        dados: unknown[];
        meta: { totalItens: number; itensPorPagina: number };
      };
      assert.ok(artesaosBody.meta.totalItens >= 10);
      assert.equal(artesaosBody.meta.itensPorPagina, 20);
      assert.equal(artesaosBody.dados.length, 10);

      const resArtesaosLimit = await fetch(`${baseUrl}/api/v1/artesaos?limit=100`);
      assert.equal(resArtesaosLimit.status, 200);
      const artesaosLimitBody = (await resArtesaosLimit.json()) as {
        dados: unknown[];
        meta: { totalItens: number; itensPorPagina: number };
      };
      assert.equal(artesaosLimitBody.meta.itensPorPagina, 100);
      assert.equal(artesaosLimitBody.dados.length, artesaosLimitBody.meta.totalItens);
    } finally {
      await close();
    }
  });

  it('responde HTTP 400 para valores inválidos e parâmetros repetidos nas rotas de catálogo', async () => {
    const { baseUrl, close } = await listenEphemeral();

    const invalidPaths = [
      '/api/v1/produtos?limit=101',
      '/api/v1/produtos?page=0',
      '/api/v1/produtos?page=abc',
      '/api/v1/produtos?limit=10&limit=20',
      '/api/v1/produtos?hub=Caruaru&hub=Olinda',
      '/api/v1/artesaos?limit=101',
      '/api/v1/artesaos?page=0',
      '/api/v1/artesaos?q=barro&q=madeira',
    ];

    try {
      for (const path of invalidPaths) {
        const res = await fetch(`${baseUrl}${path}`);
        assert.equal(res.status, 400, `Esperado HTTP 400 para ${path}`);
        const body = (await res.json()) as { erro?: string };
        assert.ok(typeof body.erro === 'string' && body.erro.startsWith('Dados inválidos:'));
      }
    } finally {
      await close();
    }
  });
});
