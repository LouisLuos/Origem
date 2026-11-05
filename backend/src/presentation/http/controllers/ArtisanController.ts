import type { Request, Response } from 'express'
import { DomainError } from '../../../domain/errors'
import { IArtisanRepository } from '../../../domain/repositories/IArtisanRepository'

const REQUIRED_ARTISAN_FIELDS = [
  'name',
  'hub',
  'technique',
  'bio',
  'since',
  'photoUrl',
  'photoAlt',
  'coverUrl',
  'coverAlt',
] as const

export class ArtisanController {
  constructor(private readonly artisanRepository: IArtisanRepository) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20)
    const rawSearch = req.query.q ?? req.query.nome ?? req.query.search
    const search =
      typeof rawSearch === 'string' && rawSearch.trim() ? rawSearch.trim() : undefined
    const hub =
      typeof req.query.hub === 'string' && req.query.hub.trim()
        ? req.query.hub.trim()
        : undefined
    const technique =
      typeof req.query.technique === 'string' && req.query.technique.trim()
        ? req.query.technique.trim()
        : undefined

    const result = await this.artisanRepository.findAll({
      search,
      hub,
      technique,
      page,
      limit,
    })

    res.status(200).json({
      dados: result.items.map((artisan) => artisan.toPublicProfileDto()),
      meta: {
        totalItens: result.totalItems,
        paginaAtual: result.currentPage,
        totalPaginas: result.totalPages,
      },
    })
  }

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id)
    const artisan = await this.artisanRepository.findById(id)
    if (!artisan) {
      throw new DomainError('Artesão não encontrado.', 'ARTISAN_NOT_FOUND', 404)
    }
    res.status(200).json(artisan.toPublicProfileDto())
  }

  public create = async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>

    const missingField = REQUIRED_ARTISAN_FIELDS.find(
      (field) =>
        body[field] === undefined ||
        body[field] === null ||
        (typeof body[field] === 'string' && body[field].trim() === ''),
    )
    if (missingField) {
      throw new DomainError(`Campo obrigatório: ${missingField}.`, 'MISSING_FIELD', 400)
    }

    const id = `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
    const created = await this.artisanRepository.create({
      id,
      name: String(body.name).trim(),
      hub: String(body.hub).trim(),
      technique: String(body.technique).trim(),
      bio: String(body.bio).trim(),
      since: Number(body.since),
      photoUrl: String(body.photoUrl).trim(),
      photoAlt: String(body.photoAlt).trim(),
      coverUrl: String(body.coverUrl).trim(),
      coverAlt: String(body.coverAlt).trim(),
      email: typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null,
      phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
      workshopAddress:
        typeof body.workshopAddress === 'string' && body.workshopAddress.trim()
          ? body.workshopAddress.trim()
          : null,
      publicContactConsent:
        typeof body.publicContactConsent === 'boolean' ? body.publicContactConsent : false,
    })

    res.status(201).json(created.toPublicProfileDto())
  }
}

