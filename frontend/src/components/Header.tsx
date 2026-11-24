'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'
import { Container, Input, cn, currency } from '@/design-system'
import { matchesSearch } from '@/utils/text'
import { useProductFilter } from '@/context/ProductFilterContext'
import { useCatalog } from '@/context/CatalogContext'
import { useArtisans } from '@/context/ArtisanContext'
import logoUrl from '@/assets/logo-origem.png'

const MAX_SEARCH_RESULTS = 5
const MAX_ARTISAN_SEARCH_RESULTS = 3

const navLinks = [
  { label: 'Categorias', href: '/#categorias' },
  { label: 'Produtos', href: '/#vitrine' },
  { label: 'Laboratório de desempenho', href: '/laboratorio-de-desempenho' },
  { label: 'Artesãos', href: '/#artesaos' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { query, setQuery } = useProductFilter()
  const { products } = useCatalog()
  const { artisans } = useArtisans()
  const router = useRouter()
  const pathname = usePathname()
  const isHome = pathname === '/'

  const hasQuery = query.trim().length > 0
  const searchResults = useMemo(() => {
    if (!hasQuery) return []
    return products
      .filter((product) => matchesSearch(query, [product.title, product.artisan, product.hub, product.technique]))
      .slice(0, MAX_SEARCH_RESULTS)
  }, [hasQuery, query, products])

  const artisanSearchResults = useMemo(() => {
    if (!hasQuery) return []
    return artisans
      .filter((artisan) => matchesSearch(query, [artisan.name, artisan.hub, artisan.technique]))
      .slice(0, MAX_ARTISAN_SEARCH_RESULTS)
  }, [artisans, hasQuery, query])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus()
  }, [isSearchOpen])

  useEffect(() => {
    if (!isSearchOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSearchOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  const isSolid = isScrolled || isMenuOpen || isSearchOpen || !isHome

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        isSolid ? 'border-b border-border/70 bg-creme/80 backdrop-blur' : 'border-b border-transparent bg-transparent',
      )}
    >
      <Container className="flex h-20 items-center justify-between gap-4">
        <Link href="/#top" className="flex shrink-0 items-center gap-2" aria-label="Página inicial da Origem">
          <Image
            src={logoUrl}
            alt="Origem"
            preload
            className={cn('h-10 w-auto transition-[filter] duration-300', !isSolid && 'brightness-0 invert')}
          />
        </Link>

        <nav aria-label="Navegação principal" className="hidden lg:block">
            <ul className={cn('flex items-center gap-8 font-medium', isSolid ? 'text-ink' : 'text-creme-50')}>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors duration-300 hover:text-terracota-400">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
        </nav>

        <div className={cn('flex items-center gap-1', isSolid ? 'text-aubergine' : 'text-creme-50')}>
          <button
            type="button"
            aria-label={isSearchOpen ? 'Fechar busca' : 'Buscar peças, técnicas ou artesãos'}
            aria-expanded={isSearchOpen}
            aria-controls="header-search-bar"
            onClick={() => {
              setIsSearchOpen((open) => !open)
              setIsMenuOpen(false)
            }}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full transition-colors cursor-pointer',
              isSolid ? 'hover:bg-aubergine/5' : 'hover:bg-creme-50/10',
            )}
          >
            {isSearchOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
          </button>

          <button
            type="button"
            aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => {
              setIsMenuOpen((open) => !open)
              setIsSearchOpen(false)
            }}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden cursor-pointer',
              isSolid ? 'hover:bg-aubergine/5' : 'hover:bg-creme-50/10',
            )}
          >
            {isMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </Container>

      {isSearchOpen && (
        <div id="header-search-bar" className="border-t border-border/70 bg-creme">
          <Container className="py-4">
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                setIsSearchOpen(false)
                router.push('/#vitrine')
              }}
            >
              <Input
                ref={searchInputRef}
                type="search"
                label="Buscar peças, técnicas ou artesãos"
                hideLabel
                placeholder="Buscar peças, técnicas, artesãos..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>

            {hasQuery && (
              <div className="mt-3 border-t border-border/70 pt-3">
                {searchResults.length > 0 || artisanSearchResults.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {searchResults.length > 0 && (
                      <div>
                        <p className="pb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Peças</p>
                        <ul className="flex flex-col divide-y divide-border/60">
                          {searchResults.map((product) => (
                            <li key={product.id} className="flex items-center gap-1">
                              <Link
                                href={`/produtos/${product.id}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="-ml-2 flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5 transition-colors hover:bg-aubergine/10 hover:text-terracota-600"
                              >
                                <img
                                  src={product.imageUrl}
                                  alt=""
                                  aria-hidden="true"
                                  className="h-12 w-12 shrink-0 bg-surface-muted object-cover"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate text-sm font-medium text-ink">{product.title}</span>
                                  <span className="truncate text-xs text-ink-soft">
                                    {product.technique} · por {product.artisan}
                                  </span>
                                </span>
                                <span className="shrink-0 text-sm font-medium text-ink-soft">
                                  {currency.format(product.price)}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {artisanSearchResults.length > 0 && (
                      <div>
                        <p className="pb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Artesãos</p>
                        <ul className="flex flex-col divide-y divide-border/60">
                          {artisanSearchResults.map((artisan) => (
                            <li key={artisan.id} className="flex items-center gap-1">
                              <Link
                                href={`/artesaos/${artisan.id}`}
                                onClick={() => setIsSearchOpen(false)}
                                className="-ml-2 flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5 transition-colors hover:bg-aubergine/10 hover:text-terracota-600"
                              >
                                <img
                                  src={artisan.photoUrl}
                                  alt=""
                                  aria-hidden="true"
                                  className="h-12 w-12 shrink-0 bg-surface-muted object-cover object-top"
                                />
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate text-sm font-medium text-ink">{artisan.name}</span>
                                  <span className="truncate text-xs text-ink-soft">
                                    {artisan.technique} · {artisan.hub}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="py-3 text-sm text-ink-soft">Nenhuma peça encontrada para &quot;{query}&quot;.</p>
                )}
              </div>
            )}
          </Container>
        </div>
      )}

      {isMenuOpen && (
        <nav id="mobile-menu" aria-label="Navegação principal (móvel)" className="border-t border-border/70 bg-creme lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="px-2 py-3 font-medium text-ink transition-colors hover:bg-aubergine/5 hover:text-terracota-600"
              >
                {link.label}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  )
}
