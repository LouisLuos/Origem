import type { Product } from '@/design-system/components/ProductCard'
import type { Artisan } from '@/services/artisanService'

function normalizeArtisanName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function findArtisanOf(
  product: Pick<Product, 'artisan'> & { artisanId?: string | null },
  artisans: Artisan[],
): Artisan | undefined {
  if (!product) return undefined

  const artisanId = product.artisanId?.trim()
  if (artisanId) {
    return artisans.find((artisan) => artisan.id === artisanId)
  }

  const normalizedProductArtisan = normalizeArtisanName(product.artisan ?? '')
  if (!normalizedProductArtisan) {
    return undefined
  }

  return (
    artisans.find((artisan) => normalizeArtisanName(artisan.name) === normalizedProductArtisan) ??
    artisans.find((artisan) => artisan.name === product.artisan)
  )
}
