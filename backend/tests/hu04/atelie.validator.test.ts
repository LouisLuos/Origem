import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  atualizarAtelieBodySchema,
  criarAtelieBodySchema,
} from '../../src/validators/atelie.validator.js';

const validAtelie = {
  nomeComercial: 'Ateliê Maria',
  poloCultural: 'Tracunhaém',
  endereco: {
    cep: '55860000',
    logradouro: 'Rua das Rendeiras',
    numero: '123',
    complemento: 'Sala 2',
    bairro: 'Centro',
    cidade: 'Tracunhaém',
    uf: 'PE',
  },
};

describe('validador de ateliê', () => {
  it('aceita cadastro válido de ateliê em Pernambuco', () => {
    const result = criarAtelieBodySchema.parse(validAtelie);
    assert.equal(result.endereco.cep, '55860000');
    assert.equal(result.endereco.uf, 'PE');
  });

  it('rejeita polo cultural não homologado', () => {
    const result = criarAtelieBodySchema.safeParse({
      ...validAtelie,
      poloCultural: 'Recife Antigo',
    });
    assert.equal(result.success, false);
  });

  it('rejeita endereço fora de Pernambuco', () => {
    const result = criarAtelieBodySchema.safeParse({
      ...validAtelie,
      endereco: { ...validAtelie.endereco, uf: 'SP' },
    });
    assert.equal(result.success, false);
  });

  it('rejeita CEP com menos de oito dígitos', () => {
    const result = criarAtelieBodySchema.safeParse({
      ...validAtelie,
      endereco: { ...validAtelie.endereco, cep: '5586' },
    });
    assert.equal(result.success, false);
  });

  it('aplica as mesmas regras de validação à edição', () => {
    const result = atualizarAtelieBodySchema.safeParse({
      ...validAtelie,
      poloCultural: 'Polo não homologado',
    });
    assert.equal(result.success, false);
  });
});
