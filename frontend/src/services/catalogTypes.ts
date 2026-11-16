import type { Product } from '@/design-system/components/ProductCard'

export interface CatalogItem extends Product {
  /** E-mail opcional da conta de artesão dona da peça (legado). */
  ownerEmail?: string
  /** Identificador estável do artesão titular da peça. */
  artisanId?: string
  stock: number
  /** Peças pausadas ficam fora da vitrine pública. */
  active: boolean
}

export type CatalogItemInput = Omit<CatalogItem, 'id' | 'ownerEmail' | 'artisan' | 'artisanId'>

export interface Owner {
  email: string
  name: string
}

export interface StockReservation {
  productId: string
  quantity: number
}
