import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../../src/utils/AppError.js';
import {
  PIX_EMAIL_MAX_LENGTH,
  detectPixKeyType,
  maskPixKey,
  normalizePixKey,
  validateAndNormalizePixKey,
  validatePixKeyFormat,
} from '../../src/utils/pixKey.util.js';

describe('Etapa C2 — Validação e normalização Pix (CPF)', () => {
  it('aceita e normaliza CPFs válidos com e sem formatação (incluindo resto 10 -> 0)', () => {
    const res1 = validateAndNormalizePixKey('529.982.247-25');
    assert.equal(res1.type, 'CPF');
    assert.equal(res1.normalizedValue, '52998224725');
    assert.equal(res1.maskedValue, '***.982.247-**');
    assert.equal(res1.dictVerificationStatus, 'NAO_VERIFICADA_LOCALMENTE');

    const res2 = validateAndNormalizePixKey(' 12345678909 ');
    assert.equal(res2.type, 'CPF');
    assert.equal(res2.normalizedValue, '12345678909');
    assert.equal(detectPixKeyType('11144477735'), 'CPF');
  });

  it('rejeita CPFs inválidos (DVs incorretos, dígitos repetidos, máscara incorreta e tamanho)', () => {
    const invalids = [
      '52998224715', // DV1 incorreto
      '52998224726', // DV2 incorreto
      '00000000000',
      '11111111111',
      '999.999.999-99',
      '529/982.247-25',
      '5299822472',
      '529982247250',
      '5299822472a',
    ];

    for (const candidate of invalids) {
      assert.equal(validatePixKeyFormat(candidate, 'CPF').valid, false);
      assert.equal(detectPixKeyType(candidate), null);
      assert.throws(() => normalizePixKey(candidate, 'CPF'), AppError);
    }
  });
});

describe('Etapa C2 — Validação e normalização Pix (E-mail DICT)', () => {
  it('aceita e normaliza e-mails válidos dentro do limite de 77 caracteres', () => {
    const exact77 = `${'a'.repeat(64)}@origem.pe.br`;
    assert.equal(exact77.length, PIX_EMAIL_MAX_LENGTH);

    const r1 = validateAndNormalizePixKey('  Artesao.Mestre+Pe@Origem.COM.BR ');
    assert.equal(r1.type, 'EMAIL');
    assert.equal(r1.normalizedValue, 'artesao.mestre+pe@origem.com.br');
    assert.equal(r1.maskedValue, 'ar***@origem.com.br');

    const r77 = validateAndNormalizePixKey(exact77);
    assert.equal(r77.type, 'EMAIL');
    assert.equal(r77.normalizedValue, exact77);

    // Local part curto (<= 2 chars) revela apenas 1 char
    assert.equal(maskPixKey('ab@origem.pe', 'EMAIL'), 'a***@origem.pe');
    assert.equal(maskPixKey('a@origem.pe', 'EMAIL'), 'a***@origem.pe');
  });

  it('rejeita e-mails acima de 77 caracteres ou sintaticamente inválidos', () => {
    const over77 = `${'a'.repeat(64)}@origemm.pe.br`;
    assert.equal(over77.length, 78);

    const local65 = `${'a'.repeat(65)}@a.co`;
    const invalids = [
      over77,
      local65,
      'sem-arroba.com',
      '.inicio@origem.com',
      'fim.@origem.com',
      'duplo..ponto@origem.com',
      'usuario@localhost',
      'usuario@sub..origem.com',
      'usuario@-origem.com',
      'com espaco@origem.com',
      'a@b.c',
    ];

    for (const candidate of invalids) {
      assert.equal(validatePixKeyFormat(candidate, 'EMAIL').valid, false);
      assert.equal(detectPixKeyType(candidate), null);
    }
  });
});

describe('Etapa C2 — Validação e normalização Pix (Celular E.164 BR)', () => {
  it('aceita e normaliza celular brasileiro E.164 (+55 + DDD válido + 9 dígitos)', () => {
    const r1 = validateAndNormalizePixKey('+5581999998888');
    assert.equal(r1.type, 'TELEFONE');
    assert.equal(r1.normalizedValue, '+5581999998888');
    assert.equal(r1.maskedValue, '+5581*****8888');

    const r2 = validateAndNormalizePixKey(' +55 (87) 98765-4321 ');
    assert.equal(r2.type, 'TELEFONE');
    assert.equal(r2.normalizedValue, '+5587987654321');
    assert.equal(detectPixKeyType('+5511912345678'), 'TELEFONE');
  });

  it('rejeita celulares fora do padrão E.164 BR, DDD inválido ou sem o nono dígito', () => {
    const invalids = [
      '81999998888', // Sem +55 (evita ambiguidade com CPF)
      '5581999998888', // Sem '+'
      '+14155552671', // Código internacional não brasileiro
      '+558188887777', // Telefone fixo / sem dígito 9
      '+5500999998888', // DDD 00 inexistente
      '+5520999998888', // DDD 20 inexistente na ANATEL
      '+558199999888', // Faltando dígito
      '+55819999988889', // Dígito extra
    ];

    for (const candidate of invalids) {
      assert.equal(validatePixKeyFormat(candidate, 'TELEFONE').valid, false);
      assert.equal(detectPixKeyType(candidate), null);
    }
  });
});

describe('Etapa C2 — Validação e normalização Pix (EVP UUID v4)', () => {
  it('aceita e normaliza UUID v4 válido para minúsculas e mascara corretamente', () => {
    const evpUpper = '550E8400-E29B-41D4-A716-446655440000';
    const res = validateAndNormalizePixKey(evpUpper);
    assert.equal(res.type, 'EVP');
    assert.equal(res.normalizedValue, '550e8400-e29b-41d4-a716-446655440000');
    assert.equal(res.maskedValue, '550e8400-****-****-****-********0000');
    assert.equal(detectPixKeyType(evpUpper), 'EVP');
  });

  it('rejeita UUIDs que não sejam v4 RFC 4122 (nil, v1, variante inválida ou corrompido)', () => {
    const invalids = [
      '00000000-0000-0000-0000-000000000000', // Nil UUID
      '550e8400-e29b-11d4-a716-446655440000', // Versão 1
      '550e8400-e29b-41d4-c716-446655440000', // Variante C inválida
      '550e8400-e29b-41d4-a716-44665544000', // Curto
      '550e8400e29b41d4a716446655440000', // Sem hífens
    ];

    for (const candidate of invalids) {
      assert.equal(validatePixKeyFormat(candidate, 'EVP').valid, false);
      assert.equal(detectPixKeyType(candidate), null);
    }
  });
});

describe('Etapa C2 — Conflito de tipo esperado e casos limítrofes', () => {
  it('rejeita quando expectedType diverge do formato fornecido', () => {
    assert.equal(validatePixKeyFormat('52998224725', 'TELEFONE').valid, false);
    assert.equal(validatePixKeyFormat('artesao@origem.com', 'CPF').valid, false);
    assert.throws(() => validateAndNormalizePixKey('artesao@origem.com', 'EVP'), AppError);
  });

  it('rejeita entradas vazias ou não reconhecidas com AppError 400', () => {
    assert.equal(validatePixKeyFormat('').valid, false);
    assert.equal(validatePixKeyFormat('   ').valid, false);
    assert.equal(validatePixKeyFormat('chave-qualquer-invalida').valid, false);

    assert.throws(
      () => validateAndNormalizePixKey('   '),
      (err: unknown) => err instanceof AppError && err.statusCode === 400,
    );
  });
});
