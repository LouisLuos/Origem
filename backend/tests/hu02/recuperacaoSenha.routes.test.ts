import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthRepository } from '../../src/repositories/contracts/authentication.contracts.js';
import { createAuthRoutes } from '../../src/routes/auth.routes.js';
import {
  MENSAGEM_SOLICITACAO_RECUPERACAO,
  type RecuperacaoSenhaService,
} from '../../src/services/recuperacaoSenha.service.js';
import { AppError } from '../../src/utils/AppError.js';

const TOKEN_VALIDO = 'a'.repeat(43);
const solicitacoes: string[] = [];
const redefinicoes: Array<{ token: string; senha: string }> = [];

const recuperacaoService: RecuperacaoSenhaService = {
  async solicitar(email) {
    solicitacoes.push(email);
    if (email === 'falha@email.com') throw new Error('fila indisponível');
  },
  async redefinir(token, senha) {
    if (token !== TOKEN_VALIDO) {
      throw new AppError('Link inválido.', 400, 'TOKEN_RECUPERACAO_INVALIDO');
    }
    redefinicoes.push({ token, senha });
  },
};

let server: Server;
let url: string;

function post(caminho: string, corpo: unknown) {
  return fetch(`${url}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
}

describe('HU-02 · rotas de recuperação de senha', () => {
  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      '/auth',
      createAuthRoutes({ repository: {} as AuthRepository, recuperacaoService }),
    );
    app.use((error: unknown, req: Request, res: Response, next: NextFunction) =>
      errorHandler(error, req, res, next),
    );
    server = await new Promise((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta.');
    url = `http://127.0.0.1:${address.port}/auth`;
  });

  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('Cenário 2: responde 200 com a mesma mensagem para e-mail com ou sem conta', async () => {
    const comConta = await post('/forgot-password', { email: 'Maria@Email.com' });
    const semConta = await post('/forgot-password', { email: 'ninguem@email.com' });

    assert.equal(comConta.status, 200);
    assert.equal(semConta.status, 200);
    assert.deepEqual(await comConta.json(), { mensagem: MENSAGEM_SOLICITACAO_RECUPERACAO });
    assert.deepEqual(await semConta.json(), { mensagem: MENSAGEM_SOLICITACAO_RECUPERACAO });
    assert.ok(solicitacoes.includes('maria@email.com'));
  });

  it('falha interna no envio não muda a resposta', async () => {
    const res = await post('/forgot-password', { email: 'falha@email.com' });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { mensagem: MENSAGEM_SOLICITACAO_RECUPERACAO });
  });

  it('recusa e-mail mal formatado com 400', async () => {
    const res = await post('/forgot-password', { email: 'nao-e-email' });
    assert.equal(res.status, 400);
  });

  it('Cenário 3: redefine com token válido e senha forte e limpa o cookie de sessão', async () => {
    const res = await post('/reset-password', { token: TOKEN_VALIDO, password: 'NovaSenha@2026' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie') ?? '', /origem_session=;/);
    assert.deepEqual(redefinicoes.at(-1), { token: TOKEN_VALIDO, senha: 'NovaSenha@2026' });
  });

  it('recusa senha fraca sem chamar o serviço', async () => {
    const antes = redefinicoes.length;
    const res = await post('/reset-password', { token: TOKEN_VALIDO, password: 'fraca' });
    assert.equal(res.status, 400);
    assert.equal(redefinicoes.length, antes);
  });

  it('recusa token inválido ou já usado com 400', async () => {
    const res = await post('/reset-password', { token: 'b'.repeat(43), password: 'NovaSenha@2026' });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { codigo?: string }).codigo, 'TOKEN_RECUPERACAO_INVALIDO');
  });
});
