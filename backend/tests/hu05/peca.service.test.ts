import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ArmazenamentoFotosPeca,
  CriarPecaPersistenciaInput,
  PecaRepository,
  ProcessadorImagemPeca,
} from '../../src/repositories/contracts/pecas.contracts.js';
import { HU05_ERROR_CODES } from '../../src/repositories/unconfiguredPecas.repository.js';
import { createPecaService } from '../../src/services/peca.service.js';
import { AppError } from '../../src/utils/AppError.js';
import { validarCriacaoPeca } from '../../src/validators/peca.validator.js';
import { corpoPecaValido } from './fixtures.js';

interface Registro {
  readonly eventos: string[];
  readonly salvos: string[];
  readonly removidos: string[];
  persistido?: CriarPecaPersistenciaInput;
}

/** Dublês em memória — uso exclusivo nos testes. */
function criarDubles(opcoes: { falharArmazenamentoNa?: number; falharRepositorio?: boolean } = {}) {
  const registro: Registro = { eventos: [], salvos: [], removidos: [] };

  const processadorImagem: ProcessadorImagemPeca = {
    async otimizar({ conteudo }) {
      registro.eventos.push('otimizar');
      return { conteudo, tipoMime: 'image/webp', extensao: 'webp' };
    },
  };

  const armazenamento: ArmazenamentoFotosPeca = {
    async salvar({ atelieId, extensao }) {
      registro.eventos.push('salvar');
      const ordem = registro.salvos.length + 1;
      if (opcoes.falharArmazenamentoNa === ordem) {
        throw new AppError('Falha simulada no storage.', 502);
      }
      const caminho = `${atelieId}/foto-${ordem}.${extensao}`;
      registro.salvos.push(caminho);
      return { url: `https://storage.test/${caminho}`, caminho };
    },
    async remover(caminhos) {
      registro.eventos.push('remover');
      registro.removidos.push(...caminhos);
    },
  };

  const repository: PecaRepository = {
    async criarComFotos(dados) {
      registro.eventos.push('persistir');
      if (opcoes.falharRepositorio) {
        throw new AppError('Falha simulada no banco.', 500);
      }
      registro.persistido = dados;
      return {
        id: 'peca-1',
        atelieId: dados.atelieId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        tipologia: dados.tipologia,
        preco: dados.preco,
        pesoGramas: dados.pesoGramas,
        comprimentoCm: dados.comprimentoCm,
        larguraCm: dados.larguraCm,
        alturaCm: dados.alturaCm,
        isFragil: dados.isFragil,
        status: dados.status,
        fotos: dados.fotos.map((foto, index) => ({ id: `foto-${index + 1}`, url: foto.url, isPrincipal: foto.isPrincipal })),
      };
    },
  };

  return { registro, service: createPecaService({ processadorImagem, armazenamento, repository }) };
}

describe('HU-05 / T-PEC-02 e T-PEC-03 — PecaService (unitário com dublês)', () => {
  it('Cenário 1: publica com status DISPONIVEL e associa as URLs otimizadas, marcando a foto principal', async () => {
    const { registro, service } = criarDubles();
    const dados = validarCriacaoPeca({ ...corpoPecaValido(), indiceFotoPrincipal: 1 });

    const peca = await service.criar('atelie-a', dados);

    assert.equal(peca.status, 'DISPONIVEL');
    assert.equal(peca.atelieId, 'atelie-a');
    assert.deepEqual(
      peca.fotos.map((foto) => [foto.url, foto.isPrincipal]),
      [
        ['https://storage.test/atelie-a/foto-1.webp', false],
        ['https://storage.test/atelie-a/foto-2.webp', true],
      ],
    );
    assert.deepEqual(registro.eventos, ['otimizar', 'otimizar', 'salvar', 'salvar', 'persistir']);
    assert.equal(registro.persistido?.status, 'DISPONIVEL');
  });

  it('Cenário 3: persiste isFragil = true para o seguro de carga', async () => {
    const { registro, service } = criarDubles();
    await service.criar('atelie-a', validarCriacaoPeca({ ...corpoPecaValido(), isFragil: true }));
    assert.equal(registro.persistido?.isFragil, true);
  });

  it('remove as fotos já armazenadas quando o armazenamento falha no meio do envio', async () => {
    const { registro, service } = criarDubles({ falharArmazenamentoNa: 2 });
    await assert.rejects(service.criar('atelie-a', validarCriacaoPeca(corpoPecaValido())), /Falha simulada no storage/);
    assert.deepEqual(registro.removidos, ['atelie-a/foto-1.webp']);
    assert.equal(registro.eventos.includes('persistir'), false);
  });

  it('remove todas as fotos armazenadas quando a persistência falha (compensação)', async () => {
    const { registro, service } = criarDubles({ falharRepositorio: true });
    await assert.rejects(service.criar('atelie-a', validarCriacaoPeca(corpoPecaValido())), /Falha simulada no banco/);
    assert.deepEqual(registro.removidos, ['atelie-a/foto-1.webp', 'atelie-a/foto-2.webp']);
  });

  it('sem configuração, falha fechado com 503 antes de qualquer gravação (nada é simulado)', async () => {
    const service = createPecaService();
    await assert.rejects(service.criar('atelie-a', validarCriacaoPeca(corpoPecaValido())), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.statusCode, 503);
      assert.equal(err.code, HU05_ERROR_CODES.PROCESSAMENTO_IMAGEM_INDISPONIVEL);
      return true;
    });
  });

  it('com processamento configurado mas Storage não configurado, falha com 503 de armazenamento', async () => {
    const { registro } = criarDubles();
    const service = createPecaService({
      processadorImagem: { async otimizar({ conteudo }) { registro.eventos.push('otimizar'); return { conteudo, tipoMime: 'image/webp', extensao: 'webp' }; } },
    });
    await assert.rejects(service.criar('atelie-a', validarCriacaoPeca(corpoPecaValido())), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.statusCode, 503);
      assert.equal(err.code, HU05_ERROR_CODES.ARMAZENAMENTO_INDISPONIVEL);
      return true;
    });
  });
});
