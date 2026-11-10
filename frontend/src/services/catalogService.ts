import type { Product } from '@/design-system/components/ProductCard'
import { apiRequest } from './api'

export interface CatalogItem extends Product {
  /** E-mail da conta de artesão dona da peça. */
  ownerEmail: string
  stock: number
  /** Peças pausadas ficam fora da vitrine pública. */
  active: boolean
}

export type CatalogItemInput = Omit<CatalogItem, 'id' | 'ownerEmail' | 'artisan'>

export interface Owner {
  email: string
  name: string
}

export interface StockReservation {
  productId: string
  quantity: number
}

interface ProductListResponse {
  dados: CatalogItem[]
}

function request<T>(path: string, options?: RequestInit) {
  return apiRequest<T>(path, options, 'Não foi possível concluir a operação no catálogo.')
}

/**
 * Catálogo e estoque. Equivalente a `GET/POST /produtos`, `PATCH/DELETE /produtos/:id`
 * e `POST /estoque/reservas`. É a fonte única da vitrine, dos painéis do artesão e da administração.
 */
export const catalogService = {
  async list(): Promise<CatalogItem[]> {
    const response = await request<ProductListResponse>('/produtos?limit=100')
    return response.dados
  },

  async get(id: string): Promise<CatalogItem> {
    return request<CatalogItem>(`/produtos/${encodeURIComponent(id)}`)
  },

  async create(owner: Owner, input: CatalogItemInput): Promise<CatalogItem> {
    return request<CatalogItem>('/produtos', {
      method: 'POST',
      body: JSON.stringify({ ...input, ownerEmail: owner.email, artisan: owner.name }),
    })
  },

  async update(id: string, patch: Partial<CatalogItemInput>): Promise<CatalogItem> {
    return request<CatalogItem>(`/produtos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },

  /** Soma `delta` ao estoque atual (sem sobrescrever), para que cliques rápidos não se percam. */
  async adjustStock(id: string, delta: number): Promise<CatalogItem> {
    const current = await catalogService.get(id)
    return request<CatalogItem>(`/produtos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock: Math.max(0, current.stock + delta) }),
    })
  },

  async remove(id: string): Promise<void> {
    await request<void>(`/produtos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  /** Baixa o estoque de um pedido. Falha, sem alterar nada, se alguma peça não tiver saldo. */
  async reserveStock(lines: StockReservation[]): Promise<CatalogItem[]> {
    const response = await request<ProductListResponse>('/estoque/reservas', {
      method: 'POST',
      body: JSON.stringify({ lines }),
    })
    return response.dados
  },
}
