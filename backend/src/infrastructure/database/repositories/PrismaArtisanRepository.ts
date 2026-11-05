import { Prisma } from '@prisma/client'
import { Artisan } from '../../../domain/entities/Artisan'
import { DuplicateResourceException } from '../../../domain/errors'
import {
  ArtisanQueryFilter,
  CreateArtisanData,
  IArtisanRepository,
} from '../../../domain/repositories/IArtisanRepository'
import { PaginatedResult } from '../../../domain/repositories/IProductRepository'
import { PrismaDbClient } from '../prismaClient'
import { PrismaDomainMapper } from '../mappers/PrismaDomainMapper'

export class PrismaArtisanRepository implements IArtisanRepository {
  constructor(private readonly db: PrismaDbClient) {}

  public async findAll(filter: ArtisanQueryFilter = {}): Promise<PaginatedResult<Artisan>> {
    const currentPage = Math.max(1, filter.page ?? 1)
    const pageSize = Math.max(1, filter.limit ?? 20)
    const skip = (currentPage - 1) * pageSize

    const andConditions: Prisma.ArtisanWhereInput[] = []

    if (filter.search) {
      const query = filter.search.trim()
      andConditions.push({
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { hub: { contains: query, mode: 'insensitive' } },
          { technique: { contains: query, mode: 'insensitive' } },
        ],
      })
    }

    if (filter.hub) {
      andConditions.push({
        hub: { contains: filter.hub.trim(), mode: 'insensitive' },
      })
    }

    if (filter.technique) {
      andConditions.push({
        technique: { contains: filter.technique.trim(), mode: 'insensitive' },
      })
    }

    const where: Prisma.ArtisanWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {}

    const [totalItems, rows] = await Promise.all([
      this.db.artisan.count({ where }),
      this.db.artisan.findMany({
        where,
        orderBy: { since: 'asc' },
        skip,
        take: pageSize,
      }),
    ])

    return {
      items: rows.map(PrismaDomainMapper.toDomainArtisan),
      totalItems,
      currentPage,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    }
  }

  public async findById(id: string): Promise<Artisan | null> {
    const row = await this.db.artisan.findUnique({ where: { id } })
    return row ? PrismaDomainMapper.toDomainArtisan(row) : null
  }

  public async findByEmail(email: string): Promise<Artisan | null> {
    const normalized = email.trim().toLowerCase()
    const row = await this.db.artisan.findUnique({ where: { email: normalized } })
    return row ? PrismaDomainMapper.toDomainArtisan(row) : null
  }

  public async create(data: CreateArtisanData): Promise<Artisan> {
    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null

    if (normalizedEmail) {
      const existing = await this.db.artisan.findUnique({
        where: { email: normalizedEmail },
      })
      if (existing) {
        throw new DuplicateResourceException('Já existe um artesão com este e-mail.')
      }
    }

    const created = await this.db.artisan.create({
      data: {
        id: data.id,
        name: data.name,
        hub: data.hub,
        technique: data.technique,
        bio: data.bio,
        since: data.since,
        photoUrl: data.photoUrl,
        photoAlt: data.photoAlt,
        coverUrl: data.coverUrl,
        coverAlt: data.coverAlt,
        email: normalizedEmail,
        phone: data.phone ?? null,
        workshopAddress: data.workshopAddress ?? null,
        publicContactConsent: data.publicContactConsent ?? false,
      },
    })

    return PrismaDomainMapper.toDomainArtisan(created)
  }
}

