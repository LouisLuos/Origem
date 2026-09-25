import { ChevronRight, MapPin, Package, Sparkles } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Container, ProductCard } from '@/design-system'
import { getAvatarUrl } from '@/utils/avatar'
import { ErrorBlock, LoadingBlock } from '@/components/AsyncState'
import { useArtisans } from '@/context/ArtisanContext'
import { useCatalog } from '@/context/CatalogContext'
import { useCart } from '@/context/CartContext'
import { useFavorites } from '@/context/FavoritesContext'
import { useProductFilter } from '@/context/ProductFilterContext'

export function ArtisanProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { selectTechnique } = useProductFilter()

  const { artisans, status: artisansStatus, error: artisansError, reload: reloadArtisans } = useArtisans()
  const { products: catalogProducts, status: catalogStatus } = useCatalog()

  const artisan = artisans.find((item) => item.id === id)

  if (artisansStatus === 'loading' || (artisan && catalogStatus === 'loading')) {
    return (
      <main id="main-content" className="pb-24 pt-32">
        <Container>
          <LoadingBlock label="Carregando perfil…" />
        </Container>
      </main>
    )
  }

  if (artisansStatus === 'error') {
    return (
      <main id="main-content" className="pb-24 pt-32">
        <Container>
          <ErrorBlock message={artisansError} onRetry={reloadArtisans} />
        </Container>
      </main>
    )
  }

  if (!artisan) {
    return (
      <main id="main-content" className="pb-24 pt-32">
        <Container className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-semibold text-ink">Artesão não encontrado</h1>
          <p className="max-w-md text-ink-soft">
            O perfil que você procura não existe ou não está mais disponível.
          </p>
          <Button variant="primary" onClick={() => navigate('/#artesaos')}>
            Voltar aos artesãos
          </Button>
        </Container>
      </main>
    )
  }

  const products = catalogProducts.filter((product) => product.artisan === artisan.name)
  const yearsActive = new Date().getFullYear() - artisan.since

  const goToTechnique = () => {
    selectTechnique(artisan.technique)
    navigate('/#vitrine')
  }

  return (
    <main id="main-content" className="pb-16 sm:pb-24">
      <Container className="pt-24 sm:pt-28">
        <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1.5 pb-4 text-xs text-ink-soft">
          <Link to="/#artesaos" className="hover:text-terracota-600 hover:underline underline-offset-4">
            Artesãos
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span aria-current="page" className="truncate text-ink">
            {artisan.name}
          </span>
        </nav>
      </Container>

      <div className="relative">
        <div className="aspect-21/9 w-full overflow-hidden bg-surface-muted">
          <img src={artisan.coverUrl} alt={artisan.coverAlt} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-aubergine/30" aria-hidden="true" />
        </div>

        <Container className="absolute inset-x-0 bottom-0 translate-y-1/2">
          <img
            src={getAvatarUrl(artisan.photoUrl)}
            alt={artisan.photoAlt}
            className="h-32 w-32 border-4 border-creme object-cover sm:h-40 sm:w-40"
          />
        </Container>
      </div>

      <Container className="pt-20 sm:pt-24">
        <div className="flex flex-col gap-6 border-b border-border pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={goToTechnique}
              className="w-fit cursor-pointer text-xs font-semibold uppercase tracking-widest text-terracota-600 hover:underline underline-offset-4"
            >
              {artisan.technique}
            </button>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{artisan.name}</h1>
            <span className="flex items-center gap-1.5 text-sm text-ink-soft">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {artisan.hub}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-border pt-4 sm:w-auto sm:border-0 sm:pt-0 sm:text-right">
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-ink">{yearsActive}</span>
              <span className="text-xs text-ink-soft">anos de ofício</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-ink">{products.length}</span>
              <span className="text-xs text-ink-soft">{products.length === 1 ? 'peça na loja' : 'peças na loja'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-ink">{artisan.since}</span>
              <span className="text-xs text-ink-soft">início do ofício</span>
            </div>
          </div>
        </div>

        <div className="grid gap-10 pt-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">Sobre {artisan.name}</h2>
            <p className="text-sm leading-relaxed text-ink-soft">{artisan.bio}</p>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-terracota-500" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-ink">Técnica principal</span>
                <span className="text-xs text-ink-soft">{artisan.technique}</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-terracota-500" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-ink">Polo cultural</span>
                <span className="text-xs text-ink-soft">{artisan.hub}</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Package className="mt-0.5 h-4 w-4 shrink-0 text-terracota-500" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-ink">Peças disponíveis</span>
                <span className="text-xs text-ink-soft">{products.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-8 border-t border-border pt-16 sm:mt-20 sm:pt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">Peças de {artisan.name}</h2>
            {products.length > 0 && (
              <Button variant="outline" size="sm" onClick={goToTechnique}>
                Ver mais de {artisan.technique}
              </Button>
            )}
          </div>

          {products.length > 0 ? (
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
          ) : (
            <p className="text-sm text-ink-soft">Nenhuma peça disponível deste artesão no momento.</p>
          )}
        </div>
      </Container>
    </main>
  )
}
