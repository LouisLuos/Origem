import { ChevronRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Container, currency } from '@/design-system'
import { allProducts } from '@/data/mockProducts'
import { useCart } from '@/context/CartContext'

const FREE_SHIPPING_THRESHOLD = 250

export function Cart() {
  const { items, removeItem, setQuantity } = useCart()
  const navigate = useNavigate()

  const cartLines = items
    .map((item) => {
      const product = allProducts.find((candidate) => candidate.id === item.id)
      return product ? { product, quantity: item.quantity } : null
    })
    .filter((line): line is { product: (typeof allProducts)[number]; quantity: number } => line !== null)

  const subtotal = cartLines.reduce((total, line) => total + line.product.price * line.quantity, 0)
  const missingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1.5 pb-6 text-xs text-ink-soft">
          <Link to="/#vitrine" className="hover:text-terracota-600 hover:underline underline-offset-4">
            Vitrine
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span aria-current="page" className="text-ink">
            Carrinho
          </span>
        </nav>

        <h1 className="pb-8 text-2xl font-semibold text-ink sm:text-3xl">Seu carrinho</h1>

        {cartLines.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-ink-soft/60" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-base font-medium text-ink">Seu carrinho está vazio</p>
              <p className="text-sm text-ink-soft">Explore a vitrine e leve um pedaço de Pernambuco pra casa.</p>
            </div>
            <Button variant="primary" size="md" onClick={() => navigate('/#vitrine')}>
              Ver vitrine
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
            <ul className="flex flex-col">
              {cartLines.map(({ product, quantity }) => (
                <li key={product.id} className="flex gap-4 border-b border-border py-6 first:pt-0">
                  <Link to={`/produtos/${product.id}`} className="h-24 w-24 shrink-0 overflow-hidden bg-surface-muted sm:h-28 sm:w-28">
                    <img src={product.imageUrl} alt={product.imageAlt} className="h-full w-full object-cover" />
                  </Link>

                  <div className="flex flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] uppercase tracking-widest text-ink-soft/70">
                        {product.technique} · {product.hub}
                      </span>
                      <Link
                        to={`/produtos/${product.id}`}
                        className="font-medium text-ink hover:text-terracota-600 hover:underline underline-offset-4"
                      >
                        {product.title}
                      </Link>
                      <span className="text-xs text-ink-soft">por {product.artisan}</span>

                      <div className="mt-2 flex h-10 w-fit items-center border border-border">
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, quantity - 1)}
                          aria-label={`Diminuir quantidade de ${product.title}`}
                          className="flex h-full w-9 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span aria-live="polite" className="w-8 text-center text-sm font-semibold text-ink">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, quantity + 1)}
                          disabled={quantity >= 10}
                          aria-label={`Aumentar quantidade de ${product.title}`}
                          className="flex h-full w-9 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-terracota-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className="font-semibold text-ink">{currency.format(product.price * quantity)}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        aria-label={`Remover ${product.title} do carrinho`}
                        className="flex cursor-pointer items-center gap-1 text-xs text-ink-soft transition-colors hover:text-terracota-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="flex h-fit flex-col gap-4 bg-aubergine-400/10 border border-border p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">Resumo do pedido</h2>

              <div className="flex flex-col gap-2 text-sm text-ink-soft">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium text-ink">{currency.format(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Frete</span>
                  <span>Calculado no checkout</span>
                </div>
              </div>

              {missingForFreeShipping > 0 ? (
                <p className="border-t border-border pt-3 text-xs text-ink-soft">
                  Faltam {currency.format(missingForFreeShipping)} para frete grátis.
                </p>
              ) : (
                <p className="border-t border-border pt-3 text-xs text-oliva-600">
                  Seu pedido tem direito a frete grátis.
                </p>
              )}

              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-ink">
                <span>Total</span>
                <span>{currency.format(subtotal)}</span>
              </div>

              <Button variant="primary" size="lg">
                Finalizar compra
              </Button>
              <Link
                to="/#vitrine"
                className="text-center text-sm text-ink-soft underline-offset-4 hover:text-terracota-600 hover:underline"
              >
                Continuar comprando
              </Link>
            </aside>
          </div>
        )}
      </Container>
    </main>
  )
}
