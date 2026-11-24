import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  AtelieCadastroRepository,
  AteliePersistido,
  CriarAtelieComEnderecoInput,
} from '../../src/repositories/contracts/hu04.contracts.js';
import { MENSAGEM_ATELIE_DUPLICADO } from '../../src/repositories/prismaAtelie.repository.js';
import { createAtelieCadastroService } from '../../src/services/atelieCadastro.service.js';
import { AppError } from '../../src/utils/AppError.js';

const dados = {
  nomeComercial: 'Ateliê Maria',
  poloCultural: 'Tracunhaém' as const,
  endereco: {
    cep: '55860000',
    logradouro: 'Rua das Rendeiras',
    numero: '123',
    bairro: 'Centro',
    cidade: 'Tracunhaém',
    uf: 'PE',
  },
};

function createRepository(options: {
  artesaoId?: string;
  alreadyExists?: boolean;
  persistError?: AppError;
} = {}): AtelieCadastroRepository & { persisted?: CriarAtelieComEnderecoInput } {
  const repository: AtelieCadastroRepository & { persisted?: CriarAtelieComEnderecoInput } = {
    async findArtesaoIdPorUsuarioId() {
      return options.artesaoId ?? null;
    },
    async existeAteliePorArtesaoId() {
      return options.alreadyExists ?? false;
    },
    async criarAtelieComEndereco(input) {
      if (options.persistError) throw options.persistError;
      repository.persisted = input;
      const persisted: AteliePersistido = {
        id: '6d3d0ab6-bc4e-4e0e-b88f-9f9b4e91db4b',
        artesaoId: input.artesaoId,
        nomeComercial: input.nomeComercial,
        poloCultural: input.poloCultural,
        status: 'ATIVO',
        endereco: input.endereco,
        criadoEm: '2026-11-22T12:00:00.000Z',
      };
      return persisted;
    },
    async findAteliePorIdEUsuarioId() {
      return options.alreadyExists
        ? {
            id: '6d3d0ab6-bc4e-4e0e-b88f-9f9b4e91db4b',
            artesaoId: 'artesao-1',
            nomeComercial: dados.nomeComercial,
            poloCultural: dados.poloCultural,
            status: 'ATIVO',
            endereco: dados.endereco,
            criadoEm: '2026-11-22T12:00:00.000Z',
          }
        : null;
    },
    async atualizarAtelieComEndereco(atelieId, _usuarioId, input) {
      if (!options.alreadyExists) return null;
      return {
        id: atelieId,
        artesaoId: 'artesao-1',
        nomeComercial: input.nomeComercial,
        poloCultural: input.poloCultural,
        status: 'ATIVO',
        endereco: input.endereco,
        criadoEm: '2026-11-22T12:00:00.000Z',
      };
    },
  };
  return repository;
}

describe('serviço de cadastro do ateliê', () => {
  it('rejeita usuário sem perfil de artesão titular habilitado', async () => {
    const service = createAtelieCadastroService(createRepository());
    await assert.rejects(service.criar('user-1', dados), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      return true;
    });
  });

  it('rejeita segundo ateliê ativo com HTTP 422', async () => {
    const service = createAtelieCadastroService(createRepository({
      artesaoId: 'artesao-1',
      alreadyExists: true,
    }));

    await assert.rejects(service.criar('user-1', dados), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 422);
      assert.equal(error.message, MENSAGEM_ATELIE_DUPLICADO);
      return true;
    });
  });

  it('persiste ateliê e endereço como uma única entrada de negócio', async () => {
    const repository = createRepository({ artesaoId: 'artesao-1' });
    const service = createAtelieCadastroService(repository);

    const result = await service.criar('user-1', dados);
    assert.equal(result.status, 'ATIVO');
    assert.equal(repository.persisted?.artesaoId, 'artesao-1');
    assert.equal(repository.persisted?.endereco.uf, 'PE');
  });

  it('consulta os dados existentes do ateliê pelo titular', async () => {
    const service = createAtelieCadastroService(createRepository({ alreadyExists: true }));
    const result = await service.consultar('6d3d0ab6-bc4e-4e0e-b88f-9f9b4e91db4b', 'user-1');
    assert.equal(result.nomeComercial, 'Ateliê Maria');
    assert.equal(result.endereco.cep, '55860000');
  });

  it('atualiza dados do ateliê, endereço e polo', async () => {
    const service = createAtelieCadastroService(createRepository({ alreadyExists: true }));
    const result = await service.atualizar(
      '6d3d0ab6-bc4e-4e0e-b88f-9f9b4e91db4b',
      'user-1',
      { ...dados, nomeComercial: 'Ateliê Novo', poloCultural: 'Caruaru' },
    );
    assert.equal(result.nomeComercial, 'Ateliê Novo');
    assert.equal(result.poloCultural, 'Caruaru');
  });

  it('não permite consultar ou atualizar ateliê de outro usuário', async () => {
    const service = createAtelieCadastroService(createRepository());
    await assert.rejects(
      service.consultar('6d3d0ab6-bc4e-4e0e-b88f-9f9b4e91db4b', 'user-2'),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
    await assert.rejects(
      service.atualizar('6d3d0ab6-bc4e-4e0e-b88f-9f9b4e91db4b', 'user-2', dados),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });
});
