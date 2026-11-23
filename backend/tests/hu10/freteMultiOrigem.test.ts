import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  FRETE_ERROR_CODES,
  HttpCotacaoFreteProvider,
  UnconfiguredCotacaoFreteProvider,
} from '../../src/integrations/frete.provider.js';
import type { ItemFreteOrigemInput } from '../../src/repositories/contracts/frete.contracts.js';
import { cotarFretesPorOrigem } from '../../src/services/frete.service.js';

describe('HU-10 — Arquitetura de Frete Multi-Origem (ADR-001)', () => {
  let server: http.Server;
  let endpointUrl = '';
  const chamadasRecebidas: Array<{ cepOrigem: string; cepDestino: string; pesoGramas: number }> = [];

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/cotar') {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            cepOrigem: string;
            cepDestino: string;
            cubagem: { pesoGramas: number };
          };
          chamadasRecebidas.push({
            cepOrigem: body.cepOrigem,
            cepDestino: body.cepDestino,
            pesoGramas: body.cubagem.pesoGramas,
          });
          // Resposta controlada por CEP de origem para validar soma determinística
          const isCaruaru = body.cepOrigem === '55002000';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              valorBrl: isCaruaru ? 18.4 : 26.75,
              prazoEstimadoDias: isCaruaru ? 3 : 5,
            }),
          );
        });
        return;
      }

      res.writeHead(404).end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };
    endpointUrl = `http://127.0.0.1:${address.port}/cotar`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('falha explicitamente (503 PROVEDOR_FRETE_NAO_CONFIGURADO) sem inventar tarifa quando não configurado', async () => {
    const provider = new UnconfiguredCotacaoFreteProvider();
    await assert.rejects(
      () =>
        cotarFretesPorOrigem(
          provider,
          [
            {
              pecaId: 'peca-1',
              titulo: 'Boneca de Barro',
              quantidade: 1,
              cubagem: { pesoGramas: 800, comprimentoCm: 20, larguraCm: 15, alturaCm: 25 },
              atelieId: 'atelie-1',
              atelieNome: 'Barro Vivo',
              poloCultural: 'Alto do Moura',
              cepOrigem: '55002000',
            },
          ],
          '50010000',
        ),
      (err: { statusCode?: number; code?: string }) =>
        err.statusCode === 503 && err.code === FRETE_ERROR_CODES.PROVEDOR_FRETE_NAO_CONFIGURADO,
    );
  });

  it('consolida cubagem por ateliê de origem e soma fretes multi-origem via HTTP real', async () => {
    chamadasRecebidas.length = 0;
    const provider = new HttpCotacaoFreteProvider({
      endpoint: endpointUrl,
      timeoutMs: 3000,
    });

    const itens: ItemFreteOrigemInput[] = [
      {
        pecaId: 'p1',
        titulo: 'Moranga de Barro',
        quantidade: 2,
        cubagem: { pesoGramas: 500, comprimentoCm: 20, larguraCm: 20, alturaCm: 15 },
        atelieId: 'atelie-caruaru',
        atelieNome: 'Ateliê Vitalino',
        poloCultural: 'Caruaru',
        cepOrigem: '55002-000',
      },
      {
        pecaId: 'p2',
        titulo: 'Renda Renascença',
        quantidade: 1,
        cubagem: { pesoGramas: 250, comprimentoCm: 30, larguraCm: 25, alturaCm: 5 },
        atelieId: 'atelie-olinda',
        atelieNome: 'Casa da Renda',
        poloCultural: 'Olinda',
        cepOrigem: '53020-000',
      },
    ];

    const cotacao = await cotarFretesPorOrigem(provider, itens, '50010-000');

    assert.equal(chamadasRecebidas.length, 2);
    assert.equal(cotacao.fretesPorOrigem.length, 2);
    assert.equal(cotacao.valorTotalFreteCentavos, 4515);
    assert.equal(cotacao.valorTotalFrete, 45.15);
  });

  it('bloqueia cotação quando ateliê de origem não possui CEP cadastrado', async () => {
    const provider = new HttpCotacaoFreteProvider({
      endpoint: endpointUrl,
      timeoutMs: 3000,
    });

    await assert.rejects(
      () =>
        cotarFretesPorOrigem(
          provider,
          [
            {
              pecaId: 'p1',
              titulo: 'Peça sem CEP',
              quantidade: 1,
              cubagem: { pesoGramas: 300, comprimentoCm: 10, larguraCm: 10, alturaCm: 10 },
              atelieId: 'atelie-sem-cep',
              atelieNome: 'Oficina Sem CEP',
              poloCultural: 'Recife',
              cepOrigem: null,
            },
          ],
          '50010000',
        ),
      (err: { statusCode?: number; code?: string }) =>
        err.statusCode === 422 && err.code === FRETE_ERROR_CODES.ORIGEM_SEM_ENDERECO_EXPEDICAO,
    );
  });
});
