import type {
  AuthRepository,
  AuthUserRecord,
  CreateAuthUserInput,
  PasswordHasher,
  RegisterAuthUserInput,
} from '../repositories/contracts/authentication.contracts.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AppError } from '../utils/AppError.js';
import { passwordHasher as defaultPasswordHasher } from '../utils/password.util.js';

export interface AuthServiceDeps {
  readonly repository?: AuthRepository;
  readonly passwordHasher?: PasswordHasher;
  readonly now?: () => Date;
}

export interface AuthService {
  register(input: RegisterAuthUserInput): Promise<AuthUserRecord>;
  login(email: string, password: string): Promise<AuthUserRecord>;
  getActiveUser(userId: string): Promise<AuthUserRecord>;
  updateName(userId: string, name: string): Promise<AuthUserRecord>;
  listUsers(): Promise<AuthUserRecord[]>;
}

export function createAuthService(deps: AuthServiceDeps = {}): AuthService {
  const repository = deps.repository ?? authRepository;
  const passwordHasher = deps.passwordHasher ?? defaultPasswordHasher;
  const now = deps.now ?? (() => new Date());

  return {
    async register(input) {
      const createInput: CreateAuthUserInput = {
        name: input.name,
        email: input.email.trim().toLowerCase(),
        cpfCnpj: input.cpfCnpj.replace(/[^0-9A-Z]/gi, '').toUpperCase(),
        whatsapp: input.whatsapp.replace(/\D/g, ''),
        passwordHash: await passwordHasher.hash(input.password),
      };
      return repository.createBuyer(createInput);
    },

    async login(email, password) {
      const normalizedEmail = email.trim().toLowerCase();
      const attempt = await repository.findLoginAttempt(normalizedEmail);
      if (attempt?.lockedUntil && attempt.lockedUntil > now()) {
        throw new AppError(
          'Muitas tentativas de login. Tente novamente em 15 minutos.',
          429,
          'LOGIN_BLOQUEADO',
        );
      }

      const user = await repository.findByEmail(normalizedEmail);
      if (!user) {
        const updatedAttempt = await repository.recordFailedLogin(normalizedEmail);
        if (updatedAttempt.lockedUntil && updatedAttempt.lockedUntil > now()) {
          throw new AppError(
            'Muitas tentativas de login. Tente novamente em 15 minutos.',
            429,
            'LOGIN_BLOQUEADO',
          );
        }
        throw new AppError('E-mail ou senha incorretos.', 401, 'CREDENCIAIS_INVALIDAS');
      }

      const validPassword =
        user.status === 'ATIVO' && (await passwordHasher.verify(password, user.passwordHash));

      if (!validPassword) {
        const updatedAttempt = await repository.recordFailedLogin(normalizedEmail);
        if (updatedAttempt.lockedUntil && updatedAttempt.lockedUntil > now()) {
          throw new AppError(
            'Muitas tentativas de login. Tente novamente em 15 minutos.',
            429,
            'LOGIN_BLOQUEADO',
          );
        }
        throw new AppError('E-mail ou senha incorretos.', 401, 'CREDENCIAIS_INVALIDAS');
      }

      await repository.clearLoginAttempts(normalizedEmail);
      return user;
    },

    async getActiveUser(userId) {
      const user = await repository.findById(userId);
      if (!user || user.status !== 'ATIVO') {
        throw new AppError('Conta não encontrada ou inativa.', 401);
      }
      return user;
    },

    async updateName(userId, name) {
      await this.getActiveUser(userId);
      return repository.updateName(userId, name);
    },

    listUsers() {
      return repository.listUsers();
    },
  };
}

export const authService = createAuthService();
