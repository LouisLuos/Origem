import { Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
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
  description?: string
  details?: string[]
  /** Unidades em estoque. Ausente = sem controle de estoque; 0 = esgotada. */
  stock?: number
}

export interface ProductCardProps {
  product: Product
  className?: string
  onToggleFavorite?: (id: string) => void
  isFavorite?: boolean
  onAddToCart?: (id: string) => void
}

export const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function ProductCard({ product, className, onToggleFavorite, isFavorite, onAddToCart }: ProductCardProps) {
  const isSoldOut = product.stock === 0
  const hasDiscount = !!product.compareAtPrice && product.compareAtPrice > product.price

  return (
    <article className={cn('relative flex cursor-pointer flex-col', className)}>
      <div className="relative aspect-square overflow-hidden bg-surface-muted">
        <img
          src={product.imageUrl}
          alt={product.imageAlt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />

        {isSoldOut && (
          <Badge tone="terracota" className="absolute left-3 top-3 border-none bg-aubergine/90 text-[11px] font-medium tracking-wide text-creme-50">
            Esgotado
          </Badge>
        )}

        {hasDiscount && !isSoldOut && (
          <Badge tone="terracota" className="absolute left-3 top-3 border-none bg-terracota-400/90 text-[11px] font-medium tracking-wide text-white">
            Oferta
          </Badge>
        )}

        <button
          type="button"
          onClick={() => onToggleFavorite?.(product.id)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remover ${product.title} dos favoritos` : `Favoritar ${product.title}`}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center bg-surface/90 text-aubergine shadow-soft transition-colors hover:bg-terracota hover:text-creme-50"
        >
          <Heart className="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onAddToCart?.(product.id)}
          disabled={isSoldOut}
          aria-label={isSoldOut ? `${product.title} esgotado` : `Adicionar ${product.title} ao carrinho`}
          className="absolute bottom-3 right-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center bg-surface/90 text-aubergine shadow-soft transition-colors hover:bg-terracota hover:text-creme-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface/90 disabled:hover:text-aubergine"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-1 pt-4 text-center">
        <span className="text-[11px] uppercase tracking-widest text-ink-soft/70">{product.technique}</span>
        <h3 className="text-sm font-medium uppercase tracking-wide text-ink">{product.title}</h3>
        <p className="text-xs text-ink-soft">por {product.artisan}</p>

        <div className="flex items-baseline gap-2 pt-1 text-xs text-ink-soft">
          {hasDiscount && (
            <span className="line-through opacity-70">{currency.format(product.compareAtPrice as number)}</span>
          )}
          <span>{currency.format(product.price)}</span>
        </div>
      </div>

      <Link to={`/produtos/${product.id}`} className="absolute inset-0 z-10" aria-label={`Ver detalhes de ${product.title}`} />
    </article>
  )
}
