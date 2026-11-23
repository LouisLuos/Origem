import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthUserRecord } from '../../src/repositories/contracts/authentication.contracts.js';
import {
  createJwtAuthIdentityProvider,
  sessaoRevogada,
  sessionTokenService,
} from '../../src/utils/authToken.util.js';

const user: AuthUserRecord = {
  id: 'b6c8c888-f0a0-4eed-9223-26f6bb6d9d65',
  name: 'Maria da Silva',
  email: 'maria@email.com',
  passwordHash: 'never-exposed',
  status: 'ATIVO',
  roles: ['COMPRADOR'],
};

describe('HU-02 · encerramento de sessões após redefinir a senha', () => {
  it('sessaoRevogada compara a emissão do token com a última redefinição', () => {
    const redefinidaEm = new Date('2026-11-24T12:00:10.500Z');
    const segundos = (iso: string) => Date.parse(iso) / 1000;

    assert.equal(sessaoRevogada(segundos('2026-11-24T12:00:00.000Z'), null), false);
    assert.equal(sessaoRevogada(segundos('2026-11-24T12:00:09.000Z'), redefinidaEm), true);
    assert.equal(sessaoRevogada(segundos('2026-11-24T12:00:10.000Z'), redefinidaEm), false);
    assert.equal(sessaoRevogada(segundos('2026-11-24T12:05:00.000Z'), redefinidaEm), false);
    assert.equal(sessaoRevogada(undefined, redefinidaEm), true);
  });

  it('recusa um token emitido antes da redefinição', async () => {
    const token = await sessionTokenService.issue(user);
    const provider = createJwtAuthIdentityProvider(async () => new Date(Date.now() + 60_000));
    const result = await provider.verify({ bearerToken: token });
    assert.equal(result.status, 'UNAUTHENTICATED');
  });

  it('aceita o token quando não houve redefinição', async () => {
    const token = await sessionTokenService.issue(user);
    const provider = createJwtAuthIdentityProvider(async () => null);
    const result = await provider.verify({ bearerToken: token });
    assert.equal(result.status, 'AUTHENTICATED');
  });

  it('recusa token de usuário que não existe mais', async () => {
    const token = await sessionTokenService.issue(user);
    const provider = createJwtAuthIdentityProvider(async () => 'INEXISTENTE');
    const result = await provider.verify({ bearerToken: token });
    assert.equal(result.status, 'UNAUTHENTICATED');
  });

  it('propaga falha do banco para o middleware responder 503', async () => {
    const token = await sessionTokenService.issue(user);
    const provider = createJwtAuthIdentityProvider(async () => {
      throw new Error('banco indisponível');
    });
    await assert.rejects(provider.verify({ bearerToken: token }), /banco indisponível/);
  });
});
