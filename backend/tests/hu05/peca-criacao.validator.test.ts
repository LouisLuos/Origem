import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TECHNIQUE_MAP, TIPOLOGIAS_HOMOLOGADAS } from '../../src/constants/taxonomy.js';
import { AppError } from '../../src/utils/AppError.js';
import { FOTOS_PECA_MAX, FOTO_PECA_MAX_BYTES } from '../../src/utils/fotoPeca.util.js';
import {
  MENSAGEM_FOTOS_MINIMAS,
  MENSAGEM_PESO_MINIMO,
  PECA_DADOS_INVALIDOS_CODE,
  validarCriacaoPeca,
} from '../../src/validators/peca.validator.js';
import { FOTO_JPEG, FOTO_PNG, JPEG_BYTES, PNG_BYTES, corpoPecaValido } from './fixtures.js';

function erroDe(input: unknown): AppError {
  try {
    validarCriacaoPeca(input);
  } catch (err) {
    assert.ok(err instanceof AppError);
    assert.equal(err.statusCode, 422);
    assert.equal(err.code, PECA_DADOS_INVALIDOS_CODE);
    return err;
  }
  assert.fail('esperado AppError 422');
}

function comCampo(campo: string, valor: unknown): Record<string, unknown> {
  return { ...corpoPecaValido(), [campo]: valor };
}

describe('HU-05 / T-PEC-02 — Validação de criação de peça (unitário)', () => {
  it('aceita peça válida, normaliza textos, decodifica fotos e define foto principal 0 por padrão', () => {
    const dados = validarCriacaoPeca({ ...corpoPecaValido(), titulo: '  Vaso  ', extra: 'ignorado', atelieId: 'forjado' });
    assert.equal(dados.titulo, 'Vaso');
    assert.equal(dados.isFragil, true);
    assert.equal(dados.indiceFotoPrincipal, 0);
    assert.equal(dados.fotos.length, 2);
    assert.deepEqual(dados.fotos[0]?.conteudo, JPEG_BYTES);
    assert.equal(dados.fotos[1]?.tipoMime, 'image/png');
    assert.equal('extra' in dados, false);
    assert.equal('atelieId' in dados, false);
  });

  it('reutiliza a regra de cubagem: peso 30g gera exatamente a mensagem oficial', () => {
    assert.equal(erroDe(comCampo('pesoGramas', 30)).message, MENSAGEM_PESO_MINIMO);
  });

  it('rejeita dimensões e preço inválidos (regras de cubagemPrecoFields)', () => {
    assert.match(erroDe(comCampo('alturaCm', 0)).message, /A altura deve ser maior que zero/);
    assert.match(erroDe(comCampo('preco', -1)).message, /O preço deve ser maior que zero/);
  });

  it('exige título e descrição não vazios e respeita os limites de tamanho', () => {
    assert.match(erroDe(comCampo('titulo', '   ')).message, /O título da peça é obrigatório/);
    assert.match(erroDe(comCampo('descricao', undefined)).message, /A descrição da peça é obrigatória/);
    assert.match(erroDe(comCampo('titulo', 'a'.repeat(151))).message, /no máximo 150 caracteres/);
  });

  it('aceita somente tipologias homologadas', () => {
    for (const tipologia of TIPOLOGIAS_HOMOLOGADAS) {
      assert.equal(validarCriacaoPeca(comCampo('tipologia', tipologia)).tipologia, tipologia);
    }
    // Compatibilidade com as técnicas do catálogo da IA (TECHNIQUE_MAP)
    for (const tecnicaDoCatalogo of Object.values(TECHNIQUE_MAP)) {
      assert.equal(validarCriacaoPeca(comCampo('tipologia', tecnicaDoCatalogo)).tipologia, tecnicaDoCatalogo);
    }
    for (const invalida of ['Plástico', '', undefined, 3]) {
      assert.match(erroDe(comCampo('tipologia', invalida)).message, /Tipologia não homologada/);
    }
  });

  it('exige isFragil booleano explícito e preserva o valor (Cenário 3)', () => {
    assert.equal(validarCriacaoPeca(comCampo('isFragil', false)).isFragil, false);
    assert.equal(validarCriacaoPeca(comCampo('isFragil', true)).isFragil, true);
    for (const invalido of [undefined, null, 'true', 1]) {
      assert.match(erroDe(comCampo('isFragil', invalido)).message, /Informe se a peça é frágil/);
    }
  });

  it('exige no mínimo 2 fotos', () => {
    for (const fotos of [undefined, null, [], [FOTO_JPEG], 'foto']) {
      assert.equal(erroDe(comCampo('fotos', fotos)).message, MENSAGEM_FOTOS_MINIMAS);
    }
  });

  it(`limita a ${FOTOS_PECA_MAX} fotos`, () => {
    const fotos = Array.from({ length: FOTOS_PECA_MAX + 1 }, () => FOTO_JPEG);
    assert.match(erroDe(comCampo('fotos', fotos)).message, /no máximo 5 fotos/);
  });

  it('rejeita formato não suportado, base64 inválido e conteúdo que não corresponde ao MIME', () => {
    assert.match(
      erroDe(comCampo('fotos', [FOTO_JPEG, { tipoMime: 'image/gif', conteudoBase64: 'R0lGOD==' }])).message,
      /Foto 2: formato não suportado/,
    );
    assert.match(
      erroDe(comCampo('fotos', [FOTO_JPEG, { tipoMime: 'image/png', conteudoBase64: 'não é base64!' }])).message,
      /Foto 2: conteúdo da imagem inválido/,
    );
    assert.match(
      erroDe(comCampo('fotos', [{ tipoMime: 'image/png', conteudoBase64: JPEG_BYTES.toString('base64') }, FOTO_PNG])).message,
      /Foto 1: o conteúdo não corresponde a uma imagem PNG válida/,
    );
    const textoDisfarcado = Buffer.from('<script>alert(1)</script>').toString('base64');
    assert.match(
      erroDe(comCampo('fotos', [FOTO_JPEG, { tipoMime: 'image/jpeg', conteudoBase64: textoDisfarcado }])).message,
      /Foto 2: o conteúdo não corresponde a uma imagem JPEG válida/,
    );
    assert.match(erroDe(comCampo('fotos', [FOTO_JPEG, 'foto'])).message, /Foto 2: formato de envio inválido/);
  });

  it('rejeita foto acima do tamanho máximo', () => {
    const grande = Buffer.alloc(FOTO_PECA_MAX_BYTES + 1);
    JPEG_BYTES.copy(grande);
    const foto = { tipoMime: 'image/jpeg', conteudoBase64: grande.toString('base64') };
    assert.match(erroDe(comCampo('fotos', [FOTO_JPEG, foto])).message, /Foto 2: excede o tamanho máximo de 5 MB/);
  });

  it('valida o índice da foto principal', () => {
    assert.equal(validarCriacaoPeca(comCampo('indiceFotoPrincipal', 1)).indiceFotoPrincipal, 1);
    assert.match(erroDe(comCampo('indiceFotoPrincipal', 2)).message, /não corresponde a nenhuma das fotos/);
    for (const invalido of [-1, 0.5, '1']) {
      assert.match(erroDe(comCampo('indiceFotoPrincipal', invalido)).message, /posição da foto/);
    }
  });

  it('acumula múltiplas violações em uma única resposta 422', () => {
    const erro = erroDe({ ...corpoPecaValido(), pesoGramas: 30, larguraCm: 0, fotos: [FOTO_JPEG] });
    assert.ok(erro.message.includes(MENSAGEM_PESO_MINIMO));
    assert.ok(erro.message.includes('A largura deve ser maior que zero.'));
    assert.ok(erro.message.includes(MENSAGEM_FOTOS_MINIMAS));
  });

  it('rejeita corpo que não é objeto', () => {
    for (const corpo of [null, [], 'peça']) {
      assert.match(erroDe(corpo).message, /objeto JSON/);
    }
  });
});
