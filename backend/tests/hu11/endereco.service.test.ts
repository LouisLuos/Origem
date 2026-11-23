import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import type {
  DadosEnderecoComprador,
  EnderecoComprador,
  EnderecoCompradorRepository,
} from '../../src/repositories/contracts/hu11.contracts.js';
import {
  createEnderecoCompradorService,
  LIMITE_ENDERECOS_COMPRADOR,
} from '../../src/services/enderecoComprador.service.js';
import { AppError } from '../../src/utils/AppError.js';

function repositorioEmMemoria(): EnderecoCompradorRepository {
  const porUsuario = new Map<string, EnderecoComprador[]>();
  const lista = (usuarioId: string) => porUsuario.get(usuarioId) ?? [];
  return {
    async listarPorUsuario(usuarioId) {
      return lista(usuarioId);
    },
    async criarRespeitandoLimite(usuarioId, dados, limite) {
      if (lista(usuarioId).length >= limite) return { status: 'LIMITE_ATINGIDO' };
      const endereco = { ...dados, id: randomUUID(), criadoEm: new Date().toISOString() };
      porUsuario.set(usuarioId, [...lista(usuarioId), endereco]);
      return { status: 'CRIADO', endereco };
    },
    async atualizar(usuarioId, enderecoId, dados) {
      const atual = lista(usuarioId).find((e) => e.id === enderecoId);
      if (!atual) return null;
      const atualizado = { ...atual, ...dados };
      porUsuario.set(usuarioId, lista(usuarioId).map((e) => (e.id === enderecoId ? atualizado : e)));
      return atualizado;
    },
    async remover(usuarioId, enderecoId) {
      const antes = lista(usuarioId);
      porUsuario.set(usuarioId, antes.filter((e) => e.id !== enderecoId));
      return antes.length !== lista(usuarioId).length;
    },
  };
}

const endereco: DadosEnderecoComprador = {
  cep: '50030230',
  logradouro: 'Rua da Aurora',
  numero: '100',
  bairro: 'Boa Vista',
  cidade: 'Recife',
  uf: 'PE',
};

const comprador = randomUUID();
const outroComprador = randomUUID();

describe('HU-11 · serviço do livro de endereços', () => {
  it('Cenário 3: aceita até 5 endereços e recusa o sexto pedindo remoção ou edição', async () => {
    const service = createEnderecoCompradorService(repositorioEmMemoria());
    for (let i = 0; i < LIMITE_ENDERECOS_COMPRADOR; i += 1) {
      await service.criar(comprador, { ...endereco, numero: String(i) });
    }

    await assert.rejects(
      service.criar(comprador, endereco),
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 422 &&
        err.code === 'LIMITE_ENDERECOS_ATINGIDO' &&
        /remova ou edite/i.test(err.message),
    );
    assert.equal((await service.listar(comprador)).length, LIMITE_ENDERECOS_COMPRADOR);
  });

  it('o limite é por comprador', async () => {
    const service = createEnderecoCompradorService(repositorioEmMemoria());
    for (let i = 0; i < LIMITE_ENDERECOS_COMPRADOR; i += 1) {
      await service.criar(comprador, endereco);
    }
    await service.criar(outroComprador, endereco);
    assert.equal((await service.listar(outroComprador)).length, 1);
  });

  it('não edita nem remove endereço de outro comprador (404)', async () => {
    const service = createEnderecoCompradorService(repositorioEmMemoria());
    const criado = await service.criar(comprador, endereco);

    await assert.rejects(
      service.atualizar(outroComprador, criado.id, { ...endereco, numero: '999' }),
      (err: unknown) => err instanceof AppError && err.statusCode === 404,
    );
    await assert.rejects(
      service.remover(outroComprador, criado.id),
      (err: unknown) => err instanceof AppError && err.statusCode === 404,
    );
    assert.equal((await service.listar(comprador))[0]?.numero, '100');
  });

  it('edita e remove o próprio endereço', async () => {
    const service = createEnderecoCompradorService(repositorioEmMemoria());
    const criado = await service.criar(comprador, endereco);

    const editado = await service.atualizar(comprador, criado.id, { ...endereco, numero: '200' });
    assert.equal(editado.numero, '200');

    await service.remover(comprador, criado.id);
    assert.deepEqual(await service.listar(comprador), []);
  });
});
