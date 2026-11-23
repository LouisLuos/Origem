import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/database.js';
import type {
  AuthRepository,
  AuthUserRecord,
  CreateAuthUserInput,
  LoginAttemptRecord,
} from './contracts/authentication.contracts.js';
import { AppError } from '../utils/AppError.js';

function toAuthUser(record: {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  status: string;
  papeis: { papel: AuthUserRecord['roles'][number] }[];
}): AuthUserRecord {
  return {
    id: record.id,
    name: record.nome,
    email: record.email,
    passwordHash: record.senhaHash,
    status: record.status,
    roles: record.papeis.map(({ papel }) => papel),
  };
}

export const authRepository: AuthRepository = {
  async createBuyer(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    try {
      const created = await prisma.usuario.create({
        data: {
          nome: input.name,
          email: input.email,
          cpfCnpj: input.cpfCnpj,
          telefoneWhatsapp: input.whatsapp,
          senhaHash: input.passwordHash,
          papeis: { create: { papel: 'COMPRADOR' } },
        },
        include: { papeis: true },
      });
      return toAuthUser(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'Este e-mail ou CPF/CNPJ já está associado a uma conta ativa',
          409,
          'CONTA_DUPLICADA',
        );
      }
      throw error;
    }
  },

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const record = await prisma.usuario.findUnique({
      where: { email },
      include: { papeis: true },
    });
    return record ? toAuthUser(record) : null;
  },

  async findById(id: string): Promise<AuthUserRecord | null> {
    const record = await prisma.usuario.findUnique({
      where: { id },
      include: { papeis: true },
    });
    return record ? toAuthUser(record) : null;
  },

  async updateName(userId: string, name: string): Promise<AuthUserRecord> {
    const record = await prisma.usuario.update({
      where: { id: userId },
      data: { nome: name },
      include: { papeis: true },
    });
    return toAuthUser(record);
  },

  async listUsers(): Promise<AuthUserRecord[]> {
    const records = await prisma.usuario.findMany({
      include: { papeis: true },
      orderBy: { criadoEm: 'desc' },
    });
    return records.map(toAuthUser);
  },

  async findLoginAttempt(email: string): Promise<LoginAttemptRecord | null> {
    const attempt = await prisma.authLoginAttempt.findUnique({ where: { email } });
    return attempt
      ? { failedAttempts: attempt.failedAttempts, lockedUntil: attempt.lockedUntil }
      : null;
  },

  async recordFailedLogin(email: string): Promise<LoginAttemptRecord> {
    const rows = await prisma.$queryRaw<LoginAttemptRecord[]>(Prisma.sql`
      INSERT INTO "auth_login_attempts" ("email", "failed_attempts", "locked_until", "updated_at")
      VALUES (${email}, 1, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT ("email") DO UPDATE SET
        "failed_attempts" = CASE
          WHEN "auth_login_attempts"."locked_until" IS NOT NULL
            AND "auth_login_attempts"."locked_until" <= CURRENT_TIMESTAMP THEN 1
          WHEN "auth_login_attempts"."locked_until" IS NOT NULL
            AND "auth_login_attempts"."locked_until" > CURRENT_TIMESTAMP
            THEN "auth_login_attempts"."failed_attempts"
          ELSE "auth_login_attempts"."failed_attempts" + 1
        END,
        "locked_until" = CASE
          WHEN "auth_login_attempts"."locked_until" IS NOT NULL
            AND "auth_login_attempts"."locked_until" > CURRENT_TIMESTAMP
            THEN "auth_login_attempts"."locked_until"
          WHEN (
            CASE
              WHEN "auth_login_attempts"."locked_until" IS NOT NULL
                AND "auth_login_attempts"."locked_until" <= CURRENT_TIMESTAMP THEN 1
              ELSE "auth_login_attempts"."failed_attempts" + 1
            END
          ) > 5 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
          ELSE NULL
        END,
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "failed_attempts" AS "failedAttempts", "locked_until" AS "lockedUntil"
    `);
    const row = rows[0];
    if (!row) throw new Error('Não foi possível registrar a tentativa de autenticação.');
    return row;
  },

  async clearLoginAttempts(email: string): Promise<void> {
    await prisma.authLoginAttempt.deleteMany({ where: { email } });
  },
};
