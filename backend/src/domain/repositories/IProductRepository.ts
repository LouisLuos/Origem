import { Product, ProductProps } from '../entities/Product'

export interface ProductQueryFilter {
  technique?: string
  hub?: string
  onlyActive?: boolean
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  items: T[]
  totalItems: number
  currentPage: number
  totalPages: number
}

export type CreateProductData = Omit<ProductProps, 'createdAt' | 'updatedAt'>

export type UpdateProductData = Partial<
  Omit<ProductProps, 'id' | 'ownerEmail' | 'createdAt' | 'updatedAt'>
>

/**
 * Porta de persistência para Produtos (Clean Architecture / Hexagonal).
 */
export interface IProductRepository {
  findAll(filter?: ProductQueryFilter): Promise<PaginatedResult<Product>>
  findById(id: string): Promise<Product | null>

  /**
   * Adquire bloqueio pessimista exclusivo de linha no PostgreSQL (`SELECT ... FOR UPDATE`)
   * dentro de uma transação ACID ativa (RNF-01 / Rubrica FCCPD).
   */
  findByIdForUpdate(id: string): Promise<Product | null>

  create(data: CreateProductData): Promise<Product>
  update(id: string, patch: UpdateProductData): Promise<Product>
  decrementStock(id: string, quantity: number): Promise<Product>
  delete(id: string): Promise<void>
}

