import { User } from '../../../domain/entities/User'
import { DomainError, DuplicateResourceException } from '../../../domain/errors'
import {
  CreateUserData,
  IUserRepository,
} from '../../../domain/repositories/IUserRepository'
import { PrismaDbClient } from '../prismaClient'
import { PrismaDomainMapper } from '../mappers/PrismaDomainMapper'

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db: PrismaDbClient) {}

  public async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase()
    const row = await this.db.user.findUnique({ where: { email: normalized } })
    return row ? PrismaDomainMapper.toDomainUser(row) : null
  }

  public async findAll(): Promise<User[]> {
    const rows = await this.db.user.findMany({ orderBy: { createdAt: 'asc' } })
    return rows.map(PrismaDomainMapper.toDomainUser)
  }

  public async create(data: CreateUserData): Promise<User> {
    const normalizedEmail = data.email.trim().toLowerCase()
    const existing = await this.db.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      throw new DuplicateResourceException('Já existe uma conta com este e-mail.')
    }

    const created = await this.db.user.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        name: data.name.trim(),
        email: normalizedEmail,
        passwordHash: data.passwordHash,
        role: PrismaDomainMapper.toPrismaUserRole(data.role),
      },
    })

    return PrismaDomainMapper.toDomainUser(created)
  }

  public async updateName(email: string, name: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase()
    const existing = await this.db.user.findUnique({ where: { email: normalizedEmail } })
    if (!existing) {
      throw new DomainError('Conta não encontrada.', 'USER_NOT_FOUND', 404)
    }

    const updated = await this.db.user.update({
      where: { email: normalizedEmail },
      data: { name: name.trim() },
    })

    return PrismaDomainMapper.toDomainUser(updated)
  }
}

