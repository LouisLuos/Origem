import { Artisan, ArtisanProps } from '../entities/Artisan'
import { PaginatedResult } from './IProductRepository'

export interface ArtisanQueryFilter {
  search?: string
  hub?: string
  technique?: string
  page?: number
  limit?: number
}

export type CreateArtisanData = Omit<ArtisanProps, 'createdAt' | 'updatedAt'>

export interface IArtisanRepository {
  findAll(filter?: ArtisanQueryFilter): Promise<PaginatedResult<Artisan>>
  findById(id: string): Promise<Artisan | null>
  findByEmail(email: string): Promise<Artisan | null>
  create(data: CreateArtisanData): Promise<Artisan>
}

