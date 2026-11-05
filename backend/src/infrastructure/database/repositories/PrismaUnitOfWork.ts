import { Prisma, PrismaClient } from '@prisma/client'
import {
  IUnitOfWork,
  TransactionalRepositories,
} from '../../../domain/repositories/IUnitOfWork'
import { PrismaNotificationRepository } from './PrismaNotificationRepository'
import { PrismaOrderRepository } from './PrismaOrderRepository'
import { PrismaProductRepository } from './PrismaProductRepository'

/**
 * Implementação Prisma do padrão Unit of Work.
 * Utiliza `ReadCommitted` combinado com `SELECT ... FOR UPDATE` explícito nas linhas de produto,
 * reproduzindo com fidelidade o mecanismo `@Lock(PESSIMISTIC_WRITE)` do PostgreSQL:
 * transações concorrentes aguardam na fila de tupla do SGBD e leem o saldo atualizado assim que
 * a transação predecessora comita, sem falsos aborts de serialização.
 */
export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(
    private readonly prismaClient: PrismaClient,
    private readonly options: { maxWaitMs?: number; timeoutMs?: number } = {},
  ) {}

  public async executeInTransaction<T>(
    work: (txRepos: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.prismaClient.$transaction(
      async (tx) => {
        const txRepos: TransactionalRepositories = {
          products: new PrismaProductRepository(tx),
          orders: new PrismaOrderRepository(tx),
          notifications: new PrismaNotificationRepository(tx),
        }
        return work(txRepos)
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: this.options.maxWaitMs ?? 10_000,
        timeout: this.options.timeoutMs ?? 15_000,
      },
    )
  }
}

