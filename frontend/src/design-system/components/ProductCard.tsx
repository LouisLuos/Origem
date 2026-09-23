import { Heart } from 'lucide-react'
import { cn } from '../cn'
import { Badge } from './Badge'

export interface Product {
  id: string
  title: string
  artisan: string
  hub: string
  technique: string
  price: number
  compareAtPrice?: number
  imageUrl: string
  imageAlt: string
}

export interface ProductCardProps {
  product: Product
  className?: string
  onToggleFavorite?: (id: string) => void
  isFavorite?: boolean
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function ProductCard({ product, className, onToggleFavorite, isFavorite }: ProductCardProps) {
  const hasDiscount = !!product.compareAtPrice && product.compareAtPrice > product.price

  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden bg-surface shadow-soft transition-shadow duration-200 hover:shadow-lift',
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-surface-muted">
        <img src={product.imageUrl} alt={product.imageAlt} loading="lazy" className="h-full w-full object-cover" />

        {hasDiscount && (
          <Badge tone="terracota" className="absolute left-3 top-3 border-none bg-terracota text-creme-50">
            Oferta
          </Badge>
        )}

        <button
          type="button"
          onClick={() => onToggleFavorite?.(product.id)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remover ${product.title} dos favoritos` : `Favoritar ${product.title}`}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center bg-surface/90 text-aubergine shadow-soft transition-colors hover:bg-terracota hover:text-creme-50"
        >
          <Heart className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-sm font-medium text-oliva-600">
          {product.technique} · {product.hub}
        </span>
        <h3 className="text-lg font-semibold leading-snug text-aubergine">{product.title}</h3>
        <p className="text-sm text-ink-soft">por {product.artisan}</p>

        <div className="mt-auto flex items-baseline gap-2 pt-3">
          {hasDiscount && (
            <span className="text-sm text-ink-soft line-through">
              {currency.format(product.compareAtPrice as number)}
            </span>
          )}
          <span className="text-lg font-semibold text-terracota-600">{currency.format(product.price)}</span>
        </div>
      </div>
    </article>
  )
}
