import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PAGAMENTO_ERROR_CODES } from '../../src/integrations/paymentGateway.contracts.js';
import {
  validarCotacaoFreteCheckout,
  validarCriacaoCheckout,
  validarGatewayWebhookParam,
  validarParametroPedidoIdOuCodigo,
} from '../../src/validators/pedidoPagamento.validator.js';

const RESERVA_GRUPO_UUID = '11111111-1111-4111-8111-111111111111';

const ENDERECO_VALIDO = {
  nomeDestinatario: 'Maria Silva',
  email: 'maria@exemplo.pe.br',
  telefone: '(81) 99999-8888',
  cep: '50010-000',
  logradouro: 'Rua da Aurora',
  numero: '123',
  bairro: 'Boa Vista',
  cidade: 'Recife',
  uf: 'pe',
};

describe('HU-10 — Validadores de checkout, bloqueio PAN/CVV e rotas', () => {
  it('aceita cotação de frete e normaliza CEP de destino', () => {
    const validado = validarCotacaoFreteCheckout({
      reservaGrupoId: RESERVA_GRUPO_UUID,
      cepDestino: '55002-123',
    });

    assert.equal(validado.reservaGrupoId, RESERVA_GRUPO_UUID);
    assert.equal(validado.cepDestino, '55002123');
  });

  it('rejeita imediatamente qualquer campo sensível de cartão (PAN/CVV) com código 422', () => {
    assert.throws(
      () =>
        validarCriacaoCheckout(
          {
            reservaGrupoId: RESERVA_GRUPO_UUID,
            metodoPagamento: 'CARTAO_CREDITO',
            enderecoEntrega: ENDERECO_VALIDO,
            cartao: {
              token: 'tok_sandbox_123456',
              parcelas: 3,
              numeroCartao: '4111111111111111',
              cvv: '123',
            },
          },
          'idem-pan-001',
        ),
      (err: { statusCode?: number; code?: string }) =>
        err.statusCode === 422 && err.code === PAGAMENTO_ERROR_CODES.DADOS_SENSIVEIS_CARTAO_PROIBIDOS,
    );
  });

  it('valida checkout CARTAO_CREDITO exclusivamente com token efêmero e sem armazenar PAN', () => {
    const validado = validarCriacaoCheckout(
      {
        reservaGrupoId: RESERVA_GRUPO_UUID,
        metodoPagamento: 'CARTAO_CREDITO',
        enderecoEntrega: ENDERECO_VALIDO,
        cartao: {
          token: 'tok_sandbox_seguro_999',
          parcelas: 2,
          bandeira: 'Visa',
          ultimosDigitos: '1111',
        },
      },
      'checkout-key-001',
    );

    assert.equal(validado.metodoPagamento, 'CARTAO_CREDITO');
    assert.equal(validado.enderecoEntrega.uf, 'PE');
    assert.equal(validado.enderecoEntrega.cep, '50010000');
    assert.equal(validado.cartao?.token, 'tok_sandbox_seguro_999');
    assert.equal(validado.cartao?.parcelas, 2);
    assert.match(validado.payloadHash, /^[0-9a-f]{64}$/);
  });

  it('normaliza parâmetros de gateway e identificadores de pedido (UUID e OR-...)', () => {
    assert.equal(validarGatewayWebhookParam('pagarme'), 'pagarme_v5');
    assert.equal(validarGatewayWebhookParam('pagarme_v5'), 'pagarme_v5');
    assert.equal(validarGatewayWebhookParam(['mercado_pago']), 'mercado_pago');

    assert.deepEqual(validarParametroPedidoIdOuCodigo(RESERVA_GRUPO_UUID), {
      tipo: 'id',
      valor: RESERVA_GRUPO_UUID,
    });
    assert.deepEqual(validarParametroPedidoIdOuCodigo('or-20261123-ab12cd'), {
      tipo: 'codigoPedido',
      valor: 'OR-20261123-AB12CD',
    });
  });
});
