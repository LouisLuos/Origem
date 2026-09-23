import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Heart, Minus, Plus, RotateCcw, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import { Badge, Button, Container, ProductCard, currency } from '@/design-system'
import type { Product } from '@/design-system'
import { allProducts } from '@/data/mockProducts'
import { artisanSpotlights, getAvatarUrl } from '@/data/mockArtisans'
import { useCart } from '@/context/CartContext'
import { useProductFilter } from '@/context/ProductFilterContext'

function getGalleryImages(product: Product): string[] {
  const match = product.imageUrl.match(/^(https:\/\/picsum\.photos\/seed\/)([^/]+)(\/.+)$/)
  if (!match) return [product.imageUrl]
  const [, prefix, seed, suffix] = match
  return [product.imageUrl, `${prefix}${seed}-detalhe${suffix}`, `${prefix}${seed}-ambiente${suffix}`]
}

function DetailSection({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group border-b border-border py-4" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-widest text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-lg leading-none text-ink-soft group-open:hidden">
          +
        </span>
        <span aria-hidden="true" className="hidden text-lg leading-none text-ink-soft group-open:inline">
          −
        </span>
      </summary>
      <div className="pt-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </details>
  )
}

const trustPoints = [
  { icon: Truck, label: 'Frete calculado no carrinho', description: 'Entrega para todo o Brasil.' },
  { icon: ShieldCheck, label: 'Compra 100% segura', description: 'Pagamento protegido de ponta a ponta.' },
  { icon: RotateCcw, label: '7 dias para troca', description: 'Direto com o artesão responsável.' },
]

export function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { selectTechnique } = useProductFilter()

  const product = allProducts.find((item) => item.id === id)

  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    setActiveImage(0)
    setQuantity(1)
  }, [id])

  if (!product) {
    return (
      <main id="main-content" className="pt-32 pb-24">
        <Container className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-semibold text-ink">Peça não encontrada</h1>
          <p className="max-w-md text-ink-soft">
            O produto que você procura não existe ou não está mais disponível na vitrine.
          </p>
          <Button variant="primary" onClick={() => navigate('/#vitrine')}>
            Voltar à vitrine
          </Button>
        </Container>
      </main>
    )
  }

  const hasDiscount = !!product.compareAtPrice && product.compareAtPrice > product.price
  const discountPercent = hasDiscount
    ? Math.round(100 - (product.price / (product.compareAtPrice as number)) * 100)
    : 0
  const gallery = getGalleryImages(product)
  const artisan = artisanSpotlights.find((item) => item.name === product.artisan)
  const relatedProducts = allProducts
    .filter((item) => item.technique === product.technique && item.id !== product.id)
    .slice(0, 4)

  const goToTechnique = () => {
    selectTechnique(product.technique)
    navigate('/#vitrine')
  }

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1.5 pb-8 text-xs text-ink-soft">
          <Link to="/#vitrine" className="hover:text-terracota-600 hover:underline underline-offset-4">
            Vitrine
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <button
            type="button"
            onClick={goToTechnique}
            className="cursor-pointer hover:text-terracota-600 hover:underline underline-offset-4"
          >
            {product.technique}
          </button>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span aria-current="page" className="truncate text-ink">
            {product.title}
          </span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-3">
            <div className="relative aspect-square overflow-hidden bg-surface-muted">
              <img
                src={gallery[activeImage]}
                alt={product.imageAlt}
                className="h-full w-full object-cover"
              />
              {hasDiscount && (
                <Badge tone="terracota" className="absolute left-3 top-3 border-none bg-terracota-400/90 text-[11px] font-medium tracking-wide text-white">
                  {discountPercent}% off
                </Badge>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="flex gap-3">
                {gallery.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Ver imagem ${index + 1} de ${product.title}`}
                    aria-current={activeImage === index}
                    className={`h-20 w-20 shrink-0 cursor-pointer overflow-hidden bg-surface-muted transition-opacity ${
                      activeImage === index ? 'opacity-100 ring-2 ring-terracota' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft/70">
                {product.technique} · {product.hub}
              </span>
              <h1 className="text-2xl font-semibold leading-snug text-ink sm:text-3xl">{product.title}</h1>
              <p className="text-sm text-ink-soft">
                por{' '}
                {artisan ? (
                  <Link
                    to={`/artesaos/${artisan.id}`}
                    className="font-medium text-ink underline-offset-4 hover:text-terracota-600 hover:underline"
                  >
                    {product.artisan}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/#artesaos')}
                    className="cursor-pointer font-medium text-ink underline-offset-4 hover:text-terracota-600 hover:underline"
                  >
                    {product.artisan}
                  </button>
                )}
              </p>
            </div>

            <div className="flex items-baseline gap-3">
              {hasDiscount && (
                <span className="text-base text-ink-soft line-through opacity-70">
                  {currency.format(product.compareAtPrice as number)}
                </span>
              )}
              <span className="text-2xl font-semibold text-terracota-600">{currency.format(product.price)}</span>
            </div>

            {product.description && <p className="text-sm leading-relaxed text-ink-soft">{product.description}</p>}

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex h-14 items-center border border-border">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  disabled={quantity <= 1}
                  aria-label="Diminuir quantidade"
                  className="flex h-full w-12 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span aria-live="polite" className="w-10 text-center text-sm font-semibold text-ink">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.min(10, value + 1))}
                  disabled={quantity >= 10}
                  aria-label="Aumentar quantidade"
                  className="flex h-full w-12 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="h-14 flex-1"
                onClick={() => addItem(product.id, quantity)}
              >
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                Adicionar ao carrinho
              </Button>

              <button
                type="button"
                onClick={() => setIsFavorite((value) => !value)}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? `Remover ${product.title} dos favoritos` : `Favoritar ${product.title}`}
                className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center border border-border text-aubergine transition-colors hover:border-terracota hover:text-terracota-600"
              >
                <Heart className="h-5 w-5" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 border-y border-border py-5 sm:grid-cols-3">
              {trustPoints.map(({ icon: Icon, label, description }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-terracota-500" aria-hidden="true" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-ink">{label}</span>
                    <span className="text-xs text-ink-soft">{description}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col">
              {product.details && product.details.length > 0 && (
                <DetailSection title="Detalhes da peça" defaultOpen>
                  <ul className="flex flex-col gap-1.5">
                    {product.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 bg-terracota-400" aria-hidden="true" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </DetailSection>
              )}

              <DetailSection title="Sobre o artesão">
                {artisan ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={getAvatarUrl(artisan.photoUrl)}
                        alt={artisan.photoAlt}
                        className="h-14 w-14 shrink-0 object-cover"
                      />
                      <p>{artisan.bio}</p>
                    </div>
                    <Link
                      to={`/artesaos/${artisan.id}`}
                      className="w-fit font-medium text-terracota-600 underline-offset-4 hover:underline"
                    >
                      Ver perfil completo
                    </Link>
                  </div>
                ) : (
                  <p>
                    {product.artisan} é responsável pela técnica de {product.technique.toLowerCase()} em{' '}
                    {product.hub}, mantendo viva uma tradição do artesanato pernambucano.
                  </p>
                )}
              </DetailSection>

              <DetailSection title="Envio e cuidados">
                <p>
                  Peça produzida sob demanda ou em pequenos lotes: o prazo de envio pode variar conforme a
                  disponibilidade do artesão. Por ser feita à mão, pequenas variações de cor, forma e textura fazem
                  parte da identidade de cada peça.
                </p>
              </DetailSection>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="mt-16 flex flex-col gap-8 border-t border-border pt-16 sm:mt-20 sm:pt-20">
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">Você também pode gostar</h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {relatedProducts.map((related) => (
                <ProductCard key={related.id} product={related} onAddToCart={addItem} />
              ))}
            </div>
          </div>
        )}
      </Container>
    </main>
  )
}
