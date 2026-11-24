import Image from 'next/image'
import Link from 'next/link'
import { Container } from '@/design-system'
import logoUrl from '@/assets/logo-origem.png'

const columns = [
  {
    title: 'Explorar',
    links: [
      { label: 'Categorias', href: '/#categorias' },
      { label: 'Vitrine de peças', href: '/#vitrine' },
      { label: 'Mestres e artesãos', href: '/#artesaos' },
    ],
  },
  {
    title: 'Arquitetura (FCCPD U2)',
    links: [
      { label: 'Catálogo distribuído', href: '/#vitrine' },
      { label: 'Recomendações paralelas', href: '/produtos/p01' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative z-10 bg-aubergine text-creme-100">
      <Container className="grid gap-10 py-14 lg:grid-cols-[1.2fr_2fr]">
        <div className="flex flex-col gap-4">
          <Image src={logoUrl} alt="Origem" className="h-9 w-auto self-start brightness-0 invert" />
          <p className="max-w-sm text-sm text-creme-100/80">
            Marketplace da economia criativa de Pernambuco. Conectamos artesãos e mestres populares
            diretamente a quem valoriza técnica, território e história.
          </p>
        </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="mb-4 text-sm font-semibold text-creme-50">{column.title}</h3>
                <ul className="flex flex-col gap-2.5 text-sm text-creme-100/80">
                  {column.links.map((link) => (
                      <li key={link.label}>
                        <Link href={link.href} className="transition-colors hover:text-creme-50">
                          {link.label}
                        </Link>
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
