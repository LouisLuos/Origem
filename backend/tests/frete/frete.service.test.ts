import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  CotacaoFrete,
  CotacaoFreteInput,
  ProvedorCotacaoFrete,
} from '../../src/repositories/contracts/frete.contracts.js';
import { createFreteService } from '../../src/services/frete.service.js';

const dadosCotacao: CotacaoFreteInput = {
  cepOrigem: '55860000',
  cepDestino: '50030000',
  cubagem: {
    pesoGramas: 850,
    comprimentoCm: 24,
    larguraCm: 18,
    alturaCm: 12,
  },
};

const resultadoEsperado: CotacaoFrete = {
  valorBrl: 24.9,
  prazoEstimadoDias: 4,
};

describe('serviço de cotação de frete', () => {
  it('mantém o mesmo contrato ao substituir o adaptador do provedor', async () => {
    const chamadas: CotacaoFreteInput[][] = [[], []];
    const provedores: ProvedorCotacaoFrete[] = [
      {
        async cotar(dados) {
          chamadas[0].push(dados);
          return resultadoEsperado;
        },
      },
      {
        async cotar(dados) {
          chamadas[1].push(dados);
          return resultadoEsperado;
        },
      },
    ];

    const resultados = await Promise.all(
      provedores.map((provedor) => createFreteService(provedor).cotar(dadosCotacao)),
    );

    assert.deepEqual(chamadas, [
      [dadosCotacao],
      [dadosCotacao],
    ]);
    assert.deepEqual(resultados, [resultadoEsperado, resultadoEsperado]);
  });
});
