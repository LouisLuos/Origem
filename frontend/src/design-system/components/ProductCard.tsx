'use client'

import Link from 'next/link'
import { cn } from '../cn'
import { currency } from '../format'
import { Badge } from './Badge'

const LOW_STOCK_THRESHOLD = 3

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
  /** Fotos reais da peça (capa primeiro). */
  gallery?: string[]
}

export interface ProductCardProps {
  product: Product
  className?: string
}

  export function ProductCard({ product, className }: ProductCardProps) {
    const hasStockNumber = typeof product.stock === 'number' && Number.isFinite(product.stock)
    const stockCount = hasStockNumber ? Math.max(0, Math.floor(product.stock as number)) : undefined
    const isSoldOut = stockCount === 0
    const isLowStock = stockCount !== undefined && stockCount > 0 && stockCount <= LOW_STOCK_THRESHOLD
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

        {!isSoldOut && isLowStock && (
            <Badge tone="terracota" className="absolute left-3 top-3 border-none bg-terracota/90 text-[11px] font-medium tracking-wide text-creme-50">
              Últimas unidades
            </Badge>
          )}

          {hasDiscount && !isSoldOut && !isLowStock && (
            <Badge tone="terracota" className="absolute left-3 top-3 border-none bg-terracota-400/90 text-[11px] font-medium tracking-wide text-white">
              Oferta
            </Badge>
          )}
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

          {isSoldOut && <span className="text-[11px] font-semibold text-danger">Esgotado</span>}
          {!isSoldOut && isLowStock && stockCount !== undefined && (
            <span className="text-[11px] font-medium text-warning">
              Restam poucas unidades ({stockCount} {stockCount === 1 ? 'disponível' : 'disponíveis'})
            </span>
          )}
          {!isSoldOut && !isLowStock && stockCount !== undefined && (
            <span className="text-[11px] text-ink-soft">{stockCount} disponíveis</span>
          )}
        </div>

        <Link href={`/produtos/${product.id}`} className="absolute inset-0 z-10" aria-label={`Ver detalhes de ${product.title}`} />
      </article>
    )
  }
