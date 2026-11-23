import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RESERVA_ERROR_CODES } from '../../src/repositories/contracts/reservas.contracts.js';
import { AppError } from '../../src/utils/AppError.js';
import {
  validarCriacaoReserva,
  validarUuidParam,
} from '../../src/validators/reserva.validator.js';

const PECA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PECA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PECA_B_UPPER = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';

function capturarAppError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof AppError);
    return err;
  }
  assert.fail('Esperado AppError');
}

describe('HU-06 — Validação, consolidação e ordenação de reservas de estoque', () => {
  it('consolida itens repetidos, ordena por pecaId e aceita contratos `itens` e `lines` com mesmo payloadHash', () => {
    const r1 = validarCriacaoReserva(
      {
        itens: [
          { pecaId: PECA_B_UPPER, quantidade: 2 },
          { pecaId: PECA_A, quantidade: 1 },
          { pecaId: PECA_B, quantidade: 3 },
        ],
      },
      'chave-idem-01',
    );

    const r2 = validarCriacaoReserva(
      {
        lines: [
          { productId: PECA_A, quantity: 1 },
          { productId: PECA_B, quantity: 5 },
        ],
        idempotencyKey: 'chave-idem-01',
      },
    );

    assert.deepEqual(r1.itens, [
      { pecaId: PECA_A, quantidade: 1 },
      { pecaId: PECA_B, quantidade: 5 },
    ]);
    assert.deepEqual(r2.itens, r1.itens);
    assert.equal(r1.idempotencyKey, 'chave-idem-01');
    assert.equal(r1.payloadHash, r2.payloadHash);
    assert.match(r1.payloadHash, /^[0-9a-f]{64}$/);
  });

  it('rejeita peças do catálogo legado (não-UUID) com 422 PECA_NAO_PERSISTIDA', () => {
    const err = capturarAppError(() =>
      validarCriacaoReserva({ lines: [{ productId: 'p01', quantity: 1 }] }),
    );
    assert.equal(err.statusCode, 422);
    assert.equal(err.code, RESERVA_ERROR_CODES.PECA_NAO_PERSISTIDA);
  });

  it('rejeita quantidades inválidas (0, negativa, fracionária, string, acima de INT4) e listas vazias', () => {
    for (const quantidade of [0, -1, -5, 1.5, '2', null, NaN, Infinity, 2_147_483_648]) {
      const err = capturarAppError(() =>
        validarCriacaoReserva({ itens: [{ pecaId: PECA_A, quantidade }] }),
      );
      assert.equal(err.statusCode, 422);
      assert.equal(err.code, RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS);
    }

    for (const corpo of [{}, { itens: [] }, { lines: [] }, { itens: [], lines: [] }, null, 'x']) {
      const err = capturarAppError(() => validarCriacaoReserva(corpo));
      assert.equal(err.statusCode, 422);
      assert.equal(err.code, RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS);
    }
  });

  it('rejeita chave de idempotência com caracteres de controle ou excesso de tamanho e valida UUID params', () => {
    const errCtrl = capturarAppError(() =>
      validarCriacaoReserva({ itens: [{ pecaId: PECA_A, quantidade: 1 }] }, 'abc\ndef'),
    );
    assert.equal(errCtrl.statusCode, 422);

    const errLong = capturarAppError(() =>
      validarCriacaoReserva({ itens: [{ pecaId: PECA_A, quantidade: 1 }] }, 'k'.repeat(129)),
    );
    assert.equal(errLong.statusCode, 422);

    assert.equal(validarUuidParam(`  ${PECA_B_UPPER}  `, 'grupoId'), PECA_B);
    assert.equal(
      capturarAppError(() => validarUuidParam('nao-e-uuid', 'grupoId')).statusCode,
      422,
    );
  });
});
