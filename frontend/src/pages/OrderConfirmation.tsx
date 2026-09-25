import { CheckCircle2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button, Container, currency } from '@/design-system'
import { LoadingBlock } from '@/components/AsyncState'
import { useOrders } from '@/context/OrderContext'
import type { PaymentMethod } from '@/context/OrderContext'

const paymentLabels: Record<PaymentMethod, string> = {
  pix: 'Pix',
  card: 'Cartão de crédito',
  boleto: 'Boleto',
}

export function OrderConfirmation() {
  const { id } = useParams()
  const { getOrder, status } = useOrders()
  const order = id ? getOrder(id) : undefined

  if (!order && status === 'loading') {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <LoadingBlock label="Carregando pedido…" />
        </Container>
      </main>
    )
  }

  if (!order) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <div className="flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
            <p className="text-base font-medium text-ink">Pedido não encontrado</p>
            <p className="text-sm text-ink-soft">Os pedidos simulados ficam salvos apenas neste navegador.</p>
            <Link to="/#vitrine">
              <Button variant="primary" size="md">
                Ver vitrine
              </Button>
            </Link>
          </div>
        </Container>
      </main>
    )
  }

  const { customer } = order

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <div className="flex flex-col items-center gap-3 pb-10 text-center">
          <CheckCircle2 className="h-12 w-12 text-oliva-500" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Pedido confirmado!</h1>
          <p className="text-sm text-ink-soft">
            Obrigado, {customer.name.split(' ')[0]}. Enviamos os detalhes para {customer.email}.
          </p>
          <span className="border border-border bg-surface px-4 py-1.5 text-sm font-semibold tracking-widest text-ink">
            {order.id}
          </span>
        </div>

        <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
          <ul className="flex flex-col">
            {order.lines.map((line) => (
              <li key={line.productId} className="flex items-center gap-4 border-b border-border py-4 first:pt-0">
                <img src={line.imageUrl} alt={line.imageAlt} className="h-20 w-20 shrink-0 object-cover" />
                <div className="flex flex-1 flex-col">
                  <Link
                    to={`/produtos/${line.productId}`}
                    className="font-medium text-ink hover:text-terracota-600 hover:underline underline-offset-4"
                  >
                    {line.title}
                  </Link>
                  <span className="text-xs text-ink-soft">por {line.artisan}</span>
                  <span className="text-xs text-ink-soft">
                    {line.quantity} × {currency.format(line.unitPrice)}
                  </span>
                </div>
                <span className="font-semibold text-ink">{currency.format(line.unitPrice * line.quantity)}</span>
              </li>
            ))}
          </ul>

          <aside className="flex h-fit flex-col gap-4 border border-border bg-aubergine-400/10 p-6 text-sm text-ink-soft">
            <div>
              <h2 className="pb-1 text-xs font-semibold uppercase tracking-widest text-ink">Entrega</h2>
              <address className="not-italic">
                {customer.street}, {customer.number}
                {customer.complement && ` — ${customer.complement}`}
                <br />
                {customer.neighborhood} · {customer.city}/{customer.state}
                <br />
                CEP {customer.zip}
              </address>
            </div>
            <div className="border-t border-border pt-3">
              <h2 className="pb-1 text-xs font-semibold uppercase tracking-widest text-ink">Pagamento</h2>
              {paymentLabels[order.paymentMethod]}
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-ink">{currency.format(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frete</span>
                <span className="text-ink">{order.shipping === 0 ? 'Grátis' : currency.format(order.shipping)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-ink">
                <span>Total</span>
                <span>{currency.format(order.total)}</span>
              </div>
            </div>
            <Link to="/#vitrine">
              <Button variant="outline" size="md" className="w-full">
                Continuar comprando
              </Button>
            </Link>
          </aside>
        </div>
      </Container>
    </main>
  )
}
