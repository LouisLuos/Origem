'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, Clock, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge, Button, ButtonLink, Container, currency } from '@/design-system'
import { ErrorBlock, LoadingBlock } from '@/components/AsyncState'
import { CartAtelierGroup } from '@/components/CartAtelierGroup'
import { CartReservationTimer } from '@/components/CartReservationTimer'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useCatalog } from '@/context/CatalogContext'
import { useOrders } from '@/context/OrderContext'
import {
  classifyPendingCheckoutOrders,
  effectiveAvailableQuantity,
} from '@/utils/cartReservation.util'

export function Cart() {
  const router = useRouter()
  const { user } = useAuth()
  const {
    lines: cartLines,
    removeItem,
    setQuantity,
    activeReservation,
    activeOrderReservation,
    expiredPendingOrderReservation,
    isMutatingReservation,
    reservationExpiredNotice,
    serverOffsetMs,
    reservationError,
    reservedQtyByProduct,
    reserveCart,
    renewReservation,
    cancelActiveReservation,
    handleReservationExpired,
  } = useCart()
  const { status, error, reload } = useCatalog()
  const { orders } = useOrders()

  const hasPendingOrderCandidate =
    Boolean(activeOrderReservation || expiredPendingOrderReservation) ||
    orders.some((order) => order.status === 'PENDENTE_PAGAMENTO')

  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!hasPendingOrderCandidate) return
    const syncId = window.setTimeout(() => setNowMs(Date.now()), 0)
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      window.clearTimeout(syncId)
      window.clearInterval(timer)
    }
  }, [hasPendingOrderCandidate])

  const subtotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0)
  const hasUnavailableItem = cartLines.some((line) => {
    const reservedByUser = reservedQtyByProduct.get(line.product.id.trim().toLowerCase()) ?? 0
    const effective = effectiveAvailableQuantity(line.product.stock, reservedByUser)
    return effective <= 0 || line.quantity > effective
  })

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
      return {
        ...group,
        subtotal: groupSubtotal,
      }
    })
  }, [cartLines])

  const {
    recoverableOrderCode: recoverablePendingOrderCode,
    awaitingReconciliationOrderCode,
  } = classifyPendingCheckoutOrders({
    orders,
    activeOrderReservation,
    expiredPendingOrderReservation,
    serverOffsetMs,
    localNowMs: nowMs,
  })

  async function handleProceedToCheckout() {
    if (!user) {
      router.push('/entrar?from=/carrinho')
      return
    }
    if (hasUnavailableItem || isMutatingReservation) return

    const outcome = await reserveCart()
    if (outcome.ok) {
      router.push('/checkout')
    }
  }

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

        {recoverablePendingOrderCode ? (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-terracota/40 bg-aubergine-400/10 px-4 py-3 text-sm text-ink"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-terracota-600" aria-hidden="true" />
              <span>
                Você possui o pedido pendente{' '}
                <strong>{recoverablePendingOrderCode}</strong> aguardando confirmação de pagamento.
              </span>
            </div>
            <ButtonLink
              href={`/pedido/${encodeURIComponent(recoverablePendingOrderCode)}`}
              variant="outline"
              size="sm"
            >
              Retomar pagamento
            </ButtonLink>
          </div>
        ) : awaitingReconciliationOrderCode ? (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-border bg-surface-muted px-4 py-3 text-sm text-ink-soft"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-terracota-600" aria-hidden="true" />
              <span>
                O pedido <strong className="text-ink">{awaitingReconciliationOrderCode}</strong>{' '}
                atingiu o prazo de pagamento e aguarda atualização ou reconciliação pelo servidor.
              </span>
            </div>
            <ButtonLink
              href={`/pedido/${encodeURIComponent(awaitingReconciliationOrderCode)}`}
              variant="outline"
              size="sm"
            >
              Acompanhar status
            </ButtonLink>
          </div>
        ) : null}

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
            {/* HU-09: Cronômetro regressivo real sincronizado exclusivamente ao PostgreSQL */}
            {activeReservation || reservationExpiredNotice ? (
              <CartReservationTimer
                expiresAtIso={activeReservation?.expiraEm ?? null}
                serverOffsetMs={serverOffsetMs}
                isExpiredExternal={reservationExpiredNotice && !activeReservation}
                isBusy={isMutatingReservation}
                onExpire={() => void handleReservationExpired()}
                onRenew={() => void renewReservation()}
                onCancel={() => void cancelActiveReservation()}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface-muted/60 px-4 py-2.5 text-xs text-ink-soft">
                <span>
                  As peças serão reservadas atomicamente em seu nome por{' '}
                  <strong className="text-ink">15 minutos</strong> ao clicar em{' '}
                  <strong className="text-ink">Finalizar compra</strong>.
                </span>
                <Badge tone="neutral">Reserva ao avançar (Invariante 1)</Badge>
              </div>
            )}

            {reservationError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 border border-danger/30 bg-surface-muted px-4 py-3 text-sm text-danger"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {reservationError.status === 409 ? 'Estoque atualizado no servidor: ' : ''}
                  {reservationError.message}
                </span>
              </div>
            )}

            <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
              {/* Lista de Ateliês Independentes (Cenário 1 BDD) */}
              <div className="flex flex-col gap-6">
                {atelierGroups.map((group) => (
                  <CartAtelierGroup
                    key={group.atelierName}
                    atelierName={group.atelierName}
                    hub={group.hub}
                    lines={group.lines}
                    reservedByProduct={reservedQtyByProduct}
                    disabledControls={isMutatingReservation}
                    onQuantityChange={setQuantity}
                    onRemoveItem={removeItem}
                  />
                ))}
              </div>

              {/* Resumo do Pedido com Frete Fracionado por Origem e Consolidado */}
              <aside className="flex h-fit flex-col gap-4 bg-aubergine-400/10 border border-border p-6">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">Resumo do pedido</h2>

                <div className="flex flex-col gap-2 text-sm text-ink-soft">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium text-ink">{currency.format(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Frete ({atelierGroups.length} {atelierGroups.length === 1 ? 'origem' : 'origens'})</span>
                    <span className="text-xs font-medium text-ink-soft">
                      Calculado no checkout por origem
                    </span>
                  </div>

                  {atelierGroups.length > 1 && (
                    <ul className="flex flex-col gap-1 pl-2 text-[11px] text-ink-soft border-l border-border">
                      {atelierGroups.map((g) => (
                        <li key={g.atelierName} className="flex justify-between">
                          <span className="truncate pr-2">{g.atelierName}</span>
                          <span className="text-ink-soft">Polo {g.hub}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="border-t border-border pt-3 text-xs text-ink-soft">
                  Cada ateliê expede diretamente do seu polo cultural; o valor exato do frete é cotado pelo backend após informar o CEP de entrega no checkout.
                </p>

                <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-ink">
                  <span>Subtotal estimado</span>
                  <span>{currency.format(subtotal)}</span>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={hasUnavailableItem || isMutatingReservation}
                  aria-busy={isMutatingReservation}
                  onClick={() => void handleProceedToCheckout()}
                >
                  {isMutatingReservation ? 'Reservando peças…' : 'Finalizar compra'}
                </Button>

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
