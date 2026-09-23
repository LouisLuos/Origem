import { useEffect, useRef, useState } from 'react'
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { Container, Input, cn } from '@/design-system'
import logoUrl from '@/assets/logo-origem.png'

const navLinks = [
  { label: 'Categorias', href: '#categorias' },
  { label: 'Produtos', href: '#vitrine' },
  { label: 'Artesãos', href: '#artesaos' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  const isSolid = isScrolled || isMenuOpen || isSearchOpen

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        isSolid ? 'border-b border-border/70 bg-creme/80 backdrop-blur' : 'border-b border-transparent bg-transparent',
      )}
    >
      <Container className="flex h-20 items-center justify-between gap-4">
        <a href="#top" className="flex shrink-0 items-center gap-2" aria-label="Origem — página inicial">
          <img
            src={logoUrl}
            alt="Origem"
            className={cn('h-10 w-auto transition-[filter] duration-300', !isSolid && 'brightness-0 invert')}
          />
        </a>

        <nav aria-label="Navegação principal" className="hidden lg:block">
          <ul className={cn('flex items-center gap-8 font-medium', isSolid ? 'text-ink' : 'text-creme-50 ')}>
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition-colors duration-300 hover:text-terracota-400">
                  {link.label}
                </a>
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
            aria-label="Entrar ou criar conta"
            className={cn(
              'hidden h-11 w-11 items-center justify-center rounded-full transition-colors sm:flex cursor-pointer',
              isSolid ? 'hover:bg-aubergine/5' : 'hover:bg-creme-50/10',
            )}
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Ver carrinho, 0 itens"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full transition-colors cursor-pointer',
              isSolid ? 'hover:bg-aubergine/5' : 'hover:bg-creme-50/10',
            )}
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
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
              'flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden',
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
            <Input
              ref={searchInputRef}
              type="search"
              label="Buscar peças, técnicas ou artesãos"
              hideLabel
              placeholder="Buscar peças, técnicas, artesãos..."
            />
          </Container>
        </div>
      )}

      {isMenuOpen && (
        <nav id="mobile-menu" aria-label="Navegação principal (móvel)" className="border-t border-border/70 bg-creme lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="px-2 py-3 font-medium text-ink transition-colors hover:bg-aubergine/5 hover:text-terracota-600"
              >
                {link.label}
              </a>
            ))}
          </Container>
        </nav>
      )}
    </header>
  )
}
