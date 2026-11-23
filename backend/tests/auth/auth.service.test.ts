import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  AuthRepository,
  AuthUserRecord,
  CreateAuthUserInput,
  LoginAttemptRecord,
  PasswordHasher,
} from '../../src/repositories/contracts/authentication.contracts.js';
import { AppError } from '../../src/utils/AppError.js';
import { createAuthService } from '../../src/services/auth.service.js';

class InMemoryAuthRepository implements AuthRepository {
  user: AuthUserRecord | null = null;
  attempts: LoginAttemptRecord | null = null;
  createdInput: CreateAuthUserInput | null = null;

  async createBuyer(input: CreateAuthUserInput) {
    this.createdInput = input;
    this.user = {
      id: 'user-1',
      name: input.name,
      email: input.email,
      passwordHash: input.passwordHash,
      status: 'ATIVO',
      roles: ['COMPRADOR'],
    };
    return this.user;
  }

  async findByEmail(email: string) {
    return this.user?.email === email ? this.user : null;
  }

  async findById(id: string) {
    return this.user?.id === id ? this.user : null;
  }

  async updateName(userId: string, name: string) {
    assert.equal(userId, this.user?.id);
    this.user = { ...this.user!, name };
    return this.user;
  }

  async listUsers() {
    return this.user ? [this.user] : [];
  }

  async findLoginAttempt() {
    return this.attempts;
  }

  async recordFailedLogin(): Promise<LoginAttemptRecord> {
    const now = new Date();
    const attempts =
      this.attempts?.lockedUntil && this.attempts.lockedUntil <= now
        ? 1
        : (this.attempts?.failedAttempts ?? 0) + 1;
    const lockedUntil =
      this.attempts?.lockedUntil && this.attempts.lockedUntil > now
        ? this.attempts.lockedUntil
        : attempts > 5
          ? new Date(now.getTime() + 15 * 60 * 1000)
          : null;
    this.attempts = { failedAttempts: attempts, lockedUntil };
    return this.attempts;
  }

  async clearLoginAttempts() {
    this.attempts = null;
  }
}

const passwordHasher: PasswordHasher = {
  async hash(password) {
    return `hash:${password}`;
  },
  async verify(password, passwordHash) {
    return passwordHash === `hash:${password}`;
  },
};

describe('serviço de autenticação', () => {
  it('cria comprador com e-mail normalizado e senha em hash', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createAuthService({ repository, passwordHasher });
    const user = await service.register({
      name: 'Maria da Silva',
      email: ' Maria@Email.com ',
      cpfCnpj: '529.982.247-25',
      whatsapp: '(81) 99999-9999',
      password: 'Origem@2026',
    });

    assert.equal(user.email, 'maria@email.com');
    assert.deepEqual(user.roles, ['COMPRADOR']);
    assert.equal(repository.createdInput?.passwordHash, 'hash:Origem@2026');
    assert.equal(repository.createdInput?.cpfCnpj, '52998224725');
    assert.equal(repository.createdInput?.whatsapp, '81999999999');
  });

  it('retorna 401 nas cinco primeiras falhas e 429 na sexta, mantendo o bloqueio', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createAuthService({ repository, passwordHasher });
    await service.register({
      name: 'Maria da Silva',
      email: 'maria@email.com',
      cpfCnpj: '52998224725',
      whatsapp: '81999999999',
      password: 'Origem@2026',
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await assert.rejects(service.login('maria@email.com', 'senha-errada'), (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 401);
        return true;
      });
    }

    await assert.rejects(service.login('maria@email.com', 'senha-errada'), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 429);
      return true;
    });

    await assert.rejects(service.login('maria@email.com', 'Origem@2026'), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 429);
      return true;
    });
  });

  it('limpa o contador após autenticação válida', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createAuthService({ repository, passwordHasher });
    await service.register({
      name: 'Maria da Silva',
      email: 'maria@email.com',
      cpfCnpj: '52998224725',
      whatsapp: '81999999999',
      password: 'Origem@2026',
    });
    repository.attempts = { failedAttempts: 2, lockedUntil: null };

    const user = await service.login('MARIA@EMAIL.COM', 'Origem@2026');
    assert.equal(user.id, 'user-1');
    assert.equal(repository.attempts, null);
  });

  it('também conta falhas para e-mail inexistente e aplica 429 na sexta tentativa', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createAuthService({ repository, passwordHasher });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await assert.rejects(service.login('desconhecido@email.com', 'senha-errada'), (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 401);
        return true;
      });
    }

    await assert.rejects(
      service.login('DESCONHECIDO@EMAIL.COM', 'senha-errada'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 429);
        return true;
      },
    );
  });
});
