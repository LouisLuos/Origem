import { Facebook, Instagram, Youtube } from 'lucide-react'
import { Container } from '@/design-system'
import logoUrl from '@/assets/logo-origem.png'

const columns = [
  {
    title: 'Sobre o Origem',
    links: ['Nossa história', 'Polos culturais', 'Trabalhe conosco', 'Imprensa'],
  },
  {
    title: 'Para compradores',
    links: ['Minha conta', 'Meus pedidos', 'Trocas e devoluções', 'Perguntas frequentes'],
  },
  {
    title: 'Para artesãos',
    links: ['Vender no Origem', 'Como funciona a moderação', 'Painel do ateliê', 'Suporte ao artesão'],
  },
]

export function Footer() {
  return (
    <footer className="relative z-10 bg-aubergine text-creme-100">
      <Container className="grid gap-10 py-14 lg:grid-cols-[1.2fr_2fr]">
        <div className="flex flex-col gap-4">
          <img src={logoUrl} alt="Origem" className="h-9 w-auto self-start brightness-0 invert" />
          <p className="max-w-sm text-sm text-creme-100/80">
            Marketplace da economia criativa de Pernambuco. Conectamos artesãos e mestres populares
            diretamente a quem valoriza técnica, território e história.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <a
              href="#"
              aria-label="Origem no Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-creme-100/20 transition-colors hover:bg-creme-100/10"
            >
              <Instagram className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href="#"
              aria-label="Origem no Facebook"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-creme-100/20 transition-colors hover:bg-creme-100/10"
            >
              <Facebook className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href="#"
              aria-label="Origem no YouTube"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-creme-100/20 transition-colors hover:bg-creme-100/10"
            >
              <Youtube className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="mb-4 text-sm font-semibold text-creme-50">{column.title}</h3>
              <ul className="flex flex-col gap-2.5 text-sm text-creme-100/80">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="transition-colors hover:text-creme-50">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </Container>

      <div className="border-t border-creme-100/10 py-6">
        <Container className="flex flex-col items-center justify-between gap-2 text-xs text-creme-100/60 sm:flex-row">
          <p>© {new Date().getFullYear()} Origem. Projeto Integrador IV da CESAR School.</p>
          <p>Feito com respeito pela cultura pernambucana.</p>
        </Container>
      </div>
    </footer>
  )
}
