import type { Product } from '@/design-system/components/ProductCard'

export interface CatalogItem extends Product {
  /** Identificador estável do artesão titular da peça. */
  artisanId?: string
  category?: string
  stock: number
  /** Peças pausadas ficam fora da vitrine pública. */
  active: boolean
}
