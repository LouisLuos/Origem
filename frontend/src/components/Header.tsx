import { useState } from 'react'
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { Container } from '@/design-system'
import logoUrl from '@/assets/logo-origem.png'

const navLinks = [
  { label: 'Vitrine', href: '#vitrine' },
  { label: 'Técnicas', href: '#tecnicas' },
  { label: 'Artesãos', href: '#artesaos' },
  { label: 'Nossa história', href: '#historia' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-creme/95 backdrop-blur">
      <Container className="flex h-20 items-center justify-between gap-4">
        <a href="#top" className="flex shrink-0 items-center gap-2" aria-label="Origem — página inicial">
          <img src={logoUrl} alt="Origem" className="h-10 w-auto" />
        </a>

        <nav aria-label="Navegação principal" className="hidden lg:block">
          <ul className="flex items-center gap-8 font-medium text-ink">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="transition-colors hover:text-terracota-600">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden flex-1 items-center md:flex md:max-w-xs lg:max-w-sm">
          <label htmlFor="header-search" className="sr-only">
            Buscar peças, técnicas ou artesãos
          </label>
          <div className="relative w-full">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
              aria-hidden="true"
            />
            <input
              id="header-search"
              type="search"
              placeholder="Buscar peças, técnicas, artesãos..."
              className="w-full rounded-full border border-border bg-surface py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-ink-soft/60 focus:border-terracota"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Entrar ou criar conta"
            className="hidden h-11 w-11 items-center justify-center rounded-full text-aubergine transition-colors hover:bg-aubergine/5 sm:flex"
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Ver carrinho, 0 itens"
            className="flex h-11 w-11 items-center justify-center rounded-full text-aubergine transition-colors hover:bg-aubergine/5"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-aubergine transition-colors hover:bg-aubergine/5 lg:hidden"
          >
            {isMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </Container>

      {isMenuOpen && (
        <nav id="mobile-menu" aria-label="Navegação principal (móvel)" className="border-t border-border/70 lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-md px-2 py-3 font-medium text-ink transition-colors hover:bg-aubergine/5 hover:text-terracota-600"
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
