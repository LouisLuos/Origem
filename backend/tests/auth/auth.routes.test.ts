import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthUserRecord } from '../../src/repositories/contracts/authentication.contracts.js';
import { createAuthRoutes } from '../../src/routes/auth.routes.js';
import type { AuthService } from '../../src/services/auth.service.js';
import { AppError } from '../../src/utils/AppError.js';

const buyer: AuthUserRecord = {
  id: 'user-1',
  name: 'Maria da Silva',
  email: 'maria@email.com',
  passwordHash: 'not-returned',
  status: 'ATIVO',
  roles: ['COMPRADOR'],
};

async function startServer(service: AuthService) {
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRoutes({
    service,
    repository: {
      async createBuyer() { return buyer; },
      async findByEmail() { return buyer; },
      async findById() { return buyer; },
      async updateName() { return buyer; },
      async listUsers() { return [buyer]; },
      async findLoginAttempt() { return null; },
      async recordFailedLogin() { return { failedAttempts: 1, lockedUntil: null }; },
      async clearLoginAttempts() {},
    },
    tokenService: { async issue() { return 'fake-session-token'; } },
  }));
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) =>
    errorHandler(error, req, res, next),
  );
  const server: Server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta.');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

describe('rotas de autenticação HU-01', () => {
  it('cria conta com HTTP 201 e cookie de sessão sem devolver hash', async () => {
    const service: AuthService = {
      async register() { return buyer; },
      async login() { return buyer; },
      async getActiveUser() { return buyer; },
      async updateName() { return buyer; },
      async listUsers() { return [buyer]; },
    };
    const server = await startServer(service);
    try {
      const response = await fetch(`${server.url}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Maria da Silva',
          email: 'maria@email.com',
          cpfCnpj: '52998224725',
          whatsapp: '81999999999',
          password: 'Origem@2026',
        }),
      });
      const body = await response.json() as { user: Record<string, unknown> };
      assert.equal(response.status, 201);
      assert.match(response.headers.get('set-cookie') ?? '', /origem_session=.*HttpOnly/i);
      assert.equal(body.user.role, 'buyer');
      assert.equal('passwordHash' in body.user, false);
    } finally {
      await server.close();
    }
  });

  it('preserva HTTP 409 e a mensagem normativa em cadastros duplicados', async () => {
    const service: AuthService = {
      async register() {
        throw new AppError('Este e-mail ou CPF/CNPJ já está associado a uma conta ativa', 409, 'CONTA_DUPLICADA');
      },
      async login() { return buyer; },
      async getActiveUser() { return buyer; },
      async updateName() { return buyer; },
      async listUsers() { return [buyer]; },
    };
    const server = await startServer(service);
    try {
      const response = await fetch(`${server.url}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Maria da Silva',
          email: 'maria@email.com',
          cpfCnpj: '52998224725',
          whatsapp: '81999999999',
          password: 'Origem@2026',
        }),
      });
      assert.equal(response.status, 409);
      assert.equal((await response.json() as { erro: string }).erro, 'Este e-mail ou CPF/CNPJ já está associado a uma conta ativa');
    } finally {
      await server.close();
    }
  });

  it('limpa o cookie de sessão no logout sem prolongar sua validade', async () => {
    const service: AuthService = {
      async register() { return buyer; },
      async login() { return buyer; },
      async getActiveUser() { return buyer; },
      async updateName() { return buyer; },
      async listUsers() { return [buyer]; },
    };
    const server = await startServer(service);
    try {
      const response = await fetch(`${server.url}/auth/logout`, { method: 'POST' });
      const cookie = response.headers.get('set-cookie') ?? '';
      assert.equal(response.status, 204);
      assert.match(cookie, /origem_session=/);
      assert.doesNotMatch(cookie, /Max-Age=604800/i);
    } finally {
      await server.close();
    }
  });
});
