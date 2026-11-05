import { Review } from '../../../domain/entities/Review'
import { IReviewRepository } from '../../../domain/repositories/IReviewRepository'
import { PrismaDbClient } from '../prismaClient'
import { PrismaDomainMapper } from '../mappers/PrismaDomainMapper'

export class PrismaReviewRepository implements IReviewRepository {
  constructor(private readonly db: PrismaDbClient) {}

  public async findAll(): Promise<Review[]> {
    const rows = await this.db.review.findMany({ orderBy: { createdAt: 'asc' } })
    return rows.map(PrismaDomainMapper.toDomainReview)
  }
}

