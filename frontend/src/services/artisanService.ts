import { apiRequest } from './api'

export interface Artisan {
  id: string
  name: string
  hub: string
  technique: string
  bio: string
  since: number
  photoUrl: string
  photoAlt: string
  coverUrl: string
  coverAlt: string
}

interface ArtisanListResponse {
  dados: Artisan[]
}

/** Perfis públicos de artesãos consumidos pela Fake API. */
export const artisanService = {
  async list(): Promise<Artisan[]> {
    const response = await apiRequest<ArtisanListResponse>('/artesaos?limit=100', undefined, 'Não foi possível carregar os artesãos.')
    return response.dados
  },

  async get(id: string): Promise<Artisan> {
    return apiRequest<Artisan>(`/artesaos/${encodeURIComponent(id)}`, undefined, 'Artesão não encontrado.')
  },

  async create(data: Omit<Artisan, 'id'> & { email?: string }): Promise<Artisan> {
    return apiRequest<Artisan>('/artesaos', { method: 'POST', body: JSON.stringify(data) }, 'Não foi possível cadastrar o artesão.')
  },
}
