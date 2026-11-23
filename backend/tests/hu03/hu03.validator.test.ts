import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BIOGRAFIA_MAX_LENGTH,
  BIOGRAFIA_MIN_LENGTH,
  associarCuradorBodySchema,
  atelieIdParamSchema,
  atualizarChavePixBodySchema,
  curadorVinculoParamsSchema,
  habilitarArtesaoBodySchema,
} from '../../src/validators/hu03.validator.js';

const VALID_BIO = 'Ceramista do Alto do Moura há 25 anos produzindo bonecos figurativos.';

describe('Etapa C2 — Schemas Zod de habilitação de artesão titular', () => {
  it('valida, normaliza e descarta campos extras contra mass assignment', () => {
    const parsed = habilitarArtesaoBodySchema.safeParse({
      biografiaCultural: `  ${VALID_BIO}  `,
      chavePix: '529.982.247-25',
      role: 'ADMIN',
      usuarioId: 'forjado-pelo-cliente',
      ehTitular: true,
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.deepEqual(parsed.data, {
        biografiaCultural: VALID_BIO,
        tipoChavePix: 'CPF',
        chavePixNormalizada: '52998224725',
        chavePixMascarada: '***.982.247-**',
        verificacaoDict: 'NAO_VERIFICADA_LOCALMENTE',
      });
      assert.equal('role' in parsed.data, false);
      assert.equal('usuarioId' in parsed.data, false);
      assert.equal('ehTitular' in parsed.data, false);
    }
  });

  it('rejeita biografia ausente, vazia, curta (<20), longa (>2000) ou não-string', () => {
    const invalidBios: Array<unknown> = [
      undefined,
      '',
      '   ',
      12345,
      'a'.repeat(BIOGRAFIA_MIN_LENGTH - 1),
      'a'.repeat(BIOGRAFIA_MAX_LENGTH + 1),
    ];

    for (const bio of invalidBios) {
      const res = habilitarArtesaoBodySchema.safeParse({
        biografiaCultural: bio,
        chavePix: '52998224725',
      });
      assert.equal(res.success, false);
    }
  });

  it('rejeita chave Pix ausente, inválida ou conflitante com tipoChavePix', () => {
    assert.equal(
      habilitarArtesaoBodySchema.safeParse({ biografiaCultural: VALID_BIO }).success,
      false,
    );
    assert.equal(
      habilitarArtesaoBodySchema.safeParse({
        biografiaCultural: VALID_BIO,
        chavePix: '11111111111',
      }).success,
      false,
    );
    assert.equal(
      habilitarArtesaoBodySchema.safeParse({
        biografiaCultural: VALID_BIO,
        chavePix: '52998224725',
        tipoChavePix: 'EMAIL',
      }).success,
      false,
    );
    assert.equal(
      habilitarArtesaoBodySchema.safeParse({
        biografiaCultural: VALID_BIO,
        chavePix: '52998224725',
        tipoChavePix: 'CNPJ_INEXISTENTE',
      }).success,
      false,
    );
  });
});

describe('Etapa C2 — Schemas Zod (Chave Pix, Curadores e Params)', () => {
  it('atualizarChavePixBodySchema aceita todos os 4 formatos válidos e normaliza', () => {
    const phone = atualizarChavePixBodySchema.safeParse({
      chavePix: '+55 (81) 99999-8888',
      tipoChavePix: 'TELEFONE',
    });
    assert.equal(phone.success, true);
    if (phone.success) {
      assert.equal(phone.data.chavePixNormalizada, '+5581999998888');
      assert.equal(phone.data.tipoChavePix, 'TELEFONE');
    }

    const evp = atualizarChavePixBodySchema.safeParse({
      chavePix: '550E8400-E29B-41D4-A716-446655440000',
    });
    assert.equal(evp.success, true);
    if (evp.success) {
      assert.equal(evp.data.chavePixNormalizada, '550e8400-e29b-41d4-a716-446655440000');
      assert.equal(evp.data.tipoChavePix, 'EVP');
    }
  });

  it('associarCuradorBodySchema normaliza e-mail e rejeita formatos inválidos', () => {
    const ok = associarCuradorBodySchema.safeParse({ email: '  Curador.Atelie@Origem.COM ' });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.deepEqual(ok.data, { email: 'curador.atelie@origem.com' });
    }

    for (const badEmail of [undefined, '', '   ', 123, 'sem-arroba', 'a@b']) {
      assert.equal(associarCuradorBodySchema.safeParse({ email: badEmail }).success, false);
    }
  });

  it('schemas de parâmetros aceitam IDs válidos com trim e rejeitam vazios ou excessivos', () => {
    const p1 = atelieIdParamSchema.safeParse({ atelieId: '  atelie-01  ' });
    assert.equal(p1.success, true);
    if (p1.success) {
      assert.equal(p1.data.atelieId, 'atelie-01');
    }

    const p2 = curadorVinculoParamsSchema.safeParse({
      atelieId: 'atelie-01',
      curadorUsuarioId: '550e8400-e29b-41d4-a716-446655440000',
    });
    assert.equal(p2.success, true);

    assert.equal(atelieIdParamSchema.safeParse({ atelieId: '   ' }).success, false);
    assert.equal(atelieIdParamSchema.safeParse({ atelieId: 'a'.repeat(101) }).success, false);
    assert.equal(
      curadorVinculoParamsSchema.safeParse({ atelieId: 'a1', curadorUsuarioId: '' }).success,
      false,
    );
  });
});
