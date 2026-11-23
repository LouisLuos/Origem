import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthUserRecord } from '../../src/repositories/contracts/authentication.contracts.js';
import { jwtAuthIdentityProvider, sessionTokenService } from '../../src/utils/authToken.util.js';

const user: AuthUserRecord = {
  id: 'b6c8c888-f0a0-4eed-9223-26f6bb6d9d65',
  name: 'Maria da Silva',
  email: 'maria@email.com',
  passwordHash: 'never-exposed',
  status: 'ATIVO',
  roles: ['COMPRADOR'],
};

describe('sessão JWT', () => {
  it('assina e verifica sessão por cookie HttpOnly', async () => {
    const token = await sessionTokenService.issue(user);
    const result = await jwtAuthIdentityProvider.verify({
      cookieHeader: `origem_session=${encodeURIComponent(token)}`,
    });

    assert.equal(result.status, 'AUTHENTICATED');
    if (result.status === 'AUTHENTICATED') {
      assert.equal(result.identity.userId, user.id);
      assert.equal(result.identity.email, user.email);
      assert.ok(result.identity.sessionId);
    }
  });

  it('rejeita JWT malformado', async () => {
    const result = await jwtAuthIdentityProvider.verify({ bearerToken: 'invalid.jwt.token' });
    assert.equal(result.status, 'UNAUTHENTICATED');
  });
});
