import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidCpfCnpj, loginBodySchema, registerBodySchema } from '../../src/validators/auth.validator.js';

const validRegistration = {
  name: 'Maria da Silva',
  email: ' Maria@Email.com ',
  cpfCnpj: '529.982.247-25',
  whatsapp: '(81) 99999-9999',
  password: 'Origem@2026',
};

describe('validações de autenticação', () => {
  it('valida CPF/CNPJ e normaliza os dados de cadastro', () => {
    const result = registerBodySchema.parse(validRegistration);
    assert.equal(result.email, 'maria@email.com');
    assert.equal(result.cpfCnpj, '52998224725');
    assert.equal(result.whatsapp, '81999999999');
    assert.equal(isValidCpfCnpj('11.222.333/0001-81'), true);
  });

  it('aceita CPF ou CNPJ alfanumérico válido e rejeita documento inválido', () => {
    assert.equal(isValidCpfCnpj('12ABC34501DE35'), true);
    assert.equal(isValidCpfCnpj('111.111.111-11'), false);
    assert.equal(isValidCpfCnpj('12ABC34501DE36'), false);
  });

  it('rejeita senha que não cumpra os requisitos de força', () => {
    for (const password of ['fraca123', 'SemNumero!', 'SemSimbolo123', 'Curta1!']) {
      assert.equal(registerBodySchema.safeParse({ ...validRegistration, password }).success, false);
    }
  });

  it('normaliza o e-mail de login e rejeita campos extras', () => {
    assert.equal(loginBodySchema.parse({ email: ' Maria@Email.com ', password: 'x' }).email, 'maria@email.com');
    assert.equal(loginBodySchema.safeParse({ ...validRegistration, role: 'ADMIN' }).success, false);
  });
});
