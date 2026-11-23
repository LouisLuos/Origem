import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validarEnderecoComprador } from '../../src/validators/endereco.validator.js';
import { AppError } from '../../src/utils/AppError.js';

const valido = {
  cep: '01310-100',
  logradouro: ' Avenida Paulista ',
  numero: '1000',
  complemento: '',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'sp',
};

describe('HU-11 · validação do endereço do comprador', () => {
  it('normaliza CEP, UF e espaços e aceita UF fora de Pernambuco', () => {
    const dados = validarEnderecoComprador(valido);
    assert.equal(dados.cep, '01310100');
    assert.equal(dados.uf, 'SP');
    assert.equal(dados.logradouro, 'Avenida Paulista');
    assert.equal(dados.complemento, undefined);
  });

  it('rejeita CEP incompleto e UF inexistente com 422', () => {
    assert.throws(
      () => validarEnderecoComprador({ ...valido, cep: '1234', uf: 'XX' }),
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 422 &&
        err.code === 'ENDERECO_DADOS_INVALIDOS' &&
        err.message.includes('CEP') &&
        err.message.includes('UF'),
    );
  });

  it('exige logradouro, número, bairro e cidade', () => {
    assert.throws(
      () => validarEnderecoComprador({ cep: '50030230', uf: 'PE' }),
      (err: unknown) =>
        err instanceof AppError &&
        ['logradouro', 'número', 'bairro', 'cidade'].every((campo) => err.message.includes(campo)),
    );
  });

  it('rejeita corpo que não é objeto', () => {
    assert.throws(() => validarEnderecoComprador('rua'), AppError);
  });
});
