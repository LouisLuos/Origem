import { Prisma } from '@prisma/client'
import { Product } from '../../../domain/entities/Product'
import {
  ProductNotFoundException,
  ProductUnavailableException,
} from '../../../domain/errors'
import {
  CreateProductData,
  IProductRepository,
  PaginatedResult,
  ProductQueryFilter,
  UpdateProductData,
} from '../../../domain/repositories/IProductRepository'
import { PrismaDbClient } from '../prismaClient'
import { PrismaDomainMapper, RawLockedProductRow } from '../mappers/PrismaDomainMapper'

/**
 * Adaptador Prisma para `IProductRepository`.
 * Implementa o bloqueio pessimista exclusivo de tupla no PostgreSQL (`SELECT ... FOR UPDATE`)
 * em estrita aderência ao RNF-01 e à Rubrica FCCPD.
 */
export class PrismaProductRepository implements IProductRepository {
  constructor(private readonly db: PrismaDbClient) {}

  public async findAll(filter: ProductQueryFilter = {}): Promise<PaginatedResult<Product>> {
    const currentPage = Math.max(1, filter.page ?? 1)
    const pageSize = Math.max(1, filter.limit ?? 10)
    const skip = (currentPage - 1) * pageSize

    const where: Prisma.ProductWhereInput = {
      ...(filter.technique
        ? { technique: { equals: filter.technique, mode: 'insensitive' } }
        : {}),
      ...(filter.hub ? { hub: { contains: filter.hub, mode: 'insensitive' } } : {}),
      ...(filter.onlyActive !== undefined ? { active: filter.onlyActive } : {}),
    }

    const [totalItems, rows] = await Promise.all([
      this.db.product.count({ where }),
      this.db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ])

    return {
      items: rows.map(PrismaDomainMapper.toDomainProduct),
      totalItems,
      currentPage,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    }
  }

  public async findById(id: string): Promise<Product | null> {
    const row = await this.db.product.findUnique({ where: { id } })
    return row ? PrismaDomainMapper.toDomainProduct(row) : null
  }

  /**
   * Executa `SELECT ... FROM "product" WHERE "id" = $1 FOR UPDATE` parametrizado.
   * Quando executado dentro de `prisma.$transaction`, trava a linha correspondente no
   * gerenciador de tuplas XMAX do PostgreSQL até o `COMMIT` ou `ROLLBACK`, serializando
   * acessos concorrentes à mesma peça e prevenindo overselling e saldo negativo.
   */
  public async findByIdForUpdate(id: string): Promise<Product | null> {
    const rows = await this.db.$queryRaw<RawLockedProductRow[]>`
      SELECT
        "id",
        "title",
        "artisan_id" AS "artisanId",
        "artisan_name" AS "artisanName",
        "hub",
        "technique",
        "price",
        "compare_at_price" AS "compareAtPrice",
        "image_url" AS "imageUrl",
        "image_alt" AS "imageAlt",
        "description",
        "details",
        "owner_email" AS "ownerEmail",
        "stock",
        "active",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "product"
      WHERE "id" = ${id}
      FOR UPDATE
    `

    if (!rows || rows.length === 0) {
      return null
    }

    return PrismaDomainMapper.toDomainProductFromRawLock(rows[0])
  }

  public async create(data: CreateProductData): Promise<Product> {
    const created = await this.db.product.create({
      data: {
        id: data.id,
        title: data.title,
        artisanId: data.artisanId ?? null,
        artisanName: data.artisanName,
        hub: data.hub,
        technique: data.technique,
        price: data.price,
        compareAtPrice: data.compareAtPrice ?? null,
        imageUrl: data.imageUrl,
        imageAlt: data.imageAlt,
        description: data.description ?? null,
        details: data.details ?? [],
        ownerEmail: data.ownerEmail.trim().toLowerCase(),
        stock: data.stock,
        active: data.active ?? true,
      },
    })
    return PrismaDomainMapper.toDomainProduct(created)
  }

  public async update(id: string, patch: UpdateProductData): Promise<Product> {
    const existing = await this.db.product.findUnique({ where: { id } })
    if (!existing) {
      throw new ProductNotFoundException(id)
    }

    const updated = await this.db.product.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.artisanId !== undefined ? { artisanId: patch.artisanId } : {}),
        ...(patch.artisanName !== undefined ? { artisanName: patch.artisanName } : {}),
        ...(patch.hub !== undefined ? { hub: patch.hub } : {}),
        ...(patch.technique !== undefined ? { technique: patch.technique } : {}),
        ...(patch.price !== undefined ? { price: patch.price } : {}),
        ...(patch.compareAtPrice !== undefined
          ? { compareAtPrice: patch.compareAtPrice }
          : {}),
        ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
        ...(patch.imageAlt !== undefined ? { imageAlt: patch.imageAlt } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.details !== undefined ? { details: patch.details } : {}),
        ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
      },
    })

    return PrismaDomainMapper.toDomainProduct(updated)
  }

  public async decrementStock(id: string, quantity: number): Promise<Product> {
    const updated = await this.db.product.update({
      where: { id },
      data: {
        stock: {
          decrement: quantity,
        },
      },
    })
    return PrismaDomainMapper.toDomainProduct(updated)
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.db.product.findUnique({ where: { id } })
    if (!existing) {
      throw new ProductNotFoundException(id)
    }
    await this.db.product.delete({ where: { id } })
  }
}

/**
 * Helper transacional direto conforme especificação do Tech Lead (Fase 2):
 * Adquire Lock Pessimista (`SELECT ... FOR UPDATE`), valida disponibilidade/saldo
 * e decrementa o estoque atomicamente na mesma transação Prisma.
 */
export async function reserveStockWithPessimisticLock(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
): Promise<Product> {
  const repo = new PrismaProductRepository(tx)
  const product = await repo.findByIdForUpdate(productId)

  if (!product) {
    throw new ProductUnavailableException(productId)
  }

  product.assertCanReserve(quantity)

  return repo.decrementStock(productId, quantity)
}

