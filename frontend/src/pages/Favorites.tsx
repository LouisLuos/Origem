import { ChevronRight, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, Container, ProductCard } from '@/design-system'
import { ErrorBlock, LoadingBlock } from '@/components/AsyncState'
import { useCatalog } from '@/context/CatalogContext'
import { useCart } from '@/context/CartContext'
import { useFavorites } from '@/context/FavoritesContext'

export function Favorites() {
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const { addItem } = useCart()
  const { products: catalog, status, error, reload } = useCatalog()

  // Mantém a ordem em que foram favoritados (mais recente primeiro).
  const products = favorites.flatMap((id) => catalog.find((product) => product.id === id) ?? [])

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1.5 pb-6 text-xs text-ink-soft">
          <Link to="/#vitrine" className="hover:text-terracota-600 hover:underline underline-offset-4">
            Vitrine
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span aria-current="page" className="text-ink">
            Favoritos
          </span>
        </nav>

        <h1 className="pb-8 text-2xl font-semibold text-ink sm:text-3xl">
          Meus favoritos
          {products.length > 0 && <span className="ml-2 text-base font-normal text-ink-soft">({products.length})</span>}
        </h1>

        {status === 'loading' ? (
          <LoadingBlock label="Carregando favoritos…" />
        ) : status === 'error' ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
            <Heart className="h-10 w-10 text-ink-soft/60" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-ink">Nenhuma peça favoritada ainda</p>
              <p className="text-sm text-ink-soft">Toque no coração de uma peça para guardá-la aqui.</p>
            </div>
            <Link to="/#vitrine">
              <Button variant="primary" size="md">
                Ver vitrine
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isFavorite={isFavorite(product.id)}
                onToggleFavorite={toggleFavorite}
                onAddToCart={addItem}
              />
            ))}
          </div>
        )}
      </Container>
    </main>
  )
}
