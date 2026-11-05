import { Review } from '../entities/Review'

export interface IReviewRepository {
  findAll(): Promise<Review[]>
}

