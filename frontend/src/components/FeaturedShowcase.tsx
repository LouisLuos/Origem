import { useEffect, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Container, ProductCard } from '@/design-system'
import { allProducts } from '@/data/mockProducts'
import { priceRangeOptions, useProductFilter } from '@/context/ProductFilterContext'
import { useCart } from '@/context/CartContext'
import { ProductFilters } from './ProductFilters'

const PAGE_SIZE = 9

type SortOption = 'relevancia' | 'preco-asc' | 'preco-desc' | 'nome-asc'

const sortOptions: { id: SortOption; label: string }[] = [
  { id: 'relevancia', label: 'Relevância' },
  { id: 'preco-asc', label: 'Menor preço' },
  { id: 'preco-desc', label: 'Maior preço' },
  { id: 'nome-asc', label: 'Nome (A-Z)' },
]

export function FeaturedShowcase() {
  const {
    query,
    techniques,
    toggleTechnique,
    hubs,
    toggleHub,
    priceRanges,
    togglePriceRange,
    clearFilters,
    hasActiveFilters,
    matchesFilters,
  } = useProductFilter()
  const { addItem } = useCart()
  const [sort, setSort] = useState<SortOption>('relevancia')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filteredProducts = allProducts.filter(matchesFilters)
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sort === 'preco-asc') return a.price - b.price
    if (sort === 'preco-desc') return b.price - a.price
    if (sort === 'nome-asc') return a.title.localeCompare(b.title, 'pt-BR')
    return 0
  })

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query, techniques, hubs, priceRanges, sort])

  const visibleProducts = sortedProducts.slice(0, visibleCount)

  const activeFilterChips = [
    ...techniques.map((value) => ({ value, label: value, onRemove: () => toggleTechnique(value) })),
    ...hubs.map((value) => ({ value, label: value, onRemove: () => toggleHub(value) })),
    ...priceRanges.map((id) => ({
      value: id,
      label: priceRangeOptions.find((range) => range.id === id)?.label ?? id,
      onRemove: () => togglePriceRange(id),
    })),
  ]

  return (
    <section id="vitrine" className="py-16 sm:py-20">
      <Container className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <ProductFilters />

        <div className="flex flex-1 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {hasActiveFilters ? (
                <>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-ink-soft underline-offset-4 hover:text-terracota-600 hover:underline"
                  >
                    Limpar tudo
                  </button>
                  {activeFilterChips.map((chip) => (
                    <button
                      type="button"
                      key={chip.value}
                      onClick={chip.onRemove}
                      className="flex cursor-pointer items-center gap-1 border border-border px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-terracota-400 hover:text-terracota-600"
                    >
                      {chip.label}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ))}
                </>
              ) : (
                <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Todas as peças</span>
              )}
            </div>

            <div className="relative shrink-0">
              <select
                aria-label="Ordenar por"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
                className="cursor-pointer appearance-none border border-border bg-surface py-2 pl-3 pr-8 text-xs font-semibold uppercase tracking-widest text-ink-soft transition-colors hover:border-terracota-400 hover:text-ink focus:border-terracota focus:outline-none"
              >
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft"
                aria-hidden="true"
              />
            </div>
          </div>

          {visibleProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={addItem} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-ink-soft">
              Nenhuma peça encontrada para esta busca ou filtro.
            </p>
          )}

          {visibleProducts.length > 0 && (
            <div className="flex flex-col items-center gap-4 pt-2">
              <span className="text-xs text-ink-soft">
                Mostrando {visibleProducts.length} de {filteredProducts.length} peças
              </span>

              {visibleCount < filteredProducts.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  className="cursor-pointer bg-aubergine px-8 py-3 text-sm font-semibold text-creme-50 transition-colors hover:bg-aubergine-400"
                >
                  Carregar mais
                </button>
              )}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}
