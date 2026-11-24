import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import type { AtelieAutorizacaoRepository } from '../../src/repositories/contracts/hu03.contracts.js';
import type { AteliePersistido } from '../../src/repositories/contracts/hu04.contracts.js';
import { createAtelieCadastroRoutes } from '../../src/routes/atelieCadastro.routes.js';
import type { AtelieCadastroService } from '../../src/services/atelieCadastro.service.js';
import { AppError } from '../../src/utils/AppError.js';
import type {
  AuthorizationDenialAuditInput,
  SecurityAuditService,
} from '../../src/utils/securityAudit.util.js';

async function startServer(service: AtelieCadastroService, isOwner = true) {
  const authProvider: AuthIdentityProvider = {
    async verify(credentials) {
      if (credentials.bearerToken !== 'valid-hu04-token') {
        return { status: 'UNAUTHENTICATED', reason: 'Token inválido.' };
      }
      return {
        status: 'AUTHENTICATED',
        identity: { userId: 'b6c8c888-f0a0-4eed-9223-26f6bb6d9d65', email: 'artesao@origem.test' },
      };
    },
  };

  const app = express();
  app.use(express.json());
  const auditEvents: AuthorizationDenialAuditInput[] = [];
  const autorizacaoRepository: AtelieAutorizacaoRepository = {
    async findRelacionamentoUsuarioAtelie(usuarioId, atelieId) {
      return atelieId === created.id
        ? {
            atelieId,
            nomeComercial: created.nomeComercial,
            statusAtelie: 'ATIVO',
            ehTitular: isOwner && usuarioId === 'b6c8c888-f0a0-4eed-9223-26f6bb6d9d65',
            ehCuradorVinculado: !isOwner,
          }
        : null;
    },
    async listRelacionamentosUsuario() {
      return [];
    },
  };
  const auditService: SecurityAuditService = {
    async recordAuthorizationDenial(input) {
      auditEvents.push(input);
      return {
        ...input,
        eventType: 'ATELIER_AUTHORIZATION_DENIED',
        timestamp: '2026-11-22T12:00:00.000Z',
        decision: 'DENY',
      };
    },
  };
  app.use('/api/v1/atelies', createAtelieCadastroRoutes({
    authProvider,
    service,
    autorizacaoRepository,
    auditService,
  }));
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) =>
    errorHandler(error, req, res, next),
  );

  const server: Server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta.');

  return {
    url: `http://127.0.0.1:${address.port}/api/v1/atelies`,
    auditEvents,
    close: () => new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    ),
  };
}

const payload = {
  nomeComercial: 'Ateliê Maria',
  poloCultural: 'Tracunhaém',
  endereco: {
    cep: '55860000',
    logradouro: 'Rua das Rendeiras',
    numero: '123',
    bairro: 'Centro',
    cidade: 'Tracunhaém',
    uf: 'PE',
  },
};

const created: AteliePersistido = {
  id: '6d3d0ab6-bc4e-4e0e-b88f-9f9b4e91db4b',
  artesaoId: 'a5cf7fe8-ea4e-4a31-82ce-ae5d7a0afcf2',
  nomeComercial: payload.nomeComercial,
  poloCultural: payload.poloCultural,
  status: 'ATIVO',
  endereco: payload.endereco,
  criadoEm: '2026-11-22T12:00:00.000Z',
};

describe('rotas de ateliê', () => {
  it('retorna 201 após cadastro válido', async () => {
    const service: AtelieCadastroService = {
      async criar() { return created; },
      async consultar() { return created; },
      async atualizar() { return created; },
    };
    const server = await startServer(service);
    try {
      const response = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-hu04-token' },
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 201);
      assert.equal((await response.json() as AteliePersistido).nomeComercial, 'Ateliê Maria');
    } finally {
      await server.close();
    }
  });

  it('preserva HTTP 422 para ateliê duplicado', async () => {
    const service: AtelieCadastroService = {
      async criar() {
        throw new AppError('Você já possui um ateliê cadastrado.', 422, 'ATELIE_JA_CADASTRADO');
      },
      async consultar() { return created; },
      async atualizar() { return created; },
    };
    const server = await startServer(service);
    try {
      const response = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-hu04-token' },
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 422);
    } finally {
      await server.close();
    }
  });

  it('rejeita UF fora de Pernambuco com HTTP 422', async () => {
    const service: AtelieCadastroService = {
      async criar() { return created; },
      async consultar() { return created; },
      async atualizar() { return created; },
    };
    const server = await startServer(service);
    try {
      const response = await fetch(server.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-hu04-token' },
        body: JSON.stringify({ ...payload, endereco: { ...payload.endereco, uf: 'SP' } }),
      });
      assert.equal(response.status, 422);
    } finally {
      await server.close();
    }
  });

  it('consulta o ateliê apenas com titularidade confirmada', async () => {
    const service: AtelieCadastroService = {
      async criar() { return created; },
      async consultar() { return created; },
      async atualizar() { return created; },
    };
    const server = await startServer(service);
    try {
      const response = await fetch(`${server.url}/${created.id}/dados`, {
        headers: { Authorization: 'Bearer valid-hu04-token' },
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json() as AteliePersistido).endereco, payload.endereco);
    } finally {
      await server.close();
    }
  });

  it('atualiza ateliê e endereço com PATCH após validar o corpo', async () => {
    let updateReceived = false;
    const service: AtelieCadastroService = {
      async criar() { return created; },
      async consultar() { return created; },
      async atualizar(_atelieId, _usuarioId, dados) {
        updateReceived = true;
        return { ...created, nomeComercial: dados.nomeComercial, poloCultural: dados.poloCultural };
      },
    };
    const server = await startServer(service);
    try {
      const response = await fetch(`${server.url}/${created.id}/dados`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-hu04-token' },
        body: JSON.stringify({ ...payload, nomeComercial: 'Ateliê Atualizado' }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as AteliePersistido).nomeComercial, 'Ateliê Atualizado');
      assert.equal(updateReceived, true);
    } finally {
      await server.close();
    }
  });

  it('nega edição a curador e registra a negação na auditoria', async () => {
    const service: AtelieCadastroService = {
      async criar() { return created; },
      async consultar() { return created; },
      async atualizar() { return created; },
    };
    const server = await startServer(service, false);
    try {
      const response = await fetch(`${server.url}/${created.id}/dados`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-hu04-token' },
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 403);
      assert.equal(server.auditEvents[0]?.operation, 'EDITAR_DADOS_ATELIE');
      assert.equal(server.auditEvents[0]?.reason, 'NOT_ATELIER_OWNER');
    } finally {
      await server.close();
    }
  });
});
