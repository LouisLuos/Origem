import { catalogRequest } from './catalogRequest'
import { catalogService } from './catalogService'
import type { CatalogItem, StockReservation } from './catalogTypes'

interface ProductListResponse {
  dados: CatalogItem[]
}

/** Stock adjustments and reservations for catalog and checkout flows. */
export const stockService = {
  /** Adds `delta` to the current stock, keeping the existing client-side behavior. */
  async adjustStock(id: string, delta: number): Promise<CatalogItem> {
    const current = await catalogService.get(id)
    return catalogRequest<CatalogItem>(`/produtos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock: Math.max(0, current.stock + delta) }),
    })
  },

  /** Reserves stock for an order; atomicity depends on the backend implementation. */
  async reserveStock(lines: StockReservation[]): Promise<CatalogItem[]> {
    const response = await catalogRequest<ProductListResponse>('/estoque/reservas', {
      method: 'POST',
      body: JSON.stringify({ lines }),
    })
    return response.dados
  },
}
