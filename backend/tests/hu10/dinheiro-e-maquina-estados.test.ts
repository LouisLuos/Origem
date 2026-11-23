import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  podeTransicionarStatusPagamento,
  podeTransicionarStatusPedido,
} from '../../src/repositories/contracts/pedidosPagamentos.contracts.js';
import {
  centavosParaDecimalString,
  centavosParaNumero,
  decimalParaCentavos,
  somarCentavos,
} from '../../src/utils/dinheiro.util.js';

describe('HU-10 — Utilitários monetários e máquina de estados anti-regressão', () => {
  it('converte valores decimais com precisão inteira de centavos sem erro de ponto flutuante', () => {
    const a = decimalParaCentavos('19.90');
    const b = decimalParaCentavos('0.10');
    const c = decimalParaCentavos(24.9);

    assert.equal(a, 1990);
    assert.equal(b, 10);
    assert.equal(c, 2490);

    const soma = somarCentavos([a, b, c]);
    assert.equal(soma, 4490);
    assert.equal(centavosParaNumero(soma), 44.9);
    assert.equal(centavosParaDecimalString(soma), '44.90');
    assert.equal(centavosParaDecimalString(0), '0.00');
  });

  it('garante que pedido APROVADO ou RECONCILIACAO_ESTORNO nunca regride', () => {
    assert.equal(podeTransicionarStatusPedido('APROVADO', 'RECUSADO'), false);
    assert.equal(podeTransicionarStatusPedido('APROVADO', 'EXPIRADO'), false);
    assert.equal(podeTransicionarStatusPedido('APROVADO', 'PENDENTE_PAGAMENTO'), false);
    assert.equal(podeTransicionarStatusPedido('RECONCILIACAO_ESTORNO', 'APROVADO'), false);
    assert.equal(podeTransicionarStatusPedido('EXPIRADO', 'RECONCILIACAO_ESTORNO'), true);
    assert.equal(podeTransicionarStatusPedido('PENDENTE_PAGAMENTO', 'APROVADO'), true);
  });

  it('impede regressão de pagamento APROVADO e só permite evolução legítima para ESTORNADO', () => {
    assert.equal(podeTransicionarStatusPagamento('APROVADO', 'PENDENTE'), false);
    assert.equal(podeTransicionarStatusPagamento('APROVADO', 'RECUSADO'), false);
    assert.equal(podeTransicionarStatusPagamento('APROVADO', 'ESTORNADO'), true);
    assert.equal(podeTransicionarStatusPagamento('ESTORNADO', 'APROVADO'), false);
    assert.equal(podeTransicionarStatusPagamento('RECUSADO', 'PENDENTE'), false);
    assert.equal(podeTransicionarStatusPagamento('RECUSADO', 'APROVADO'), true);
  });
});
