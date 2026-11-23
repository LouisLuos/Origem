'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Navigate } from '@/components/Navigate'
import { PixPaymentPanel } from '@/components/PixPaymentPanel'
import { ResourceGate } from '@/components/AsyncState'
import { useAuth } from '@/context/AuthContext'
import { useCatalog } from '@/context/CatalogContext'
import { orderStatusLabels, paymentLabels, useOrders } from '@/context/OrderContext'
import type { Order } from '@/context/OrderContext'
import { Badge, ButtonLink, Container, currency } from '@/design-system'
import { orderService } from '@/services/orderService'
import { errorMessage } from '@/utils/errors'

export function OrderConfirmation() {
  const { id } = useParams<{ id: string }>()
  const { user, hydrated: authHydrated } = useAuth()
  const { reload: reloadCatalog } = useCatalog()
  const { getOrder, upsertOrder, status: ordersStatus } = useOrders()

  const cachedOrder = getOrder(id)
  const [fetchedOrder, setFetchedOrder] = useState<Order | null>(null)
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const order = cachedOrder ?? fetchedOrder
  const pendingExpiraIso =
    order?.status === 'PENDENTE_PAGAMENTO' ? (order.pagamentoAtual?.expiraEm ?? null) : null

  useEffect(() => {
    if (!authHydrated || !user || cachedOrder) return
    let cancelled = false
    setLoadingRemote(true)
    setRemoteError(null)

    orderService
      .getById(id)
      .then((loaded) => {
        if (!cancelled) {
          setFetchedOrder(loaded)
          upsertOrder(loaded)
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setRemoteError(errorMessage(reason, 'Pedido não encontrado.'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRemote(false)
      })

    return () => {
      cancelled = true
    }
  }, [authHydrated, user, cachedOrder, id, upsertOrder])

  // Cronômetro regressivo quando acessado diretamente para retomar Pix pendente
  useEffect(() => {
    if (!pendingExpiraIso) return
    setNowMs(Date.now())
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [pendingExpiraIso])

  const orderIdForPoll = order?.id
  const orderStatusForPoll = order?.status

  // Polling real nesta página para pedidos em PENDENTE_PAGAMENTO retomados após refresh ou link
  useEffect(() => {
    if (!orderIdForPoll || orderStatusForPoll !== 'PENDENTE_PAGAMENTO') return
    let cancelled = false
    let intervalId: number | undefined

    const pollOnce = async () => {
      try {
        const updated = await orderService.getById(orderIdForPoll)
        if (cancelled) return
        setFetchedOrder(updated)
        upsertOrder(updated)
        if (updated.status !== 'PENDENTE_PAGAMENTO') {
          if (intervalId !== undefined) window.clearInterval(intervalId)
          reloadCatalog()
        }
      } catch {
        // Mantém polling resiliente
      }
    }

    intervalId = window.setInterval(() => {
      void pollOnce()
    }, 3000)

    return () => {
      cancelled = true
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [orderIdForPoll, orderStatusForPoll, upsertOrder, reloadCatalog])

  if (!authHydrated) {
    return <ResourceGate status="loading" label="Verificando sessão…" />
  }

  if (!user) {
    return <Navigate to={`/entrar?from=/pedido/${encodeURIComponent(id)}`} />
  }

  if (!order && (ordersStatus === 'loading' || loadingRemote)) {
    return <ResourceGate status="loading" label="Carregando pedido…" />
  }

  if (!order) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <div className="flex flex-col items-center gap-4 border border-dashed border-border py-16 text-center">
            <p className="text-base font-medium text-ink">Pedido não encontrado</p>
            <p className="text-sm text-ink-soft">
              {remoteError || 'Este pedido não existe ou pertence a outra conta.'}
            </p>
            <ButtonLink href="/conta" variant="primary" size="md">
              Ver minha conta
            </ButtonLink>
          </div>
        </Container>
      </main>
    )
  }

  const { enderecoEntrega, pagamentoAtual } = order
  const aprovado = order.status === 'APROVADO'
  const erroOuRecusa =
    order.status === 'RECUSADO' ||
    order.status === 'EXPIRADO' ||
    order.status === 'CANCELADO' ||
    order.status === 'RECONCILIACAO_ESTORNO'
  const remainingSeconds = pendingExpiraIso
    ? Math.max(0, Math.floor((new Date(pendingExpiraIso).getTime() - nowMs) / 1000))
    : 0

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <div className="flex flex-col items-center gap-3 pb-10 text-center">
          {aprovado ? (
            <CheckCircle2 className="h-12 w-12 text-oliva-500" aria-hidden="true" />
          ) : erroOuRecusa ? (
            <AlertTriangle className="h-12 w-12 text-danger" aria-hidden="true" />
          ) : (
            <Clock className="h-12 w-12 text-terracota-600" aria-hidden="true" />
          )}

          <Badge tone={aprovado ? 'oliva' : 'neutral'}>{orderStatusLabels[order.status]}</Badge>

          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
            {aprovado
              ? 'Pagamento aprovado e pedido confirmado!'
              : order.status === 'PENDENTE_PAGAMENTO'
                ? 'Aguardando confirmação do pagamento'
                : orderStatusLabels[order.status]}
          </h1>

          <p className="text-sm text-ink-soft">
            {aprovado
              ? `Obrigado, ${enderecoEntrega.nomeDestinatario.split(' ')[0]}. Enviamos a confirmação para ${enderecoEntrega.email}.`
              : order.reconciliacaoMotivo ||
                pagamentoAtual?.erroSanitizado ||
                'Acompanhe o status real do pedido abaixo.'}
          </p>

          <span className="border border-border bg-surface px-4 py-1.5 text-sm font-semibold tracking-widest text-ink">
            {order.codigoPedido}
          </span>

          {pagamentoAtual?.ambiente === 'sandbox' && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
              <ShieldCheck className="h-3.5 w-3.5 text-terracota-600" aria-hidden="true" />
              Transação em ambiente sandbox ({pagamentoAtual.gateway}) — sem cobrança real
            </span>
          )}
        </div>

        {order.status === 'PENDENTE_PAGAMENTO' &&
          order.metodoPagamento === 'PIX' &&
          pagamentoAtual && (
            <div className="mx-auto mb-10 max-w-2xl">
              <PixPaymentPanel pagamento={pagamentoAtual} remainingSeconds={remainingSeconds} />
            </div>
          )}

        <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
          <div className="flex flex-col gap-6">
            <ul className="flex flex-col">
              {order.itens.map((line) => (
                <li key={line.pecaId} className="flex items-center gap-4 border-b border-border py-4 first:pt-0">
                  {line.fotoPrincipalUrl && (
                    <img
                      src={line.fotoPrincipalUrl}
                      alt={line.titulo}
                      className="h-20 w-20 shrink-0 object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col">
                    <Link
                      href={`/produtos/${line.pecaId}`}
                      className="font-medium text-ink hover:text-terracota-600 hover:underline underline-offset-4"
                    >
                      {line.titulo}
                    </Link>
                    <span className="text-xs text-ink-soft">
                      Ateliê {line.atelieNome} ({line.poloCultural})
                    </span>
                    <span className="text-xs text-ink-soft">
                      {line.quantidade} × {currency.format(line.precoUnitario)}
                    </span>
                  </div>
                  <span className="font-semibold text-ink">{currency.format(line.subtotalItem)}</span>
                </li>
              ))}
            </ul>

            {order.fretesPorOrigem.length > 0 && (
              <div className="border border-border bg-surface p-4">
                <h2 className="pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
                  Detalhamento logístico por origem
                </h2>
                <ul className="flex flex-col gap-2 text-xs text-ink-soft">
                  {order.fretesPorOrigem.map((frete) => (
                    <li key={frete.atelieId} className="flex justify-between gap-4">
                      <span>
                        <strong className="text-ink">{frete.atelieNome}</strong> ({frete.poloCultural} · CEP{' '}
                        {frete.cepOrigem}) · est. {frete.prazoEstimadoDias} dia(s)
                      </span>
                      <span className="font-medium text-ink">{currency.format(frete.valorBrl)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="flex h-fit flex-col gap-4 border border-border bg-aubergine-400/10 p-6 text-sm text-ink-soft">
            <div>
              <h2 className="pb-1 text-xs font-semibold uppercase tracking-widest text-ink">Entrega</h2>
              <address className="not-italic">
                {enderecoEntrega.logradouro}, {enderecoEntrega.numero}
                {enderecoEntrega.complemento && ` — ${enderecoEntrega.complemento}`}
                <br />
                {enderecoEntrega.bairro} · {enderecoEntrega.cidade}/{enderecoEntrega.uf}
                <br />
                CEP {enderecoEntrega.cep}
              </address>
            </div>
            <div className="border-t border-border pt-3">
              <h2 className="pb-1 text-xs font-semibold uppercase tracking-widest text-ink">Pagamento</h2>
              <p className="text-ink">{paymentLabels[order.metodoPagamento]}</p>
              {pagamentoAtual?.cartaoBandeira && pagamentoAtual.cartaoUltimosDigitos && (
                <p className="text-xs text-ink-soft">
                  {pagamentoAtual.cartaoBandeira} •••• {pagamentoAtual.cartaoUltimosDigitos} ({pagamentoAtual.parcelas}x)
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex justify-between">
                <span>Peças</span>
                <span className="text-ink">{currency.format(order.valorTotalPecas)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frete multi-origem</span>
                <span className="text-ink">{currency.format(order.valorTotalFrete)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-ink">
                <span>Total</span>
                <span>{currency.format(order.valorTotalPedido)}</span>
              </div>
            </div>
            <ButtonLink href="/#vitrine" variant="outline" size="md" className="w-full">
              Continuar comprando
            </ButtonLink>
          </aside>
        </div>
      </Container>
    </main>
  )
}
