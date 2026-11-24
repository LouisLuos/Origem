import { apiRequest } from './api'
import type { CatalogItem } from './catalogTypes'

export interface Artisan {
  id: string
  name: string
  hub: string
  technique: string
  bio: string
  since?: number | null
  photoUrl: string
  photoAlt: string
  coverUrl: string
  coverAlt: string
  pieces?: CatalogItem[]
}

interface ArtisanListResponse {
  dados: Artisan[]
}

/** Perfis públicos de artesãos consumidos do Catalog Service. */
export const artisanService = {
  async list(): Promise<Artisan[]> {
    const response = await apiRequest<ArtisanListResponse>(
      '/artesaos?limit=100',
      undefined,
      'Não foi possível carregar os artesãos.',
    )
    return response.dados
  },

  async get(id: string): Promise<Artisan> {
    return apiRequest<Artisan>(
      `/artesaos/${encodeURIComponent(id)}`,
      undefined,
      'Artesão não encontrado.',
    )
  },
}
