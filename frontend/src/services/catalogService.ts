import { catalogRequest } from './catalogRequest'
import type { CatalogItem } from './catalogTypes'

interface ProductListResponse {
  dados: CatalogItem[]
}

/**
 * Consultas públicas do catálogo usadas pela vitrine e pela página de produto.
 */
export const catalogService = {
  async list(): Promise<CatalogItem[]> {
    const response = await catalogRequest<ProductListResponse>('/produtos?limit=100')
    return response.dados
  },

  async get(id: string): Promise<CatalogItem> {
    return catalogRequest<CatalogItem>(`/produtos/${encodeURIComponent(id)}`)
  },
}
