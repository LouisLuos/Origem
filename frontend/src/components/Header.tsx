import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Heart, Menu, Search, ShoppingBag, Trash2, User, X } from 'lucide-react'
import { Button, Container, Input, cn, currency } from '@/design-system'
import { useProductFilter } from '@/context/ProductFilterContext'
import { useCart } from '@/context/CartContext'
import { useAuth } from '@/context/AuthContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useCatalog } from '@/context/CatalogContext'
import type { CatalogItem } from '@/context/CatalogContext'
import logoUrl from '@/assets/logo-origem.png'

const MAX_SEARCH_RESULTS = 5

const navLinks = [
  { label: 'Categorias', href: '/#categorias' },
  { label: 'Produtos', href: '/#vitrine' },
  { label: 'Artesãos', href: '/#artesaos' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cartRef = useRef<HTMLDivElement>(null)
  const { query, setQuery } = useProductFilter()
  const { user } = useAuth()
  const { products } = useCatalog()
  const { favorites } = useFavorites()
  const { items: cartItems, itemCount: cartCount, addItem, removeItem } = useCart()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  // Incrementa a cada item adicionado; usado como `key` para reiniciar a animação.
  const [cartBumpKey, setCartBumpKey] = useState(0)
  const previousCartCount = useRef(cartCount)
  useEffect(() => {
    if (cartCount > previousCartCount.current) setCartBumpKey((key) => key + 1)
    previousCartCount.current = cartCount
  }, [cartCount])

  const cartLines = cartItems
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.id)
      return product ? { product, quantity: item.quantity } : null
    })
    .filter((line): line is { product: CatalogItem; quantity: number } => line !== null)
  const cartSubtotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0)

  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return []
    return products
      .filter((product) =>
        [product.title, product.artisan, product.hub, product.technique].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        ),
      )
      .slice(0, MAX_SEARCH_RESULTS)
  }, [normalizedQuery, products])

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

  useEffect(() => {
    if (!isCartOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCartOpen(false)
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(event.target as Node)) setIsCartOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCartOpen])

  const isSolid = isScrolled || isMenuOpen || isSearchOpen || !isHome

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        isSolid ? 'border-b border-border/70 bg-creme/80 backdrop-blur' : 'border-b border-transparent bg-transparent',
      )}
    >
      <Container className="flex h-20 items-center justify-between gap-4">
        <Link to="/#top" className="flex shrink-0 items-center gap-2" aria-label="Página inicial da Origem">
          <img
            src={logoUrl}
            alt="Origem"
            className={cn('h-10 w-auto transition-[filter] duration-300', !isSolid && 'brightness-0 invert')}
          />
        </Link>

        <nav aria-label="Navegação principal" className="hidden lg:block">
          <ul className={cn('flex items-center gap-8 font-medium', isSolid ? 'text-ink' : 'text-creme-50 ')}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link to={link.href} className="transition-colors duration-300 hover:text-terracota-400">
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
              setIsCartOpen(false)
            }}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full transition-colors cursor-pointer',
              isSolid ? 'hover:bg-aubergine/5' : 'hover:bg-creme-50/10',
            )}
          >
            {isSearchOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
          </button>
          <Link
            to="/favoritos"
            aria-label={`Meus favoritos, ${favorites.length} ${favorites.length === 1 ? 'item' : 'itens'}`}
            className={cn(
              'relative hidden h-11 w-11 items-center justify-center rounded-full transition-colors sm:flex cursor-pointer',
              isSolid ? 'hover:bg-aubergine/5' : 'hover:bg-creme-50/10',
            )}
          >
            <Heart className="h-5 w-5" aria-hidden="true" />
            {favorites.length > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracota-500 px-1 text-[10px] font-semibold leading-none text-creme"
              >
                {favorites.length > 99 ? '99+' : favorites.length}
              </span>
            )}
          </Link>
          <Link
            to={user ? '/conta' : '/entrar'}
            aria-label={user ? 'Minha conta' : 'Entrar ou criar conta'}
            className={cn(
              'hidden h-11 w-11 items-center justify-center rounded-full transition-colors sm:flex cursor-pointer',
              isSolid ? 'hover:bg-aubergine/5' : 'hover:bg-creme-50/10',
            )}
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div ref={cartRef} className="relative">
            <button
              type="button"
              aria-label={`Ver carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}`}
              aria-expanded={isCartOpen}
              aria-controls="header-cart-panel"
              onClick={() => {
                setIsCartOpen((open) => !open)
                setIsSearchOpen(false)
                setIsMenuOpen(false)
              }}
              className={cn(
                'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors cursor-pointer',
                isSolid ? 'hover:bg-aubergine/5' : 'hover:bg-creme-50/10',
              )}
            >
              <ShoppingBag
                key={`bag-${cartBumpKey}`}
                className={cn('h-5 w-5', cartBumpKey > 0 && 'animate-bag-bump')}
                aria-hidden="true"
              />
              {cartCount > 0 && (
                <span
                  key={`badge-${cartBumpKey}`}
                  aria-hidden="true"
                  className="animate-badge-pop absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracota-500 px-1 text-[10px] font-semibold leading-none text-creme"
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>

            {isCartOpen && (
              <div
                id="header-cart-panel"
                className="absolute right-0 top-full mt-3 w-[90vw] max-w-sm border border-border bg-creme text-ink shadow-lift"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-sm font-semibold uppercase tracking-widest">Carrinho</span>
                  <span className="text-xs text-ink-soft">
                    {cartCount} {cartCount === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {cartLines.length > 0 ? (
                  <>
                    <ul className="flex max-h-80 flex-col divide-y divide-border/60 overflow-y-auto">
                      {cartLines.map(({ product, quantity }) => (
                        <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                          <Link
                            to={`/produtos/${product.id}`}
                            onClick={() => setIsCartOpen(false)}
                            className="h-14 w-14 shrink-0 bg-surface-muted"
                          >
                            <img src={product.imageUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <Link
                              to={`/produtos/${product.id}`}
                              onClick={() => setIsCartOpen(false)}
                              className="truncate text-sm font-medium text-ink hover:text-terracota-600 hover:underline underline-offset-4"
                            >
                              {product.title}
                            </Link>
                            <span className="text-xs text-ink-soft">
                              {quantity} × {currency.format(product.price)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(product.id)}
                            aria-label={`Remover ${product.title} do carrinho`}
                            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-col gap-3 border-t border-border p-4">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>Subtotal</span>
                        <span>{currency.format(cartSubtotal)}</span>
                      </div>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => {
                          setIsCartOpen(false)
                          navigate('/carrinho')
                        }}
                      >
                        Ver carrinho
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                    <p className="text-sm text-ink-soft">Seu carrinho está vazio.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCartOpen(false)
                        navigate('/#vitrine')
                      }}
                    >
                      Ver vitrine
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => {
              setIsMenuOpen((open) => !open)
              setIsSearchOpen(false)
              setIsCartOpen(false)
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
                navigate('/#vitrine')
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
                aria-controls="header-search-results"
                aria-expanded={normalizedQuery.length > 0}
              />
            </form>

            {normalizedQuery && (
              <div id="header-search-results" className="mt-3 border-t border-border/70 pt-3">
                {searchResults.length > 0 ? (
                  <ul className="flex flex-col divide-y divide-border/60">
                    {searchResults.map((product) => (
                      <li key={product.id} className="flex items-center gap-1">
                        <Link
                          to={`/produtos/${product.id}`}
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
                        <button
                          type="button"
                          onClick={() => addItem(product.id)}
                          aria-label={`Adicionar ${product.title} ao carrinho`}
                          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:bg-terracota hover:text-creme-50"
                        >
                          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
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
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="px-2 py-3 font-medium text-ink transition-colors hover:bg-aubergine/5 hover:text-terracota-600"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/favoritos"
              onClick={() => setIsMenuOpen(false)}
              className="px-2 py-3 font-medium text-ink transition-colors hover:bg-aubergine/5 hover:text-terracota-600"
            >
              Favoritos{favorites.length > 0 && ` (${favorites.length})`}
            </Link>
            <Link
              to={user ? '/conta' : '/entrar'}
              onClick={() => setIsMenuOpen(false)}
              className="px-2 py-3 font-medium text-ink transition-colors hover:bg-aubergine/5 hover:text-terracota-600"
            >
              {user ? 'Minha conta' : 'Entrar / Criar conta'}
            </Link>
          </Container>
        </nav>
      )}
    </header>
  )
}
