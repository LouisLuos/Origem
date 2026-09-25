import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Product } from '@/design-system/components/ProductCard'

export interface PriceRangeOption {
  id: string
  label: string
  test: (price: number) => boolean
}

export const priceRangeOptions: PriceRangeOption[] = [
  { id: 'ate-100', label: 'Até R$ 100', test: (price) => price <= 100 },
  { id: '100-300', label: 'R$ 100 a R$ 300', test: (price) => price > 100 && price <= 300 },
  { id: 'acima-300', label: 'Acima de R$ 300', test: (price) => price > 300 },
]

export interface ProductFilterContextValue {
  query: string
  setQuery: (value: string) => void
  techniques: string[]
  toggleTechnique: (technique: string) => void
  hubs: string[]
  toggleHub: (hub: string) => void
  priceRanges: string[]
  togglePriceRange: (id: string) => void
  selectTechnique: (technique: string) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  matchesFilters: (product: Product) => boolean
}

const ProductFilterContext = createContext<ProductFilterContextValue | null>(null)

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/** Estado global de busca/filtro da vitrine, compartilhado entre `Header`, `CategoryShowcase` e `FeaturedShowcase` (RF-CAT-02). */
export function ProductFilterProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')
  const [techniques, setTechniques] = useState<string[]>([])
  const [hubs, setHubs] = useState<string[]>([])
  const [priceRanges, setPriceRanges] = useState<string[]>([])

  const toggleTechnique = (technique: string) => setTechniques((prev) => toggleValue(prev, technique))
  const toggleHub = (hub: string) => setHubs((prev) => toggleValue(prev, hub))
  const togglePriceRange = (id: string) => setPriceRanges((prev) => toggleValue(prev, id))

  const selectTechnique = (technique: string) => {
    setQuery('')
    setHubs([])
    setPriceRanges([])
    setTechniques([technique])
  }

  const clearFilters = () => {
    setTechniques([])
    setHubs([])
    setPriceRanges([])
  }

  const hasActiveFilters = techniques.length > 0 || hubs.length > 0 || priceRanges.length > 0

  const matchesFilters = (product: Product) => {
    const normalizedQuery = query.trim().toLowerCase()

    const matchesQuery =
      !normalizedQuery ||
      [product.title, product.artisan, product.hub, product.technique].some((field) =>
        field.toLowerCase().includes(normalizedQuery),
      )

    const matchesTechnique = techniques.length === 0 || techniques.includes(product.technique)
    const matchesHub = hubs.length === 0 || hubs.includes(product.hub)
    const matchesPrice =
      priceRanges.length === 0 ||
      priceRangeOptions.some((range) => priceRanges.includes(range.id) && range.test(product.price))

    return matchesQuery && matchesTechnique && matchesHub && matchesPrice
  }

  const value = useMemo<ProductFilterContextValue>(
    () => ({
      query,
      setQuery,
      techniques,
      toggleTechnique,
      hubs,
      toggleHub,
      priceRanges,
      togglePriceRange,
      selectTechnique,
      clearFilters,
      hasActiveFilters,
      matchesFilters,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, techniques, hubs, priceRanges],
  )

  return <ProductFilterContext.Provider value={value}>{children}</ProductFilterContext.Provider>
}

export function useProductFilter() {
  const context = useContext(ProductFilterContext)
  if (!context) {
    throw new Error('useProductFilter deve ser usado dentro de um ProductFilterProvider')
  }
  return context
}
