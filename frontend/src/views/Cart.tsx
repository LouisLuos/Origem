'use client'

import { useEffect, useMemo } from 'react'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { Button, ButtonLink, Container, currency } from '@/design-system'
import { ErrorBlock, LoadingBlock } from '@/components/AsyncState'
import { CartAtelierGroup } from '@/components/CartAtelierGroup'
import { CartReservationTimer } from '@/components/CartReservationTimer'
import { useCatalog } from '@/context/CatalogContext'
import { useCart } from '@/context/CartContext'
import { FREE_SHIPPING_THRESHOLD, calculateShipping } from '@/context/OrderContext'
import { removeStorage } from '@/services/storage'

export function Cart() {
  const { lines: cartLines, removeItem, setQuantity, hydrated: cartHydrated } = useCart()
  const { status, error, reload } = useCatalog()

  const subtotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0)
  const hasUnavailableItem = cartLines.some(
    (line) =>
      line.product.stock === 0 || line.quantity > (line.product.stock ?? line.quantity),
  )

  // Só limpa o timestamp quando o carrinho estiver hidratado E confirmado como vazio
  useEffect(() => {
    if (cartHydrated && status === 'ready' && cartLines.length === 0) {
      removeStorage('origem:cart_reservation_expires_at')
    }
  }, [cartHydrated, status, cartLines.length])

  // HU-09 (Cenário 1 BDD): Agrupamento visual de carrinho multi-origem por ateliê/polo
  const atelierGroups = useMemo(() => {
    const map = new Map<string, { atelierName: string; hub: string; lines: typeof cartLines }>()
    for (const line of cartLines) {
      const key = line.product.artisan || 'Ateliê Independente'
      const existing = map.get(key)
      if (existing) {
        existing.lines.push(line)
      } else {
        map.set(key, {
          atelierName: key,
          hub: line.product.hub || 'Pernambuco',
          lines: [line],
        })
      }
    }
    return Array.from(map.values()).map((group) => {
      const groupSubtotal = group.lines.reduce(
        (sum, l) => sum + l.product.price * l.quantity,
        0,
      )
      const groupShipping = calculateShipping(groupSubtotal)
      return {
        ...group,
        subtotal: groupSubtotal,
        shipping: groupShipping,
      }
    })
  }, [cartLines])

  const totalShipping = atelierGroups.reduce((sum, g) => sum + g.shipping, 0)
  const grandTotal = subtotal + totalShipping
  const missingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1.5 pb-6 text-xs text-ink-soft">
          <Link href="/#vitrine" className="hover:text-terracota-600 hover:underline underline-offset-4">
            Vitrine
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span aria-current="page" className="text-ink">
            Carrinho
          </span>
        </nav>

        <div className="flex flex-col gap-2 pb-6">
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Seu carrinho</h1>
          <p className="text-xs text-ink-soft">
            Marketplace Multi-Origem: peças agrupadas por ateliê com expedição direta de cada polo produtor.
          </p>
        </div>

        {status === 'loading' ? (
          <LoadingBlock label="Carregando carrinho…" />
        ) : status === 'error' ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : cartLines.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-ink-soft/60" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-ink">Seu carrinho está vazio</p>
              <p className="text-sm text-ink-soft">Explore a vitrine e leve um pedaço de Pernambuco pra casa.</p>
            </div>
            <ButtonLink href="/#vitrine" variant="primary" size="md">
              Ver vitrine
            </ButtonLink>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* HU-09: Cronômetro regressivo de reserva de 15 minutos (Invariante 1) */}
            <CartReservationTimer />

            <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
              {/* Lista de Ateliês Independentes (Cenário 1 BDD) */}
              <div className="flex flex-col gap-6">
                {atelierGroups.map((group) => (
                  <CartAtelierGroup
                    key={group.atelierName}
                    atelierName={group.atelierName}
                    hub={group.hub}
                    lines={group.lines}
                    shipping={group.shipping}
                    onQuantityChange={setQuantity}
                    onRemoveItem={removeItem}
                  />
                ))}
              </div>

              {/* Resumo do Pedido com Frete Fracionado e Consolidado */}
              <aside className="flex h-fit flex-col gap-4 bg-aubergine-400/10 border border-border p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">Resumo do pedido</h2>

                <div className="flex flex-col gap-2 text-sm text-ink-soft">
                  <div className="flex items-center justify-between">
                    <span>Subtotal das peças</span>
                    <span className="font-medium text-ink">{currency.format(subtotal)}</span>
                  </div>

                  {/* Detalhamento dos fretes por ateliê */}
                  <div className="border-t border-border pt-2 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between font-medium text-ink">
                      <span>Frete Total ({atelierGroups.length} {atelierGroups.length === 1 ? 'ateliê' : 'ateliês'})</span>
                      <span className={totalShipping === 0 ? 'text-oliva-600' : 'text-ink'}>
                        {totalShipping === 0 ? 'Grátis' : currency.format(totalShipping)}
                      </span>
                    </div>

                    {atelierGroups.length > 1 && (
                      <ul className="flex flex-col gap-1 pl-2 text-[11px] text-ink-soft border-l border-border">
                        {atelierGroups.map((g) => (
                          <li key={g.atelierName} className="flex justify-between">
                            <span className="truncate pr-2">{g.atelierName} ({g.hub})</span>
                            <span>{g.shipping === 0 ? 'Grátis' : currency.format(g.shipping)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {missingForFreeShipping > 0 ? (
                  <p className="border-t border-border pt-3 text-xs text-ink-soft">
                    Faltam {currency.format(missingForFreeShipping)} em compras para frete grátis nacional.
                  </p>
                ) : (
                  <p className="border-t border-border pt-3 text-xs text-oliva-600">
                    Seu pedido tem direito a frete grátis.
                  </p>
                )}

                <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-ink">
                  <span>Total consolidado</span>
                  <span>{currency.format(grandTotal)}</span>
                </div>

                {hasUnavailableItem ? (
                  <Button variant="primary" size="lg" disabled>
                    Finalizar compra
                  </Button>
                ) : (
                  <ButtonLink href="/checkout" variant="primary" size="lg">
                    Finalizar compra
                  </ButtonLink>
                )}

                <Link
                  href="/#vitrine"
                  className="text-center text-sm text-ink-soft underline-offset-4 hover:text-terracota-600 hover:underline"
                >
                  Continuar comprando
                </Link>
              </aside>
            </div>
          </div>
        )}
      </Container>
    </main>
  )
}
