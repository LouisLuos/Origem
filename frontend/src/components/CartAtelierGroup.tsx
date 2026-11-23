'use client'

import { MapPin, Minus, Plus, Store, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { Badge, currency } from '@/design-system'
import { availableQuantity } from '@/context/CartContext'
import type { CartLine } from '@/context/CartContext'

export interface CartAtelierGroupProps {
  atelierName: string
  hub: string
  lines: CartLine[]
  shipping: number
  onQuantityChange: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
}

export function CartAtelierGroup({
  atelierName,
  hub,
  lines,
  shipping,
  onQuantityChange,
  onRemoveItem,
}: CartAtelierGroupProps) {
  const atelierSubtotal = lines.reduce(
    (acc, line) => acc + line.product.price * line.quantity,
    0,
  )

  return (
    <section
      aria-label={`Itens do ${atelierName}`}
      className="flex flex-col border border-border bg-surface p-5 sm:p-6"
    >
      {/* Cabeçalho do Ateliê / Polo de Origem */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-terracota-600 shrink-0" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink">
            {atelierName}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-ink-soft/70" aria-hidden="true" />
          <Badge tone="aubergine" className="text-[11px]">
            Polo {hub}
          </Badge>
        </div>
      </header>

      {/* Lista de Peças deste Ateliê */}
      <ul className="flex flex-col divide-y divide-border">
        {lines.map(({ product, quantity }) => (
          <li key={product.id} className="flex gap-4 py-5 first:pt-4">
            <Link
              href={`/produtos/${product.id}`}
              className="h-20 w-20 shrink-0 overflow-hidden bg-surface-muted sm:h-24 sm:w-24"
            >
              <img
                src={product.imageUrl}
                alt={product.imageAlt}
                className="h-full w-full object-cover"
              />
            </Link>

            <div className="flex flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-widest text-ink-soft/70">
                  {product.technique}
                </span>
                <Link
                  href={`/produtos/${product.id}`}
                  className="font-medium text-ink hover:text-terracota-600 hover:underline underline-offset-4"
                >
                  {product.title}
                </Link>

                {typeof product.stock === 'number' && product.stock > 0 && product.stock <= 3 && (
                  <span className="text-xs font-medium text-warning">
                    Restam poucas unidades ({product.stock} {product.stock === 1 ? 'disponível' : 'disponíveis'})
                  </span>
                )}
                {typeof product.stock === 'number' && product.stock > 3 && (
                  <span className="text-xs text-ink-soft">{product.stock} disponíveis em estoque</span>
                )}

                <div className="mt-2 flex h-9 w-fit items-center border border-border">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(product.id, quantity - 1)}
                    aria-label={`Diminuir quantidade de ${product.title}`}
                    className="flex h-full w-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600"
                  >
                    <Minus className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <span aria-live="polite" className="w-8 text-center text-xs font-semibold text-ink">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(product.id, quantity + 1)}
                    disabled={quantity >= availableQuantity(product)}
                    aria-label={`Aumentar quantidade de ${product.title}`}
                    className="flex h-full w-8 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>

                {product.stock !== undefined && quantity > product.stock && (
                  <p role="alert" className="text-xs text-danger">
                    {product.stock === 0
                      ? 'Peça esgotada. Remova-a para finalizar a compra.'
                      : `Restam apenas ${product.stock} em estoque.`}
                  </p>
                )}
              </div>

              <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                <span className="font-semibold text-ink">{currency.format(product.price * quantity)}</span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(product.id)}
                  aria-label={`Remover ${product.title} do carrinho`}
                  className="flex cursor-pointer items-center gap-1 text-xs text-ink-soft transition-colors hover:text-terracota-600"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Remover
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Rodapé com Frete Fracionado deste Ateliê e Subtotal da Origem */}
      <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-3 text-xs text-ink-soft">
        <div className="flex items-center gap-1.5">
          <span>Frete de envio ({hub}):</span>
          <span className={shipping === 0 ? 'font-semibold text-oliva-600' : 'font-semibold text-ink'}>
            {shipping === 0 ? 'Grátis' : currency.format(shipping)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Subtotal do ateliê:</span>
          <strong className="text-ink">{currency.format(atelierSubtotal)}</strong>
        </div>
      </footer>
    </section>
  )
}
