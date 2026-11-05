import { IProductRepository } from './IProductRepository'
import { IOrderRepository } from './IOrderRepository'
import { INotificationRepository } from './INotificationRepository'

/**
 * Conjunto de repositórios escopados dentro de uma mesma transação ACID de banco de dados.
 */
export interface TransactionalRepositories {
  products: IProductRepository
  orders: IOrderRepository
  notifications: INotificationRepository
}

/**
 * Porta Unit of Work para execução atômica ACID (Commit ou Rollback integral)
 * sem vazar tipos do Prisma ORM para a camada de Aplicação (RNF-04).
 */
export interface IUnitOfWork {
  executeInTransaction<T>(
    work: (txRepos: TransactionalRepositories) => Promise<T>,
  ): Promise<T>
}

