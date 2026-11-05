import { DomainError } from './DomainError'

/**
 * Lançada quando o saldo em estoque sob Lock Pessimista (SELECT ... FOR UPDATE)
 * é inferior à quantidade solicitada no checkout ou reserva (RNF-01 / FCCPD).
 */
export class InsufficientStockException extends DomainError {
  public readonly productId: string
  public readonly productTitle: string
  public readonly requested: number
  public readonly available: number

  constructor(params: {
    productId: string
    productTitle: string
    requested: number
    available: number
  }) {
    super(
      `Estoque insuficiente para ${params.productTitle}.`,
      'INSUFFICIENT_STOCK',
      409,
    )
    this.productId = params.productId
    this.productTitle = params.productTitle
    this.requested = params.requested
    this.available = params.available
  }
}

