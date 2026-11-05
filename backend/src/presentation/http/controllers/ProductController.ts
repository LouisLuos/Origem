import type { Request, Response } from 'express'
import { DomainError, ProductNotFoundException } from '../../../domain/errors'
import { IProductRepository } from '../../../domain/repositories/IProductRepository'

const REQUIRED_CREATE_FIELDS = [
  'title',
  'artisan',
  'hub',
  'technique',
  'price',
  'imageUrl',
  'imageAlt',
  'ownerEmail',
  'stock',
] as const

export class ProductController {
  constructor(private readonly productRepository: IProductRepository) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = Math.max(1, Number.parseInt(String(req.query.limit ?? '10'), 10) || 10)
    const technique =
      typeof req.query.technique === 'string' && req.query.technique.trim()
        ? req.query.technique.trim()
        : typeof req.query.categoria === 'string' && req.query.categoria.trim()
          ? req.query.categoria.trim()
          : undefined
    const hub =
      typeof req.query.hub === 'string' && req.query.hub.trim()
        ? req.query.hub.trim()
        : undefined
    const onlyActive =
      req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined

    const result = await this.productRepository.findAll({
      technique,
      hub,
      onlyActive,
      page,
      limit,
    })

    res.status(200).json({
      dados: result.items.map((item) => item.toCatalogDto()),
      meta: {
        totalItens: result.totalItems,
        paginaAtual: result.currentPage,
        totalPaginas: result.totalPages,
      },
    })
  }

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id)
    const product = await this.productRepository.findById(id)
    if (!product) {
      throw new ProductNotFoundException(id)
    }
    res.status(200).json(product.toCatalogDto())
  }

  public create = async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>

    const missingField = REQUIRED_CREATE_FIELDS.find(
      (field) =>
        body[field] === undefined ||
        body[field] === null ||
        (typeof body[field] === 'string' && body[field].trim() === ''),
    )
    if (missingField) {
      throw new DomainError(`Campo obrigatório: ${missingField}.`, 'MISSING_FIELD', 400)
    }

    const id = `api-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
    const created = await this.productRepository.create({
      id,
      title: String(body.title).trim(),
      artisanId: typeof body.artisanId === 'string' ? body.artisanId : null,
      artisanName: String(body.artisan).trim(),
      hub: String(body.hub).trim(),
      technique: String(body.technique).trim(),
      price: Number(body.price),
      compareAtPrice:
        body.compareAtPrice !== undefined && body.compareAtPrice !== null
          ? Number(body.compareAtPrice)
          : null,
      imageUrl: String(body.imageUrl).trim(),
      imageAlt: String(body.imageAlt).trim(),
      description: typeof body.description === 'string' ? body.description : null,
      details: Array.isArray(body.details) ? body.details.map(String) : [],
      ownerEmail: String(body.ownerEmail).trim().toLowerCase(),
      stock: Number(body.stock),
      active: typeof body.active === 'boolean' ? body.active : true,
    })

    res.status(201).json(created.toCatalogDto())
  }

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>

    const updated = await this.productRepository.update(id, {
      ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
      ...(typeof body.artisan === 'string' ? { artisanName: body.artisan.trim() } : {}),
      ...(typeof body.artisanName === 'string'
        ? { artisanName: body.artisanName.trim() }
        : {}),
      ...(typeof body.hub === 'string' ? { hub: body.hub.trim() } : {}),
      ...(typeof body.technique === 'string' ? { technique: body.technique.trim() } : {}),
      ...(body.price !== undefined ? { price: Number(body.price) } : {}),
      ...(body.compareAtPrice !== undefined
        ? {
            compareAtPrice:
              body.compareAtPrice === null ? null : Number(body.compareAtPrice),
          }
        : {}),
      ...(typeof body.imageUrl === 'string' ? { imageUrl: body.imageUrl.trim() } : {}),
      ...(typeof body.imageAlt === 'string' ? { imageAlt: body.imageAlt.trim() } : {}),
      ...(body.description !== undefined
        ? { description: body.description === null ? null : String(body.description) }
        : {}),
      ...(Array.isArray(body.details) ? { details: body.details.map(String) } : {}),
      ...(body.stock !== undefined ? { stock: Number(body.stock) } : {}),
      ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
    })

    res.status(200).json(updated.toCatalogDto())
  }

  public remove = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id)
    await this.productRepository.delete(id)
    res.status(204).send()
  }
}

