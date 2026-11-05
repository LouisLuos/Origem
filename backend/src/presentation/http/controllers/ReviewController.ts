import type { Request, Response } from 'express'
import { IReviewRepository } from '../../../domain/repositories/IReviewRepository'

export class ReviewController {
  constructor(private readonly reviewRepository: IReviewRepository) {}

  public list = async (_req: Request, res: Response): Promise<void> => {
    const reviews = await this.reviewRepository.findAll()
    res.status(200).json({
      dados: reviews.map((review) => ({
        id: review.id,
        name: review.name,
        location: review.location,
        quote: review.quote,
        rating: review.rating,
        avatarUrl: review.avatarUrl,
        avatarAlt: review.avatarAlt,
      })),
    })
  }
}

