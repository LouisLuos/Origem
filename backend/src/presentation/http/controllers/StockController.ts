import type { Request, Response } from 'express'
import { StockReservationService } from '../../../application/services/StockReservationService'
import { DomainError } from '../../../domain/errors'

export class StockController {
  constructor(private readonly stockReservationService: StockReservationService) {}

  /**
   * `POST /api/v1/estoque/reservas`
   * Delega integralmente ao `StockReservationService`, garantindo Lock Pessimista
   * (`SELECT ... FOR UPDATE`), ordenação anti-deadlock e rollback ACID tudo-ou-nada.
   */
  public reserve = async (req: Request, res: Response): Promise<void> => {
    const lines = req.body?.lines
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new DomainError(
        'Informe ao menos uma linha de reserva.',
        'EMPTY_RESERVATION_LINES',
        400,
      )
    }

    const updatedProducts = await this.stockReservationService.reserveStock(
      lines.map((line: { productId?: unknown; quantity?: unknown }) => ({
        productId: String(line?.productId ?? ''),
        quantity: Number(line?.quantity),
      })),
    )

    res.status(200).json({
      dados: updatedProducts.map((item) => item.toCatalogDto()),
    })
  }
}

