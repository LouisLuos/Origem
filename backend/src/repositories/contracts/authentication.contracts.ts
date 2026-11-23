import type { PapelUsuario } from '../../generated/prisma/client.js';

export interface AuthUserRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly status: string;
  readonly roles: readonly PapelUsuario[];
}

export interface RegisterAuthUserInput {
  readonly name: string;
  readonly email: string;
  readonly cpfCnpj: string;
  readonly whatsapp: string;
  readonly password: string;
}

export interface CreateAuthUserInput {
  readonly name: string;
  readonly email: string;
  readonly cpfCnpj: string;
  readonly whatsapp: string;
  readonly passwordHash: string;
}

export interface LoginAttemptRecord {
  readonly failedAttempts: number;
  readonly lockedUntil: Date | null;
}

export interface AuthRepository {
  createBuyer(input: CreateAuthUserInput): Promise<AuthUserRecord>;
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  updateName(userId: string, name: string): Promise<AuthUserRecord>;
  listUsers(): Promise<AuthUserRecord[]>;
  findLoginAttempt(email: string): Promise<LoginAttemptRecord | null>;
  recordFailedLogin(email: string): Promise<LoginAttemptRecord>;
  clearLoginAttempts(email: string): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}
