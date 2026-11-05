import { DomainError } from './DomainError'

/**
 * Lançada durante reservas de estoque quando uma peça do pedido foi removida
 * ou pausada (inativa) pelo artesão/admin (compatível com contratos-api.md HTTP 409).
 */
export class ProductUnavailableException extends DomainError {
  public readonly productId: string

  constructor(productId: string) {
    super(
      'Uma das peças do pedido não está mais disponível.',
      'PRODUCT_UNAVAILABLE',
      409,
    )
    this.productId = productId
  }
}

