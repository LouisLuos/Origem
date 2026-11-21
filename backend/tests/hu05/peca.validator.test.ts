import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { AppError } from '../../src/utils/AppError.js';
import {
  MENSAGEM_PESO_MINIMO,
  PECA_VALIDACAO_FISICA_CODE,
  validarCubagemEPreco,
} from '../../src/validators/peca.validator.js';

const PECA_VALIDA = {
  pesoGramas: 850,
  comprimentoCm: 30,
  larguraCm: 20,
  alturaCm: 25,
  preco: 189.9,
};

/** Executa a validação e devolve o `AppError` lançado (falha o teste se nada for lançado). */
function capturarErro(input: unknown): AppError {
  try {
    validarCubagemEPreco(input);
  } catch (err) {
    assert.ok(err instanceof AppError, 'esperado AppError');
    return err;
  }
  assert.fail('esperado AppError, mas a validação foi aceita');
}

function assertRejeitado422(input: unknown, trechoMensagem?: string): AppError {
  const erro = capturarErro(input);
  assert.equal(erro.statusCode, 422);
  assert.equal(erro.code, PECA_VALIDACAO_FISICA_CODE);
  if (trechoMensagem) {
    assert.ok(
      erro.message.includes(trechoMensagem),
      `mensagem "${erro.message}" deveria conter "${trechoMensagem}"`,
    );
  }
  return erro;
}

const VALORES_NAO_NUMERICOS: unknown[] = ['50', '', 'abc', true, {}, [], NaN, Infinity, -Infinity];

describe('HU-05 / T-PEC-02 (etapa 1) — Peso embalado (unitário)', () => {
  it('[1] rejeita 30g com 422 e exatamente a mensagem oficial', () => {
    const erro = assertRejeitado422({ ...PECA_VALIDA, pesoGramas: 30 });
    assert.equal(erro.message, MENSAGEM_PESO_MINIMO);
    assert.equal(erro.message, 'O peso mínimo embalado para cotação de frete é 50g');
  });

  it('[2] rejeita 49g e 49.99g', () => {
    for (const peso of [49, 49.99]) {
      const erro = assertRejeitado422({ ...PECA_VALIDA, pesoGramas: peso });
      assert.equal(erro.message, MENSAGEM_PESO_MINIMO);
    }
  });

  it('[3] aceita exatamente 50g (limite inclusivo)', () => {
    assert.equal(validarCubagemEPreco({ ...PECA_VALIDA, pesoGramas: 50 }).pesoGramas, 50);
  });

  it('[4] aceita peso superior a 50g', () => {
    for (const peso of [51, 850, 12000]) {
      assert.equal(validarCubagemEPreco({ ...PECA_VALIDA, pesoGramas: peso }).pesoGramas, peso);
    }
  });

  it('rejeita peso zero ou negativo com a mensagem oficial', () => {
    for (const peso of [0, -0, -10]) {
      const erro = assertRejeitado422({ ...PECA_VALIDA, pesoGramas: peso });
      assert.equal(erro.message, MENSAGEM_PESO_MINIMO);
    }
  });

  it('rejeita peso não numérico ou não finito com 422 (sem coerção de string)', () => {
    for (const peso of VALORES_NAO_NUMERICOS) {
      assertRejeitado422(
        { ...PECA_VALIDA, pesoGramas: peso },
        'O peso embalado deve ser um número válido em gramas.',
      );
    }
  });
});

describe('HU-05 / T-PEC-02 (etapa 1) — Dimensões físicas (unitário)', () => {
  const dimensoes = [
    { campo: 'comprimentoCm', rotulo: 'O comprimento' },
    { campo: 'larguraCm', rotulo: 'A largura' },
    { campo: 'alturaCm', rotulo: 'A altura' },
  ] as const;

  for (const { campo, rotulo } of dimensoes) {
    it(`[5-7] rejeita ${campo} igual a zero com 422`, () => {
      assertRejeitado422({ ...PECA_VALIDA, [campo]: 0 }, `${rotulo} deve ser maior que zero.`);
    });

    it(`[8] rejeita ${campo} negativo com 422`, () => {
      for (const valor of [-1, -0.01]) {
        assertRejeitado422({ ...PECA_VALIDA, [campo]: valor }, `${rotulo} deve ser maior que zero.`);
      }
    });

    it(`rejeita ${campo} não numérico ou não finito com 422`, () => {
      for (const valor of VALORES_NAO_NUMERICOS) {
        assertRejeitado422(
          { ...PECA_VALIDA, [campo]: valor },
          `${rotulo} deve ser um número válido em centímetros.`,
        );
      }
    });
  }

  it('[9] aceita dimensões positivas inteiras', () => {
    const resultado = validarCubagemEPreco({
      ...PECA_VALIDA,
      comprimentoCm: 10,
      larguraCm: 1,
      alturaCm: 10,
    });
    assert.equal(resultado.comprimentoCm, 10);
    assert.equal(resultado.larguraCm, 1);
    assert.equal(resultado.alturaCm, 10);
  });

  it('rejeita dimensões fracionárias (colunas int em centímetros)', () => {
    assertRejeitado422({ ...PECA_VALIDA, larguraCm: 0.5 }, 'A largura deve ser informado(a) em centímetros inteiros.');
    assertRejeitado422({ ...PECA_VALIDA, alturaCm: 25.5 }, 'A altura deve ser informado(a) em centímetros inteiros.');
  });

  it('acumula as violações de todas as dimensões em uma única resposta', () => {
    const erro = assertRejeitado422({ ...PECA_VALIDA, comprimentoCm: 0, larguraCm: -2, alturaCm: 0 });
    assert.equal(
      erro.message,
      'O comprimento deve ser maior que zero.; A largura deve ser maior que zero.; A altura deve ser maior que zero.',
    );
  });
});

describe('HU-05 / T-PEC-02 (etapa 1) — Preço (unitário)', () => {
  it('[10] rejeita preço igual a zero com 422', () => {
    assertRejeitado422({ ...PECA_VALIDA, preco: 0 }, 'O preço deve ser maior que zero.');
  });

  it('[11] rejeita preço negativo com 422', () => {
    assertRejeitado422({ ...PECA_VALIDA, preco: -15 }, 'O preço deve ser maior que zero.');
  });

  it('rejeita peso fracionário acima do mínimo (coluna int em gramas)', () => {
    assertRejeitado422({ ...PECA_VALIDA, pesoGramas: 50.5 }, 'O peso embalado deve ser informado em gramas inteiros.');
  });

  it('rejeita preço com mais de duas casas decimais ou acima do máximo de decimal(10,2)', () => {
    assertRejeitado422({ ...PECA_VALIDA, preco: 10.999 }, 'O preço deve ter no máximo duas casas decimais.');
    assertRejeitado422({ ...PECA_VALIDA, preco: 100_000_000 }, 'O preço excede o valor máximo permitido.');
  });

  it('[12] aceita preço positivo', () => {
    for (const preco of [0.01, 1, 189.9]) {
      assert.equal(validarCubagemEPreco({ ...PECA_VALIDA, preco }).preco, preco);
    }
  });

  it('rejeita preço não numérico ou não finito com 422', () => {
    for (const preco of VALORES_NAO_NUMERICOS) {
      assertRejeitado422({ ...PECA_VALIDA, preco }, 'O preço deve ser um número válido.');
    }
  });
});

describe('HU-05 / T-PEC-02 (etapa 1) — Campos obrigatórios e estrutura (unitário)', () => {
  const obrigatorios = [
    { campo: 'pesoGramas', mensagem: 'O peso embalado é obrigatório.' },
    { campo: 'comprimentoCm', mensagem: 'O comprimento é obrigatório(a).' },
    { campo: 'larguraCm', mensagem: 'A largura é obrigatório(a).' },
    { campo: 'alturaCm', mensagem: 'A altura é obrigatório(a).' },
    { campo: 'preco', mensagem: 'O preço é obrigatório.' },
  ] as const;

  for (const { campo, mensagem } of obrigatorios) {
    it(`[13] rejeita ${campo} ausente ou null com 422`, () => {
      const semCampo: Record<string, unknown> = { ...PECA_VALIDA };
      delete semCampo[campo];
      assertRejeitado422(semCampo, mensagem);
      assertRejeitado422({ ...PECA_VALIDA, [campo]: null }, mensagem);
    });
  }

  it('[13] rejeita objeto vazio listando todos os campos obrigatórios', () => {
    const erro = assertRejeitado422({});
    for (const { mensagem } of obrigatorios) {
      assert.ok(erro.message.includes(mensagem), `faltou: ${mensagem}`);
    }
  });

  it('rejeita corpo que não é objeto (undefined, null, array, texto) com 422', () => {
    for (const corpo of [undefined, null, [], 'peça', 42]) {
      assertRejeitado422(corpo, 'Os dados da peça devem ser enviados como um objeto JSON.');
    }
  });

  it('aceita peça válida e descarta campos fora do escopo desta etapa', () => {
    const resultado = validarCubagemEPreco({
      ...PECA_VALIDA,
      atelieId: 'forjado-pelo-cliente',
      status: 'VENDIDA',
    });
    assert.deepEqual(resultado, PECA_VALIDA);
  });
});

/**
 * Integração com o middleware global de erros SEM endpoint real de peças: uma rota descartável,
 * criada só neste teste, chama o validador. Comprova que `errorHandler` (não modificado)
 * serializa a violação como HTTP 422. Não comprova que a API de produção responda 422,
 * pois a rota de cadastro de peças ainda não existe.
 */
describe('HU-05 / T-PEC-02 (etapa 1) — Integração validador + errorHandler (rota de teste)', () => {
  async function comServidorDeTeste(
    executar: (baseUrl: string) => Promise<void>,
  ): Promise<void> {
    const app = express();
    app.use(express.json());
    app.post('/teste/cubagem', (req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(200).json(validarCubagemEPreco(req.body));
      } catch (err) {
        next(err);
      }
    });
    app.use((err: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(err, req, res, next),
    );

    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const endereco = server.address();
    assert.ok(endereco && typeof endereco === 'object');
    try {
      await executar(`http://127.0.0.1:${endereco.port}`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  async function postar(baseUrl: string, corpo: unknown) {
    const res = await fetch(`${baseUrl}/teste/cubagem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it('responde 422 com { erro, codigo } para peso 30g e altura 0 (cenários 4A/4B do TC04)', async () => {
    await comServidorDeTeste(async (baseUrl) => {
      const peso = await postar(baseUrl, { ...PECA_VALIDA, pesoGramas: 30 });
      assert.equal(peso.status, 422);
      assert.deepEqual(peso.body, { erro: MENSAGEM_PESO_MINIMO, codigo: PECA_VALIDACAO_FISICA_CODE });

      const altura = await postar(baseUrl, { ...PECA_VALIDA, alturaCm: 0 });
      assert.equal(altura.status, 422);
      assert.deepEqual(altura.body, {
        erro: 'A altura deve ser maior que zero.',
        codigo: PECA_VALIDACAO_FISICA_CODE,
      });
    });
  });

  it('responde 200 para cubagem válida no limite (50g, 10x10x10cm)', async () => {
    await comServidorDeTeste(async (baseUrl) => {
      const corpo = { pesoGramas: 50, comprimentoCm: 10, larguraCm: 10, alturaCm: 10, preco: 120 };
      const ok = await postar(baseUrl, corpo);
      assert.equal(ok.status, 200);
      assert.deepEqual(ok.body, corpo);
    });
  });
});
