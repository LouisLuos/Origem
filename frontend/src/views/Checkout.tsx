'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navigate } from '@/components/Navigate'
import { CardTokenizationForm } from '@/components/CardTokenizationForm'
import { ResourceGate } from '@/components/AsyncState'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useCatalog } from '@/context/CatalogContext'
import { orderStatusLabels, paymentLabels, useOrders } from '@/context/OrderContext'
import type {
  CheckoutShippingQuote,
  Order,
  OrderCustomer,
  PaymentMethod,
  TokenizedCardInput,
} from '@/context/OrderContext'
import { Badge, Button, ButtonLink, Container, Input, cn, currency } from '@/design-system'
import { addressService } from '@/services/addressService'
import { isApiError } from '@/services/api'
import { orderService } from '@/services/orderService'
import { stockService, type StockReservationGroup } from '@/services/stockService'
import { errorMessage } from '@/utils/errors'

const paymentOptions: { id: PaymentMethod; label: string; hint: string; icon: typeof QrCode }[] = [
  {
    id: 'PIX',
    label: 'Pix',
    hint: 'QR Code dinâmico e Copia e Cola com expiração sincronizada à reserva',
    icon: QrCode,
  },
  {
    id: 'CARTAO_CREDITO',
    label: 'Cartão de crédito',
    hint: 'Tokenização segura no navegador e captura em até 12x',
    icon: CreditCard,
  },
]

interface CustomerFormState {
  name: string
  email: string
  phone: string
  zip: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

interface CartCheckoutLine {
  readonly productId: string
  readonly title: string
  readonly imageUrl: string
  readonly imageAlt: string
  readonly artisan: string
  readonly unitPrice: number
  readonly quantity: number
}

const emptyCustomer: CustomerFormState = {
  name: '',
  email: '',
  phone: '',
  zip: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

const requiredFields: (keyof CustomerFormState)[] = [
  'name',
  'email',
  'phone',
  'zip',
  'street',
  'number',
  'neighborhood',
  'city',
  'state',
]

type Errors = Partial<Record<keyof CustomerFormState, string>>

const onlyDigits = (value: string) => value.replace(/\D/g, '')

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatZip(value: string) {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds)
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const formatters: Partial<Record<keyof CustomerFormState, (value: string) => string>> = {
  phone: formatPhone,
  zip: formatZip,
  state: (value) => value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(),
}

function validate(customer: CustomerFormState): Errors {
  const errors: Errors = {}
  for (const field of requiredFields) {
    if (!customer[field].trim()) errors[field] = 'Campo obrigatório'
  }
  if (!errors.phone && ![10, 11].includes(onlyDigits(customer.phone).length)) {
    errors.phone = 'Telefone inválido'
  }
  if (!errors.email && !/^\S+@\S+\.\S+$/.test(customer.email)) {
    errors.email = 'E-mail inválido'
  }
  if (!errors.zip && onlyDigits(customer.zip).length !== 8) {
    errors.zip = 'CEP deve ter 8 dígitos'
  }
  if (!errors.state && !/^[A-Za-z]{2}$/.test(customer.state.trim())) {
    errors.state = 'Use a sigla (ex.: PE)'
  }
  return errors
}

function toOrderCustomer(customer: CustomerFormState): OrderCustomer {
  return {
    nomeDestinatario: customer.name.trim(),
    email: customer.email.trim(),
    telefone: onlyDigits(customer.phone),
    cep: onlyDigits(customer.zip),
    logradouro: customer.street.trim(),
    numero: customer.number.trim(),
    ...(customer.complement.trim() ? { complemento: customer.complement.trim() } : {}),
    bairro: customer.neighborhood.trim(),
    cidade: customer.city.trim(),
    uf: customer.state.trim().toUpperCase(),
  }
}

interface ActiveReservationState {
  readonly reservation: StockReservationGroup
  readonly snapshotLines: readonly CartCheckoutLine[]
  readonly customerSnapshot: OrderCustomer
  readonly cancelledMessage?: string
}

export function Checkout() {
  const router = useRouter()
  const { lines: cartLines, clearCart } = useCart()
  const { status: catalogStatus, error: catalogError, reload: reloadCatalog } = useCatalog()
  const { user, hydrated: authHydrated } = useAuth()
  const { placeOrder, upsertOrder } = useOrders()

  const [customer, setCustomer] = useState<CustomerFormState>(() => ({
    ...emptyCustomer,
    name: user?.name ?? '',
    email: user?.email ?? '',
  }))
  const [payment, setPayment] = useState<PaymentMethod>('PIX')
  const [errors, setErrors] = useState<Errors>({})
  const [isReserving, setIsReserving] = useState(false)
  const [reserveError, setReserveError] = useState<{ status?: number; message: string } | null>(null)
  const [zipStatus, setZipStatus] = useState<'idle' | 'loading' | 'notFound' | 'error'>('idle')

  const [activeReservation, setActiveReservation] = useState<ActiveReservationState | null>(null)
  const [shippingQuote, setShippingQuote] = useState<CheckoutShippingQuote | null>(null)
  const [shippingStatus, setShippingStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [shippingError, setShippingError] = useState<string | null>(null)

  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [isPaying, setIsPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [copiedPix, setCopiedPix] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const reserveIdempotencyRef = useRef<{ signature: string; key: string } | null>(null)
  const checkoutIdempotencyRef = useRef<{ signature: string; key: string } | null>(null)

  useEffect(() => {
    if (!user) return
    setCustomer((prev) => ({
      ...prev,
      name: prev.name || user.name,
      email: prev.email || user.email,
    }))
  }, [user])

  const zipDigits = onlyDigits(customer.zip)
  useEffect(() => {
    if (zipDigits.length !== 8) {
      setZipStatus('idle')
      return
    }
    const controller = new AbortController()
    setZipStatus('loading')
    addressService
      .lookup(zipDigits, controller.signal)
      .then((address) => {
        if (!address) {
          setZipStatus('notFound')
          return
        }
        setCustomer((prev) => ({
          ...prev,
          street: address.street || prev.street,
          neighborhood: address.neighborhood || prev.neighborhood,
          city: address.city,
          state: address.state,
        }))
        setErrors((prev) => ({
          ...prev,
          street: undefined,
          neighborhood: undefined,
          city: undefined,
          state: undefined,
        }))
        setZipStatus('idle')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setZipStatus('error')
      })
    return () => controller.abort()
  }, [zipDigits])

  // Cotação automática real multi-origem no backend logo após criar reserva HU-06
  useEffect(() => {
    if (!activeReservation || activeReservation.cancelledMessage) return
    let cancelled = false
    setShippingStatus('loading')
    setShippingError(null)
    setShippingQuote(null)

    orderService
      .quoteShipping(activeReservation.reservation.grupoId, activeReservation.customerSnapshot.cep)
      .then((quote) => {
        if (!cancelled) {
          setShippingQuote(quote)
          setShippingStatus('ready')
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setShippingError(errorMessage(reason, 'Não foi possível calcular o frete multi-origem.'))
          setShippingStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeReservation])

  // Cronômetro em tempo real sincronizado estritamente com `expiraEm` do servidor
  const targetExpirationIso =
    activeOrder?.pagamentoAtual?.expiraEm ?? activeReservation?.reservation.expiraEm ?? null
  useEffect(() => {
    if (!targetExpirationIso || activeReservation?.cancelledMessage) return
    setNowMs(Date.now())
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [targetExpirationIso, activeReservation?.cancelledMessage])

  const remainingSeconds = targetExpirationIso
    ? Math.max(0, Math.floor((new Date(targetExpirationIso).getTime() - nowMs) / 1000))
    : 0

  // Polling real do status do pedido enquanto estiver PENDENTE_PAGAMENTO
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'PENDENTE_PAGAMENTO') return
    let cancelled = false
    let intervalId: number | undefined

    const pollOnce = async () => {
      try {
        const updated = await orderService.getById(activeOrder.id)
        if (cancelled) return
        setActiveOrder(updated)
        upsertOrder(updated)

        if (updated.status === 'APROVADO') {
          if (intervalId !== undefined) window.clearInterval(intervalId)
          reloadCatalog()
          router.push(`/pedido/${encodeURIComponent(updated.codigoPedido)}`)
        } else if (
          updated.status === 'RECUSADO' ||
          updated.status === 'EXPIRADO' ||
          updated.status === 'CANCELADO' ||
          updated.status === 'RECONCILIACAO_ESTORNO'
        ) {
          if (intervalId !== undefined) window.clearInterval(intervalId)
          reloadCatalog()
        }
      } catch {
        // Mantém polling resiliente até expirar ou atingir estado terminal
      }
    }

    intervalId = window.setInterval(() => {
      void pollOnce()
    }, 3000)

    return () => {
      cancelled = true
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [activeOrder, router, upsertOrder, reloadCatalog])

  if (!authHydrated) {
    return <ResourceGate status="loading" label="Verificando sessão…" />
  }

  if (!user && !activeReservation) {
    return <Navigate to="/entrar?from=/checkout" />
  }

  const lines: CartCheckoutLine[] = cartLines.map(({ product, quantity }) => ({
    productId: product.id,
    title: product.title,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    artisan: product.artisan,
    unitPrice: product.price,
    quantity,
  }))

  function getCheckoutIdempotencyKey(grupoId: string, method: PaymentMethod): string {
    const sig = `${grupoId}:${method}`
    if (checkoutIdempotencyRef.current?.signature !== sig) {
      checkoutIdempotencyRef.current = { signature: sig, key: crypto.randomUUID() }
    }
    return checkoutIdempotencyRef.current.key
  }

  async function submitCheckout(method: PaymentMethod, card?: TokenizedCardInput) {
    if (!activeReservation || isPaying || remainingSeconds <= 0) return

    setPaymentError(null)
    setIsPaying(true)
    const idempotencyKey = getCheckoutIdempotencyKey(activeReservation.reservation.grupoId, method)

    try {
      const response = await placeOrder(
        {
          reservaGrupoId: activeReservation.reservation.grupoId,
          metodoPagamento: method,
          enderecoEntrega: activeReservation.customerSnapshot,
          ...(card ? { cartao: card } : {}),
        },
        idempotencyKey,
      )

      setActiveOrder(response.pedido)
      if (response.pedido.status === 'APROVADO') {
        reloadCatalog()
        router.push(`/pedido/${encodeURIComponent(response.pedido.codigoPedido)}`)
      } else if (
        response.pedido.status === 'RECUSADO' ||
        response.pedido.status === 'EXPIRADO' ||
        response.pedido.status === 'CANCELADO'
      ) {
        // Prepara nova chave caso o usuário recomece com nova reserva após recusa
        checkoutIdempotencyRef.current = null
        reloadCatalog()
      }
    } catch (reason) {
      setPaymentError(errorMessage(reason, 'Não foi possível concluir o pagamento.'))
      checkoutIdempotencyRef.current = null
    } finally {
      setIsPaying(false)
    }
  }

  // Tela 2 — Reserva ativa, cotação multi-origem e captura real (Pix ou Cartão tokenizado)
  if (activeReservation) {
    const { reservation, snapshotLines, cancelledMessage } = activeReservation
    const pagamentoAtual = activeOrder?.pagamentoAtual ?? null
    const expiredOnClock = !cancelledMessage && remainingSeconds <= 0

    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col gap-6 border border-border bg-surface p-6 sm:p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              {cancelledMessage ? (
                <RotateCcw className="h-11 w-11 text-terracota-600" aria-hidden="true" />
              ) : activeOrder?.status === 'RECUSADO' ? (
                <AlertTriangle className="h-11 w-11 text-danger" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-11 w-11 text-oliva-600" aria-hidden="true" />
              )}

              <Badge
                tone={
                  cancelledMessage || activeOrder?.status === 'RECUSADO' || expiredOnClock
                    ? 'neutral'
                    : 'oliva'
                }
              >
                {cancelledMessage
                  ? 'Reserva cancelada'
                  : activeOrder
                    ? orderStatusLabels[activeOrder.status]
                    : 'Reserva ativa · etapa de pagamento'}
              </Badge>

              <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
                {cancelledMessage
                  ? 'Estoque devolvido à vitrine'
                  : activeOrder?.status === 'RECUSADO'
                    ? 'Pagamento não autorizado'
                    : activeOrder?.status === 'RECONCILIACAO_ESTORNO'
                      ? 'Pagamento tardio em reconciliação'
                      : expiredOnClock || activeOrder?.status === 'EXPIRADO'
                        ? 'Prazo da reserva expirado'
                        : activeOrder?.metodoPagamento === 'PIX'
                          ? 'Pague com Pix para confirmar o pedido'
                          : 'Finalize o pagamento do seu pedido'}
              </h1>

              <p className="text-sm text-ink-soft">
                {cancelledMessage
                  ? cancelledMessage
                  : activeOrder?.status === 'RECUSADO'
                    ? pagamentoAtual?.erroSanitizado ||
                      'A transação foi recusada pelo provedor e o estoque reservado foi devolvido automaticamente ao acervo.'
                    : activeOrder?.status === 'RECONCILIACAO_ESTORNO'
                      ? activeOrder.reconciliacaoMotivo ||
                        'O pagamento foi confirmado após o vencimento da reserva e será estornado/reconciliado.'
                      : expiredOnClock || activeOrder?.status === 'EXPIRADO'
                        ? 'O prazo de 15 minutos desta reserva terminou. Retorne à vitrine para iniciar uma nova compra.'
                        : 'As peças estão garantidas em seu nome até o fim do cronômetro. A confirmação só ocorre após retorno oficial do gateway.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface-muted px-4 py-3 text-xs text-ink-soft">
              <span>
                {activeOrder ? (
                  <>
                    Pedido <strong className="text-ink">{activeOrder.codigoPedido}</strong>
                  </>
                ) : (
                  <>
                    Reserva <strong className="text-ink">{reservation.grupoId}</strong>
                  </>
                )}
              </span>

              {!cancelledMessage && activeOrder?.status !== 'RECUSADO' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 font-semibold',
                    expiredOnClock ? 'text-danger' : 'text-ink',
                  )}
                >
                  <Clock className="h-3.5 w-3.5 text-terracota-600" aria-hidden="true" />
                  {expiredOnClock ? 'Expirada (00:00)' : `Expira em ${formatCountdown(remainingSeconds)}`}
                </span>
              )}
            </div>

            {pagamentoAtual?.ambiente === 'sandbox' && (
              <div className="flex items-center gap-2 border border-border bg-aubergine-400/10 px-4 py-2.5 text-xs text-ink">
                <ShieldCheck className="h-4 w-4 shrink-0 text-terracota-600" aria-hidden="true" />
                <span>
                  <strong>Ambiente Sandbox ({pagamentoAtual.gateway})</strong> — operação em modo de homologação, sem cobrança real.
                </span>
              </div>
            )}

            {/* Painel de pagamento Pix gerado */}
            {activeOrder &&
              activeOrder.status === 'PENDENTE_PAGAMENTO' &&
              activeOrder.metodoPagamento === 'PIX' &&
              pagamentoAtual &&
              !expiredOnClock && (
                <section
                  aria-label="Pagamento via Pix"
                  className="flex flex-col items-center gap-4 border border-terracota/40 bg-surface-muted/30 p-6"
                >
                  {pagamentoAtual.pixQrCodeBase64 ? (
                    <img
                      src={
                        pagamentoAtual.pixQrCodeBase64.startsWith('data:')
                          ? pagamentoAtual.pixQrCodeBase64
                          : `data:image/png;base64,${pagamentoAtual.pixQrCodeBase64}`
                      }
                      alt="QR Code Pix para pagamento do pedido"
                      className="h-52 w-52 border border-border bg-white p-2 object-contain"
                    />
                  ) : pagamentoAtual.pixTicketUrl ? (
                    <img
                      src={pagamentoAtual.pixTicketUrl}
                      alt="QR Code Pix para pagamento do pedido"
                      className="h-52 w-52 border border-border bg-white p-2 object-contain"
                    />
                  ) : null}

                  {pagamentoAtual.pixCopiaECola && (
                    <div className="flex w-full max-w-lg flex-col gap-2">
                      <label htmlFor="pix-copia-e-cola" className="text-xs font-medium text-ink">
                        Pix Copia e Cola
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="pix-copia-e-cola"
                          readOnly
                          value={pagamentoAtual.pixCopiaECola}
                          className="min-w-0 flex-1 border border-border bg-surface px-3 py-2 text-xs text-ink"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!pagamentoAtual.pixCopiaECola) return
                            await navigator.clipboard.writeText(pagamentoAtual.pixCopiaECola)
                            setCopiedPix(true)
                            window.setTimeout(() => setCopiedPix(false), 2500)
                          }}
                        >
                          {copiedPix ? (
                            <>
                              <Check className="h-4 w-4 text-oliva-600" aria-hidden="true" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" aria-hidden="true" />
                              Copiar código Pix
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  <p className="text-center text-xs text-ink-soft">
                    Aguardando confirmação em tempo real do provedor de pagamento… Esta tela atualiza automaticamente após o recebimento do webhook oficial.
                  </p>
                </section>
              )}

            {/* Itens reservados */}
            <ul className="flex flex-col divide-y divide-border/60">
              {snapshotLines.map((line) => (
                <li key={line.productId} className="flex items-center gap-3 py-3">
                  <img src={line.imageUrl} alt={line.imageAlt} className="h-14 w-14 shrink-0 object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{line.title}</span>
                    <span className="text-xs text-ink-soft">
                      {line.quantity} × {currency.format(line.unitPrice)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-ink">
                    {currency.format(line.unitPrice * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Detalhamento multi-origem calculado no backend */}
            {shippingStatus === 'loading' && (
              <p className="text-sm text-ink-soft">Calculando frete multi-origem no servidor…</p>
            )}

            {shippingStatus === 'error' && shippingError && (
              <div role="alert" className="flex items-start gap-2 border border-danger/30 bg-surface-muted p-4 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{shippingError}</span>
              </div>
            )}

            {shippingQuote && (
              <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm">
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ink">
                    <Truck className="h-3.5 w-3.5 text-terracota-600" aria-hidden="true" />
                    Fretes por ateliê de origem (calculados no servidor)
                  </span>
                  {shippingQuote.fretesPorOrigem.map((origem) => (
                    <div
                      key={origem.atelieId}
                      className="flex flex-wrap items-center justify-between gap-2 bg-surface-muted/50 px-3 py-2 text-xs"
                    >
                      <span className="text-ink-soft">
                        <strong className="text-ink">{origem.atelieNome}</strong> ({origem.poloCultural} · CEP{' '}
                        {origem.cepOrigem}) — prazo est. {origem.prazoEstimadoDias} dia(s)
                      </span>
                      <span className="font-medium text-ink">{currency.format(origem.valorBrl)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-ink-soft">
                  <span>Subtotal das peças</span>
                  <span className="text-ink">{currency.format(shippingQuote.valorTotalPecas)}</span>
                </div>
                <div className="flex justify-between text-ink-soft">
                  <span>Total do frete ({shippingQuote.fretesPorOrigem.length} origem/ns)</span>
                  <span className="text-ink">{currency.format(shippingQuote.valorTotalFrete)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-ink">
                  <span>Total consolidado</span>
                  <span>{currency.format(shippingQuote.valorTotalPedido)}</span>
                </div>
              </div>
            )}

            {/* Escolha de pagamento e captura (somente enquanto ainda não há pedido aberto nem cancelado/expirado) */}
            {!cancelledMessage && !expiredOnClock && !activeOrder && shippingStatus === 'ready' && shippingQuote && (
              <section aria-label="Forma de pagamento" className="flex flex-col gap-4 border-t border-border pt-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">
                  Escolha a forma de pagamento
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {paymentOptions.map(({ id, label, hint, icon: Icon }) => (
                    <label
                      key={id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 border bg-surface px-4 py-3 transition-colors',
                        payment === id ? 'border-terracota' : 'border-border hover:border-ink-soft/50',
                      )}
                    >
                      <input
                        type="radio"
                        name="checkout-payment"
                        value={id}
                        checked={payment === id}
                        onChange={() => {
                          setPaymentError(null)
                          setPayment(id)
                        }}
                        className="mt-1 h-4 w-4 accent-terracota"
                      />
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-ink-soft" aria-hidden="true" />
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-ink">{label}</span>
                        <span className="text-xs text-ink-soft">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {paymentError && (
                  <p role="alert" className="border border-danger/30 bg-surface-muted px-4 py-3 text-sm text-danger">
                    {paymentError}
                  </p>
                )}

                {payment === 'PIX' ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    disabled={isPaying || remainingSeconds <= 0}
                    aria-busy={isPaying}
                    onClick={() => void submitCheckout('PIX')}
                  >
                    {isPaying
                      ? 'Gerando cobrança Pix…'
                      : `Gerar Pix (${currency.format(shippingQuote.valorTotalPedido)})`}
                  </Button>
                ) : (
                  <CardTokenizationForm
                    totalAmount={shippingQuote.valorTotalPedido}
                    disabled={remainingSeconds <= 0}
                    isSubmittingParent={isPaying}
                    onTokenized={(card) => submitCheckout('CARTAO_CREDITO', card)}
                  />
                )}
              </section>
            )}

            {cancelError && (
              <p role="alert" className="border border-danger/30 bg-surface-muted px-4 py-3 text-sm text-danger">
                {cancelError}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              {!cancelledMessage && !activeOrder && !expiredOnClock && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={isCancelling}
                  aria-busy={isCancelling}
                  onClick={async () => {
                    setCancelError(null)
                    setIsCancelling(true)
                    try {
                      const res = await stockService.cancelReservation(reservation.grupoId)
                      reloadCatalog()
                      setActiveReservation((prev) =>
                        prev
                          ? {
                              ...prev,
                              cancelledMessage: `Reserva cancelada no servidor: ${res.unidadesDevolvidas} unidade(s) devolvida(s) ao estoque disponível.`,
                            }
                          : null,
                      )
                    } catch (reason) {
                      setCancelError(errorMessage(reason, 'Não foi possível cancelar a reserva.'))
                    } finally {
                      setIsCancelling(false)
                    }
                  }}
                >
                  {isCancelling ? 'Devolvendo estoque…' : 'Cancelar reserva e devolver estoque'}
                </Button>
              )}

              <ButtonLink href="/#vitrine" variant="primary" size="md">
                Voltar à vitrine
              </ButtonLink>
            </div>
          </div>
        </Container>
      </main>
    )
  }

  if (catalogStatus !== 'ready' && !isReserving) {
    return (
      <ResourceGate
        status={catalogStatus}
        label="Carregando seu pedido…"
        error={catalogError}
        onRetry={reloadCatalog}
      />
    )
  }

  if (lines.length === 0 && !isReserving) return <Navigate to="/carrinho" />

  const subtotal = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0)
  const hasStockMismatch = cartLines.some(
    (line) => line.product.stock === 0 || line.quantity > (line.product.stock ?? line.quantity),
  )

  const update = (name: keyof CustomerFormState) => (event: { target: { value: string } }) => {
    const value = formatters[name]?.(event.target.value) ?? event.target.value
    setCustomer((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const field = (
    name: keyof CustomerFormState,
    label: string,
    extra: Record<string, string | number> = {},
  ) => (
    <div className="flex flex-col gap-1">
      <Input
        label={label}
        value={customer[name]}
        onChange={update(name)}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        className={cn('py-2.5', errors[name] && 'border-danger')}
        {...extra}
      />
      {errors[name] && (
        <span id={`${name}-error`} role="alert" className="text-xs text-danger">
          {errors[name]}
        </span>
      )}
      {name === 'zip' && !errors.zip && zipStatus !== 'idle' && (
        <span
          role="status"
          className={cn('text-xs', zipStatus === 'loading' ? 'text-ink-soft' : 'text-danger')}
        >
          {zipStatus === 'loading' && 'Buscando endereço…'}
          {zipStatus === 'notFound' && 'CEP não encontrado. Preencha o endereço manualmente.'}
          {zipStatus === 'error' && 'Não foi possível buscar o CEP. Preencha manualmente.'}
        </span>
      )}
    </div>
  )

  const handleReserveSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate(customer)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (hasStockMismatch) {
      setReserveError({
        status: 409,
        message: 'A quantidade no carrinho excede o estoque disponível. Ajuste os itens antes de reservar.',
      })
      reloadCatalog()
      return
    }

    const signature = lines.map((line) => `${line.productId}:${line.quantity}`).join('|')
    if (reserveIdempotencyRef.current?.signature !== signature) {
      reserveIdempotencyRef.current = { signature, key: crypto.randomUUID() }
    }
    const idempotencyKey = reserveIdempotencyRef.current.key

    setReserveError(null)
    setIsReserving(true)
    try {
      const reservation = await stockService.reserveStock(
        lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        idempotencyKey,
      )
      setActiveReservation({
        reservation,
        snapshotLines: lines,
        customerSnapshot: toOrderCustomer(customer),
      })
      clearCart()
      reloadCatalog()
    } catch (reason) {
      const status = isApiError(reason) ? reason.status : undefined
      if (status === 409) reloadCatalog()
      setReserveError({
        status,
        message: errorMessage(reason, 'Não foi possível reservar os itens selecionados.'),
      })
      setIsReserving(false)
    }
  }

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1.5 pb-6 text-xs text-ink-soft">
          <Link href="/carrinho" className="hover:text-terracota-600 hover:underline underline-offset-4">
            Carrinho
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span aria-current="page" className="text-ink">
            Endereço, frete e pagamento
          </span>
        </nav>

        <h1 className="pb-8 text-2xl font-semibold text-ink sm:text-3xl">Finalizar compra</h1>

        <form onSubmit={handleReserveSubmit} noValidate className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
          <div className="flex flex-col gap-10">
            <fieldset className="flex flex-col gap-4">
              <legend className="pb-2 text-sm font-semibold uppercase tracking-widest text-ink">
                Seus dados
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  {field('name', 'Nome completo', { autoComplete: 'name', placeholder: 'Maria da Silva' })}
                </div>
                {field('email', 'E-mail', {
                  type: 'email',
                  autoComplete: 'email',
                  placeholder: 'maria@email.com',
                })}
                {field('phone', 'Telefone / WhatsApp', {
                  type: 'tel',
                  autoComplete: 'tel',
                  placeholder: '(81) 99999-9999',
                  maxLength: 15,
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-4">
              <legend className="pb-2 text-sm font-semibold uppercase tracking-widest text-ink">
                Endereço de entrega
              </legend>
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  {field('zip', 'CEP', {
                    inputMode: 'numeric',
                    autoComplete: 'postal-code',
                    placeholder: '50000-000',
                    maxLength: 9,
                  })}
                </div>
                <div className="sm:col-span-4">
                  {field('street', 'Rua', { autoComplete: 'address-line1', placeholder: 'Rua da Aurora' })}
                </div>
                <div className="sm:col-span-2">{field('number', 'Número', { placeholder: '123' })}</div>
                <div className="sm:col-span-4">
                  {field('complement', 'Complemento (opcional)', { placeholder: 'Apto 101' })}
                </div>
                <div className="sm:col-span-2">{field('neighborhood', 'Bairro', { placeholder: 'Boa Vista' })}</div>
                <div className="sm:col-span-3">
                  {field('city', 'Cidade', { autoComplete: 'address-level2', placeholder: 'Recife' })}
                </div>
                <div className="sm:col-span-1">
                  {field('state', 'UF', { maxLength: 2, autoComplete: 'address-level1', placeholder: 'PE' })}
                </div>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="pb-2 text-sm font-semibold uppercase tracking-widest text-ink">
                Preferência inicial de pagamento
              </legend>
              {paymentOptions.map(({ id, label, hint, icon: Icon }) => (
                <label
                  key={id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 border bg-surface px-4 py-3 transition-colors',
                    payment === id ? 'border-terracota' : 'border-border hover:border-ink-soft/50',
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={id}
                    checked={payment === id}
                    onChange={() => setPayment(id)}
                    className="h-4 w-4 accent-terracota"
                  />
                  <Icon className="h-5 w-5 text-ink-soft" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-ink">{label}</span>
                    <span className="text-xs text-ink-soft">{hint}</span>
                  </span>
                </label>
              ))}
              <p className="text-xs text-ink-soft">
                Ao continuar, suas peças serão reservadas por 15 minutos no PostgreSQL e o frete real será cotado por ateliê de origem antes da captura ({paymentLabels[payment]}).
              </p>
            </fieldset>
          </div>

          <aside className="flex h-fit flex-col gap-4 border border-border bg-aubergine-400/10 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">Resumo dos itens</h2>

            <ul className="flex flex-col divide-y divide-border/60">
              {lines.map((line) => (
                <li key={line.productId} className="flex items-center gap-3 py-3 first:pt-0">
                  <img src={line.imageUrl} alt={line.imageAlt} className="h-14 w-14 shrink-0 object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{line.title}</span>
                    <span className="text-xs text-ink-soft">
                      {line.quantity} × {currency.format(line.unitPrice)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-ink">
                    {currency.format(line.unitPrice * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 border-t border-border pt-3 text-sm text-ink-soft">
              <div className="flex items-center justify-between">
                <span>Subtotal das peças</span>
                <span className="font-medium text-ink">{currency.format(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Frete multi-origem</span>
                <span className="text-xs font-medium text-ink-soft">Calculado na etapa seguinte</span>
              </div>
            </div>

            {reserveError && (
              <div role="alert" className="flex flex-col gap-2 border border-danger/30 bg-surface p-3 text-sm text-danger">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {reserveError.status === 409 ? 'Estoque atualizado no servidor: ' : ''}
                    {reserveError.message}
                  </span>
                </div>
                {reserveError.status === 409 && (
                  <Link href="/carrinho" className="text-xs font-semibold text-ink underline underline-offset-4">
                    Voltar ao carrinho para ajustar quantidades
                  </Link>
                )}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isReserving || hasStockMismatch}
              aria-busy={isReserving}
            >
              {isReserving ? 'Reservando estoque…' : 'Reservar e calcular frete'}
            </Button>
          </aside>
        </form>
      </Container>
    </main>
  )
}
