import type { ArtisanSpotlight } from '@/data/mockArtisans'

export type Artisan = ArtisanSpotlight

const API_URL = import.meta.env.VITE_API_URL ?? 'https://origem-bnhv.onrender.com/api/v1'

interface ArtisanListResponse {
  dados: Artisan[]
}

/** Perfis públicos de artesãos consumidos pela Fake API. */
export const artisanService = {
  async list(): Promise<Artisan[]> {
    const response = await fetch(`${API_URL}/artesaos?limit=100`)
    if (!response.ok) throw new Error('Não foi possível carregar os artesãos.')
    const payload = (await response.json()) as ArtisanListResponse
    return payload.dados
  },

  async getById(id: string): Promise<Artisan> {
    const response = await fetch(`${API_URL}/artesaos/${encodeURIComponent(id)}`)
    if (!response.ok) throw new Error('Artesão não encontrado.')
    return response.json() as Promise<Artisan>
  },

  async create(data: Omit<Artisan, 'id'> & { email?: string }): Promise<Artisan> {
    const response = await fetch(`${API_URL}/artesaos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { erro?: string } | null
      throw new Error(payload?.erro ?? 'Não foi possível cadastrar o artesão.')
    }
    return response.json() as Promise<Artisan>
  },
}
