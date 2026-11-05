import { DomainError } from './DomainError'

export class ProductNotFoundException extends DomainError {
  public readonly productId: string

  constructor(productId: string) {
    super('Produto não encontrado.', 'PRODUCT_NOT_FOUND', 404)
    this.productId = productId
  }
}

