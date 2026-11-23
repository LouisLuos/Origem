import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import type { EnderecoComprador } from '../../src/repositories/contracts/hu11.contracts.js';
import { createEnderecoRoutes } from '../../src/routes/endereco.routes.js';
import type { EnderecoCompradorService } from '../../src/services/enderecoComprador.service.js';
import { AppError } from '../../src/utils/AppError.js';

const USUARIO_ID = '3f0e7a1c-6b2d-4d8e-9a51-2c7f4b9e1d10';
const ENDERECO_ID = '9b1d2c3e-4f5a-4b6c-8d7e-0f1a2b3c4d5e';

const enderecoSalvo: EnderecoComprador = {
  id: ENDERECO_ID,
  cep: '50030230',
  logradouro: 'Rua da Aurora',
  numero: '100',
  bairro: 'Boa Vista',
  cidade: 'Recife',
  uf: 'PE',
  criadoEm: '2026-11-24T12:00:00.000Z',
};

const chamadas: Array<{ metodo: string; usuarioId: string; enderecoId?: string }> = [];

const service: EnderecoCompradorService = {
  async listar(usuarioId) {
    chamadas.push({ metodo: 'listar', usuarioId });
    return [enderecoSalvo];
  },
  async criar(usuarioId, dados) {
    chamadas.push({ metodo: 'criar', usuarioId });
    if (dados.numero === 'sexto') {
      throw new AppError('Limite atingido.', 422, 'LIMITE_ENDERECOS_ATINGIDO');
    }
    return { ...enderecoSalvo, ...dados };
  },
  async atualizar(usuarioId, enderecoId, dados) {
    chamadas.push({ metodo: 'atualizar', usuarioId, enderecoId });
    if (enderecoId !== ENDERECO_ID) throw new AppError('Endereço não encontrado.', 404);
    return { ...enderecoSalvo, ...dados };
  },
  async remover(usuarioId, enderecoId) {
    chamadas.push({ metodo: 'remover', usuarioId, enderecoId });
    if (enderecoId !== ENDERECO_ID) throw new AppError('Endereço não encontrado.', 404);
  },
};

const authProvider: AuthIdentityProvider = {
  async verify(credentials) {
    if (credentials.bearerToken !== 'token-hu11') {
      return { status: 'UNAUTHENTICATED', reason: 'Token inválido.' };
    }
    return { status: 'AUTHENTICATED', identity: { userId: USUARIO_ID, email: 'comprador@origem.test' } };
  },
};

const corpo = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  uf: 'SP',
};

let server: Server;
let url: string;

function requisicao(caminho: string, init: RequestInit = {}, autenticado = true) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (autenticado) headers.set('Authorization', 'Bearer token-hu11');
  return fetch(`${url}${caminho}`, { ...init, headers });
}

describe('HU-11 · rotas /enderecos', () => {
  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/enderecos', createEnderecoRoutes({ authProvider, service }));
    app.use((error: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(error, req, res, next),
    );
    server = await new Promise((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta.');
    url = `http://127.0.0.1:${address.port}/api/v1/enderecos`;
  });

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('exige autenticação em todas as rotas', async () => {
    const respostas = await Promise.all([
      requisicao('', {}, false),
      requisicao('', { method: 'POST', body: JSON.stringify(corpo) }, false),
      requisicao(`/${ENDERECO_ID}`, { method: 'PATCH', body: JSON.stringify(corpo) }, false),
      requisicao(`/${ENDERECO_ID}`, { method: 'DELETE' }, false),
    ]);
    assert.deepEqual(respostas.map((r) => r.status), [401, 401, 401, 401]);
  });

  it('lista os endereços do usuário do token', async () => {
    chamadas.length = 0;
    const res = await requisicao('');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { dados: [enderecoSalvo] });
    assert.deepEqual(chamadas, [{ metodo: 'listar', usuarioId: USUARIO_ID }]);
  });

  it('cria endereço validado com 201', async () => {
    const res = await requisicao('', { method: 'POST', body: JSON.stringify(corpo) });
    assert.equal(res.status, 201);
    const criado = (await res.json()) as EnderecoComprador;
    assert.equal(criado.cep, '01310100');
    assert.equal(criado.uf, 'SP');
  });

  it('recusa dados inválidos com 422 sem chamar o serviço', async () => {
    chamadas.length = 0;
    const res = await requisicao('', { method: 'POST', body: JSON.stringify({ ...corpo, cep: '12' }) });
    assert.equal(res.status, 422);
    assert.equal(chamadas.length, 0);
  });

  it('repassa o limite de 5 endereços como 422', async () => {
    const res = await requisicao('', {
      method: 'POST',
      body: JSON.stringify({ ...corpo, numero: 'sexto' }),
    });
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as { codigo?: string }).codigo, 'LIMITE_ENDERECOS_ATINGIDO');
  });

  it('edita e remove usando o usuário do token', async () => {
    chamadas.length = 0;
    const editado = await requisicao(`/${ENDERECO_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...corpo, numero: '2000' }),
    });
    assert.equal(editado.status, 200);

    const removido = await requisicao(`/${ENDERECO_ID}`, { method: 'DELETE' });
    assert.equal(removido.status, 204);

    assert.deepEqual(chamadas, [
      { metodo: 'atualizar', usuarioId: USUARIO_ID, enderecoId: ENDERECO_ID },
      { metodo: 'remover', usuarioId: USUARIO_ID, enderecoId: ENDERECO_ID },
    ]);
  });

  it('responde 404 para endereço que não pertence ao usuário', async () => {
    const outro = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const res = await requisicao(`/${outro}`, { method: 'DELETE' });
    assert.equal(res.status, 404);
  });
});
