import { catalogRequest } from './catalogRequest'
import type { CatalogItem } from './catalogTypes'

interface ProductListResponse {
  dados: CatalogItem[]
}

export interface CatalogListQuery {
  q?: string
  hub?: string
  technique?: string
  apenasDisponiveis?: boolean
  limit?: number
  page?: number
}

/**
 * Consultas públicas do catálogo usadas pela vitrine e pela página de produto (HU-07).
 */
export const catalogService = {
  async list(query?: CatalogListQuery): Promise<CatalogItem[]> {
    const params = new URLSearchParams()
    params.set('limit', String(query?.limit ?? 100))
    if (query?.page) params.set('page', String(query.page))
    if (query?.q?.trim()) params.set('q', query.q.trim())
    if (query?.hub?.trim()) params.set('hub', query.hub.trim())
    if (query?.technique?.trim()) params.set('technique', query.technique.trim())
    if (query?.apenasDisponiveis !== undefined) {
      params.set('apenasDisponiveis', String(query.apenasDisponiveis))
    }

    const response = await catalogRequest<ProductListResponse>(`/produtos?${params.toString()}`)
    return response.dados
  },

  async get(id: string): Promise<CatalogItem> {
    return catalogRequest<CatalogItem>(`/produtos/${encodeURIComponent(id)}`)
  },
}
