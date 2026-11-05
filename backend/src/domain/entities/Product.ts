import {
  DomainError,
  InsufficientStockException,
  ProductUnavailableException,
} from '../errors'

/**
 * Representação pura da entidade Produto no Domínio (RNF-04).
 */
export interface ProductProps {
  id: string
  title: string
  artisanId?: string | null
  artisanName: string
  hub: string
  technique: string
  price: number
  compareAtPrice?: number | null
  imageUrl: string
  imageAlt: string
  description?: string | null
  details: string[]
  ownerEmail: string
  stock: number
  active: boolean
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Formato serializado 100% compatível com o contrato `CatalogItem` do Frontend
 * e `docs/05-desenvolvimento-web/contratos-api.md`.
 */
export interface PublicCatalogProductDto {
  id: string
  title: string
  artisan: string
  hub: string
  technique: string
  price: number
  compareAtPrice?: number
  imageUrl: string
  imageAlt: string
  description?: string
  details: string[]
  ownerEmail: string
  stock: number
  active: boolean
}

export class Product {
  public readonly id: string
  public readonly title: string
  public readonly artisanId: string | null
  public readonly artisanName: string
  public readonly hub: string
  public readonly technique: string
  public readonly price: number
  public readonly compareAtPrice: number | null
  public readonly imageUrl: string
  public readonly imageAlt: string
  public readonly description: string | null
  public readonly details: string[]
  public readonly ownerEmail: string
  public readonly stock: number
  public readonly active: boolean
  public readonly createdAt?: Date
  public readonly updatedAt?: Date

  constructor(props: ProductProps) {
    if (!Number.isInteger(props.stock) || props.stock < 0) {
      throw new DomainError(
        'O estoque do produto deve ser um número inteiro não negativo.',
        'INVALID_STOCK',
        400,
      )
    }
    if (props.price < 0) {
      throw new DomainError(
        'O preço do produto não pode ser negativo.',
        'INVALID_PRICE',
        400,
      )
    }
    if (!props.imageAlt || props.imageAlt.trim().length === 0) {
      throw new DomainError(
        'Texto alternativo descritivo (imageAlt) é obrigatório para acessibilidade (RNF-07 / WCAG 2.1 AA).',
        'MISSING_IMAGE_ALT',
        400,
      )
    }

    this.id = props.id
    this.title = props.title
    this.artisanId = props.artisanId ?? null
    this.artisanName = props.artisanName
    this.hub = props.hub
    this.technique = props.technique
    this.price = props.price
    this.compareAtPrice = props.compareAtPrice ?? null
    this.imageUrl = props.imageUrl
    this.imageAlt = props.imageAlt
    this.description = props.description ?? null
    this.details = [...props.details]
    this.ownerEmail = props.ownerEmail.trim().toLowerCase()
    this.stock = props.stock
    this.active = props.active
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }

  /**
   * Invariante de reserva de estoque (RNF-01 / FCCPD).
   * Deve ser invocada sobre a instância carregada com Lock Pessimista (SELECT ... FOR UPDATE).
   */
  public assertCanReserve(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new DomainError(
        'A quantidade solicitada para reserva deve ser um inteiro positivo.',
        'INVALID_QUANTITY',
        400,
      )
    }
    if (!this.active) {
      throw new ProductUnavailableException(this.id)
    }
    if (this.stock < quantity) {
      throw new InsufficientStockException({
        productId: this.id,
        productTitle: this.title,
        requested: quantity,
        available: this.stock,
      })
    }
  }

  public toCatalogDto(): PublicCatalogProductDto {
    return {
      id: this.id,
      title: this.title,
      artisan: this.artisanName,
      hub: this.hub,
      technique: this.technique,
      price: this.price,
      ...(this.compareAtPrice !== null && this.compareAtPrice > 0
        ? { compareAtPrice: this.compareAtPrice }
        : {}),
      imageUrl: this.imageUrl,
      imageAlt: this.imageAlt,
      ...(this.description ? { description: this.description } : {}),
      details: [...this.details],
      ownerEmail: this.ownerEmail,
      stock: this.stock,
      active: this.active,
    }
  }
}

