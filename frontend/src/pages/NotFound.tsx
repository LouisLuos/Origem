import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Container } from '@/design-system'

const shortcuts = [
  { label: 'Ver a vitrine', to: '/#vitrine' },
  { label: 'Conhecer os artesãos', to: '/#artesaos' },
  { label: 'Meu carrinho', to: '/carrinho' },
  { label: 'Meus favoritos', to: '/favoritos' },
]

export function NotFound() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Página não encontrada - Origem'
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <main id="main-content" className="pb-16 pt-32 sm:pb-24 sm:pt-40">
      <Container className="flex flex-col items-center gap-6 text-center">
        <p aria-hidden="true" className="text-8xl font-semibold leading-none tracking-tight text-terracota sm:text-9xl">
          404
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Página não encontrada</h1>
          <p className="max-w-md text-ink-soft">
            O endereço que você tentou abrir não existe ou foi movido. Que tal voltar para a vitrine e descobrir uma peça
            nova?
          </p>
        </div>

        <Link to="/">
          <Button variant="primary" size="lg">
            Voltar para o início
          </Button>
        </Link>

        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          {shortcuts.map(({ label, to }) => (
            <li key={to}>
              <Link to={to} className="text-ink-soft underline-offset-4 hover:text-terracota-600 hover:underline">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </main>
  )
}
