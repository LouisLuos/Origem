import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../src/utils/AppError.js';
import {
  PECA_DADOS_INVALIDOS_CODE,
  QUANTIDADE_ESTOQUE_PADRAO,
  pecaIdParamSchema,
  validarAtualizacaoEstoquePeca,
  validarCriacaoPeca,
} from '../../src/validators/peca.validator.js';
import { corpoPecaValido } from '../hu05/fixtures.js';

function capturarErroValidacao(fn: () => unknown): AppError {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof AppError);
    assert.equal(err.statusCode, 422);
    assert.equal(err.code, PECA_DADOS_INVALIDOS_CODE);
    return err;
  }
  assert.fail('Esperado AppError 422');
}

describe('HU-06 — Validação de quantidadeEstoque na criação e ajuste de peças', () => {
  it('usa 1 como valor padrão quando quantidadeEstoque não é informada', () => {
    const dados = validarCriacaoPeca(corpoPecaValido());
    assert.equal(dados.quantidadeEstoque, QUANTIDADE_ESTOQUE_PADRAO);
    assert.equal(dados.quantidadeEstoque, 1);
  });

  it('aceita quantidadeEstoque inteira positiva maior que 1 (lotes limitados)', () => {
    for (const qtd of [1, 2, 10, 250]) {
      const dados = validarCriacaoPeca({ ...corpoPecaValido(), quantidadeEstoque: qtd });
      assert.equal(dados.quantidadeEstoque, qtd);
    }
  });

  it('rejeita quantidadeEstoque zero, negativa, fracionária, nula ou não numérica na criação', () => {
    for (const invalida of [0, -1, -10, 1.5, 2.25, '10', null, NaN, Infinity, true, {}, 2_147_483_648]) {
      const err = capturarErroValidacao(() =>
        validarCriacaoPeca({ ...corpoPecaValido(), quantidadeEstoque: invalida }),
      );
      assert.match(err.message, /quantidade em estoque/i);
    }
  });

  it('valida ajuste absoluto (>= 0) e incremental (delta !== 0)', () => {
    assert.deepEqual(validarAtualizacaoEstoquePeca({ quantidadeEstoque: 0 }), {
      modo: 'ABSOLUTO',
      quantidadeEstoque: 0,
    });
    assert.deepEqual(validarAtualizacaoEstoquePeca({ quantidadeEstoque: 15 }), {
      modo: 'ABSOLUTO',
      quantidadeEstoque: 15,
    });
    assert.deepEqual(validarAtualizacaoEstoquePeca({ delta: 3 }), {
      modo: 'DELTA',
      delta: 3,
    });
    assert.deepEqual(validarAtualizacaoEstoquePeca({ delta: -2 }), {
      modo: 'DELTA',
      delta: -2,
    });
  });

  it('rejeita ajustes inválidos (ambos os campos, nenhum, negativo, zero em delta, frações)', () => {
    const entradasInvalidas: unknown[] = [
      {},
      { quantidadeEstoque: 5, delta: 1 },
      { quantidadeEstoque: -1 },
      { quantidadeEstoque: 1.5 },
      { quantidadeEstoque: '5' },
      { delta: 0 },
      { delta: 0.5 },
      { delta: '1' },
      null,
      [],
    ];

    for (const entrada of entradasInvalidas) {
      capturarErroValidacao(() => validarAtualizacaoEstoquePeca(entrada));
    }

    assert.equal(pecaIdParamSchema.parse({ pecaId: '  abc-123  ' }).pecaId, 'abc-123');
    assert.throws(() => pecaIdParamSchema.parse({ pecaId: '   ' }));
  });
});
