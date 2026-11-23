'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
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
import { PixPaymentPanel, formatPixCountdown } from '@/components/PixPaymentPanel'
import { ResourceGate } from '@/components/AsyncState'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useCatalog } from '@/context/CatalogContext'
import { orderStatusLabels, useOrders } from '@/context/OrderContext'
import type {
  CheckoutShippingQuote,
  Order,
  OrderCustomer,
  PaymentMethod,
  TokenizedCardInput,
} from '@/context/OrderContext'
import { Badge, Button, ButtonLink, Container, Input, cn, currency } from '@/design-system'
import { addressService } from '@/services/addressService'
import { orderService } from '@/services/orderService'
import { computeRemainingSeconds } from '@/utils/cartReservation.util'
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

interface CheckoutDisplayLine {
  readonly productId: string
  readonly title: string
  readonly imageUrl: string
  readonly imageAlt: string
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

export function Checkout() {
  const router = useRouter()
  const {
    lines: cartLines,
    activeReservation,
    activeOrderReservation,
    reservationStatus,
    isMutatingReservation,
    reservationExpiredNotice,
    serverOffsetMs,
    reservationError,
    reserveCart,
    renewReservation,
    cancelActiveReservation,
    handleReservationExpired,
    completeOrderFromReservation,
  } = useCart()
  const {
    products,
    status: catalogStatus,
    error: catalogError,
    reload: reloadCatalog,
  } = useCatalog()
  const { user, hydrated: authHydrated } = useAuth()
  const { orders, status: ordersStatus, placeOrder, upsertOrder } = useOrders()

  const [customer, setCustomer] = useState<CustomerFormState>(() => ({
    ...emptyCustomer,
    name: user?.name ?? '',
    email: user?.email ?? '',
  }))
  const [payment, setPayment] = useState<PaymentMethod>('PIX')
  const [errors, setErrors] = useState<Errors>({})
  const [zipStatus, setZipStatus] = useState<'idle' | 'loading' | 'notFound' | 'error'>('idle')

  const [shippingQuote, setShippingQuote] = useState<CheckoutShippingQuote | null>(null)
  const [shippingStatus, setShippingStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [shippingError, setShippingError] = useState<string | null>(null)

  const [cancelledMessage, setCancelledMessage] = useState<string | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const checkoutIdempotencyRef = useRef<{ signature: string; key: string } | null>(null)
  const lastQuotedKeyRef = useRef<string | null>(null)
  const expiredNotifiedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    const syncId = window.setTimeout(() => {
      setCustomer((prev) => {
        const nextName = prev.name || user.name
        const nextEmail = prev.email || user.email
        if (nextName === prev.name && nextEmail === prev.email) return prev
        return { ...prev, name: nextName, email: nextEmail }
      })
    }, 0)
    return () => window.clearTimeout(syncId)
  }, [user])

  const zipDigits = onlyDigits(customer.zip)
  useEffect(() => {
    if (zipDigits.length !== 8) {
      const resetId = window.setTimeout(() => setZipStatus('idle'), 0)
      return () => window.clearTimeout(resetId)
    }

    const controller = new AbortController()
    const startId = window.setTimeout(() => setZipStatus('loading'), 0)

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

    return () => {
      window.clearTimeout(startId)
      controller.abort()
    }
  }, [zipDigits])

  // Cronômetro em tempo real sincronizado exclusivamente com `expiraEm` do servidor + `serverOffsetMs`
  const targetExpirationIso =
    activeOrder?.pagamentoAtual?.expiraEm ?? activeReservation?.expiraEm ?? null

  useEffect(() => {
    if (!targetExpirationIso || cancelledMessage) return
    const syncId = window.setTimeout(() => setNowMs(Date.now()), 0)
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => {
      window.clearTimeout(syncId)
      window.clearInterval(timer)
    }
  }, [targetExpirationIso, cancelledMessage])

  const remainingSeconds = computeRemainingSeconds(targetExpirationIso, serverOffsetMs, nowMs)
  const expiredOnClock =
    Boolean(targetExpirationIso) && !cancelledMessage && remainingSeconds <= 0

  const activeReservationId = activeReservation?.grupoId ?? null
  const activeReservationExpiresIso = activeReservation?.expiraEm ?? null
  const activeOrderId = activeOrder?.id ?? null
  const activeOrderStatus = activeOrder?.status ?? null

  // Ao chegar em 00:00 sem pedido aberto, aciona expiração lazy real no servidor (uma única vez por grupo)
  useEffect(() => {
    if (!activeReservationId || !activeReservationExpiresIso || activeOrderId || cancelledMessage) {
      return
    }
    if (!expiredOnClock) return

    const notifyKey = `${activeReservationId}:${activeReservationExpiresIso}`
    if (expiredNotifiedKeyRef.current === notifyKey) return
    expiredNotifiedKeyRef.current = notifyKey

    void handleReservationExpired()
  }, [
    activeReservationId,
    activeReservationExpiresIso,
    activeOrderId,
    cancelledMessage,
    expiredOnClock,
    handleReservationExpired,
  ])

  // Cotação automática real multi-origem usando o mesmo `grupoId` da reserva (sem duplicar efeito)
  useEffect(() => {
    if (!activeReservationId || activeOrderId || cancelledMessage || expiredOnClock) return

    if (zipDigits.length !== 8) {
      lastQuotedKeyRef.current = null
      const resetId = window.setTimeout(() => {
        setShippingQuote(null)
        setShippingStatus('idle')
        setShippingError(null)
      }, 0)
      return () => window.clearTimeout(resetId)
    }

    const quoteKey = `${activeReservationId}:${zipDigits}`
    if (lastQuotedKeyRef.current === quoteKey) return
    lastQuotedKeyRef.current = quoteKey

    let cancelled = false
    const startId = window.setTimeout(() => {
      setShippingStatus('loading')
      setShippingError(null)
    }, 0)

    orderService
      .quoteShipping(activeReservationId, zipDigits)
      .then((quote) => {
        if (!cancelled) {
          setShippingQuote(quote)
          setShippingStatus('ready')
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          lastQuotedKeyRef.current = null
          setShippingQuote(null)
          setShippingError(errorMessage(reason, 'Não foi possível calcular o frete multi-origem.'))
          setShippingStatus('error')
        }
      })

    return () => {
      cancelled = true
      window.clearTimeout(startId)
      if (lastQuotedKeyRef.current === quoteKey) {
        lastQuotedKeyRef.current = null
      }
    }
  }, [activeReservationId, zipDigits, activeOrderId, cancelledMessage, expiredOnClock])

  // Polling real do status do pedido enquanto estiver PENDENTE_PAGAMENTO (HU-10)
  useEffect(() => {
    if (!activeOrderId || activeOrderStatus !== 'PENDENTE_PAGAMENTO') return
    let cancelled = false
    let intervalId: number | undefined

    const pollOnce = async () => {
      try {
        const updated = await orderService.getById(activeOrderId)
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
        // Mantém polling resiliente até atingir estado terminal ou expirar
      }
    }

    intervalId = window.setInterval(() => {
      void pollOnce()
    }, 3000)

    return () => {
      cancelled = true
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [activeOrderId, activeOrderStatus, router, upsertOrder, reloadCatalog])

  if (!authHydrated) {
    return <ResourceGate status="loading" label="Verificando sessão…" />
  }

  if (!user && !activeOrder) {
    return <Navigate to="/entrar?from=/checkout" />
  }

  if (
    !activeOrder &&
    (catalogStatus === 'loading' || reservationStatus === 'loading' || ordersStatus === 'loading')
  ) {
    return <ResourceGate status="loading" label="Sincronizando reserva e pedido…" />
  }

  if (catalogStatus === 'error' && !activeOrder) {
    return <ResourceGate status="error" error={catalogError} onRetry={reloadCatalog} />
  }

  // Preserva recuperação de pedidos Pix/cartão pendentes da HU-10 após F5 ou recarregamento
  const pendingRecoverableOrder = orders.find(
    (order) =>
      order.status === 'PENDENTE_PAGAMENTO' &&
      order.pagamentoAtual?.expiraEm &&
      computeRemainingSeconds(order.pagamentoAtual.expiraEm, serverOffsetMs, nowMs) > 0,
  )

  const pendingCodeFromReservation =
    activeOrderReservation?.pedidoVinculado?.status === 'PENDENTE_PAGAMENTO'
      ? activeOrderReservation.pedidoVinculado.codigoPedido
      : null

  const recoverableCode =
    pendingRecoverableOrder?.codigoPedido ?? pendingCodeFromReservation

  if (!activeOrder && recoverableCode) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 border border-border bg-surface p-8 text-center">
            <Clock className="h-10 w-10 text-terracota-600" aria-hidden="true" />
            <Badge tone="oliva">Pagamento em aberto</Badge>
            <h1 className="text-2xl font-semibold text-ink">Você possui um pedido pendente</h1>
            <p className="text-sm text-ink-soft">
              O pedido <strong className="text-ink">{recoverableCode}</strong> ainda possui reserva ativa aguardando confirmação de pagamento.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <ButtonLink
                href={`/pedido/${encodeURIComponent(recoverableCode)}`}
                variant="primary"
                size="md"
              >
                Retomar pagamento / acompanhar pedido
              </ButtonLink>
              <ButtonLink href="/#vitrine" variant="outline" size="md">
                Voltar à vitrine
              </ButtonLink>
            </div>
          </div>
        </Container>
      </main>
    )
  }

  // Reserva explicitamente cancelada pelo comprador neste checkout
  if (cancelledMessage && !activeReservation && !activeOrder) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 border border-border bg-surface p-8 text-center">
            <RotateCcw className="h-11 w-11 text-terracota-600" aria-hidden="true" />
            <Badge tone="neutral">Reserva cancelada</Badge>
            <h1 className="text-2xl font-semibold text-ink">Estoque devolvido à vitrine</h1>
            <p className="text-sm text-ink-soft">{cancelledMessage}</p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {cartLines.length > 0 && (
                <ButtonLink href="/carrinho" variant="outline" size="md">
                  Voltar ao carrinho
                </ButtonLink>
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

  // Sem reserva ativa e sem pedido aberto: renovação após expiração ou reserva explícita se veio direto via URL
  if (!activeReservation && !activeOrder) {
    if (reservationExpiredNotice) {
      return (
        <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
          <Container>
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 border border-border bg-surface p-8 text-center">
              <AlertTriangle className="h-11 w-11 text-danger" aria-hidden="true" />
              <Badge tone="neutral">Prazo expirado</Badge>
              <h1 className="text-2xl font-semibold text-ink">Prazo da reserva expirado</h1>
              <p className="text-sm text-ink-soft">
                O prazo de 15 minutos desta reserva terminou no servidor e os itens retornaram à vitrine. Você pode tentar renovar a reserva agora ou revisar seu carrinho.
              </p>

              {reservationError && (
                <div
                  role="alert"
                  className="w-full border border-danger/30 bg-surface-muted px-4 py-3 text-left text-sm text-danger"
                >
                  {reservationError.message}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {cartLines.length > 0 && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={isMutatingReservation}
                    aria-busy={isMutatingReservation}
                    onClick={async () => {
                      setCancelledMessage(null)
                      await renewReservation()
                    }}
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {isMutatingReservation ? 'Renovando reserva…' : 'Renovar reserva'}
                  </Button>
                )}
                <ButtonLink href="/carrinho" variant="outline" size="md">
                  Ir para o carrinho
                </ButtonLink>
              </div>
            </div>
          </Container>
        </main>
      )
    }

    if (cartLines.length === 0) {
      return <Navigate to="/carrinho" />
    }

    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 border border-border bg-surface p-8 text-center">
            <ShieldCheck className="h-10 w-10 text-terracota-600" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-ink">Confirme a reserva do seu carrinho</h1>
            <p className="text-sm text-ink-soft">
              Você possui {cartLines.reduce((sum, l) => sum + l.quantity, 0)} item(ns) no carrinho aguardando reserva transacional por 15 minutos antes do pagamento.
            </p>

            {reservationError && (
              <div
                role="alert"
                className="w-full border border-danger/30 bg-surface-muted px-4 py-3 text-left text-sm text-danger"
              >
                {reservationError.message}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={isMutatingReservation}
                aria-busy={isMutatingReservation}
                onClick={async () => {
                  setCancelledMessage(null)
                  await reserveCart()
                }}
              >
                {isMutatingReservation ? 'Reservando estoque…' : 'Reservar estoque por 15 min'}
              </Button>
              <ButtonLink href="/carrinho" variant="outline" size="md">
                Voltar ao carrinho
              </ButtonLink>
            </div>
          </div>
        </Container>
      </main>
    )
  }

  // Monta as linhas exibidas a partir do pedido consolidado ou da reserva ativa + catálogo (resiliente ao F5)
  const displayLines: CheckoutDisplayLine[] = activeOrder
    ? activeOrder.itens.map((item) => ({
        productId: item.pecaId,
        title: item.titulo,
        imageUrl: item.fotoPrincipalUrl ?? '',
        imageAlt: item.titulo,
        unitPrice: item.precoUnitario,
        quantity: item.quantidade,
      }))
    : (activeReservation?.itens ?? []).map((item) => {
        const product = products.find(
          (candidate) => candidate.id.toLowerCase() === item.pecaId.toLowerCase(),
        )
        return {
          productId: item.pecaId,
          title: product?.title ?? `Peça ${item.pecaId.slice(0, 8)}`,
          imageUrl: product?.imageUrl ?? '',
          imageAlt: product?.imageAlt ?? product?.title ?? 'Peça artesanal',
          unitPrice: product?.price ?? 0,
          quantity: item.quantidade,
        }
      })

  const itemsSubtotal = displayLines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const customerValidationErrors = validate(customer)
  const customerReadyForPayment = Object.keys(customerValidationErrors).length === 0

  const update = (name: keyof CustomerFormState) => (event: { target: { value: string } }) => {
    const value = formatters[name]?.(event.target.value) ?? event.target.value
    setCustomer((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    setPaymentError(null)
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

  function getCheckoutIdempotencyKey(grupoId: string, method: PaymentMethod): string {
    const sig = `${grupoId}:${method}`
    if (checkoutIdempotencyRef.current?.signature !== sig) {
      checkoutIdempotencyRef.current = { signature: sig, key: crypto.randomUUID() }
    }
    return checkoutIdempotencyRef.current.key
  }

  async function submitCheckout(method: PaymentMethod, card?: TokenizedCardInput) {
    if (!activeReservation || isPaying || remainingSeconds <= 0) return

    const found = validate(customer)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setPaymentError('Preencha todos os campos obrigatórios de entrega antes de realizar o pagamento.')
      return
    }

    setPaymentError(null)
    setIsPaying(true)
    const idempotencyKey = getCheckoutIdempotencyKey(activeReservation.grupoId, method)

    try {
      const response = await placeOrder(
        {
          reservaGrupoId: activeReservation.grupoId,
          metodoPagamento: method,
          enderecoEntrega: toOrderCustomer(customer),
          ...(card ? { cartao: card } : {}),
        },
        idempotencyKey,
      )

      setActiveOrder(response.pedido)
      // Só limpa o carrinho após criação bem-sucedida do pedido no backend (HU-10)
      completeOrderFromReservation()

      if (response.pedido.status === 'APROVADO') {
        reloadCatalog()
        router.push(`/pedido/${encodeURIComponent(response.pedido.codigoPedido)}`)
      } else if (
        response.pedido.status === 'RECUSADO' ||
        response.pedido.status === 'EXPIRADO' ||
        response.pedido.status === 'CANCELADO'
      ) {
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

  const pagamentoAtual = activeOrder?.pagamentoAtual ?? null

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

        <div className="mx-auto flex max-w-4xl flex-col gap-6 border border-border bg-surface p-6 sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            {activeOrder?.status === 'RECUSADO' ? (
              <AlertTriangle className="h-11 w-11 text-danger" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-11 w-11 text-oliva-600" aria-hidden="true" />
            )}

            <Badge
              tone={
                activeOrder?.status === 'RECUSADO' || expiredOnClock
                  ? 'neutral'
                  : 'oliva'
              }
            >
              {activeOrder
                ? orderStatusLabels[activeOrder.status]
                : 'Reserva ativa · entrega e pagamento'}
            </Badge>

            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
              {activeOrder?.status === 'RECUSADO'
                ? 'Pagamento não autorizado'
                : activeOrder?.status === 'RECONCILIACAO_ESTORNO'
                  ? 'Pagamento tardio em reconciliação'
                  : expiredOnClock || activeOrder?.status === 'EXPIRADO'
                    ? 'Prazo da reserva expirado'
                    : activeOrder?.metodoPagamento === 'PIX'
                      ? 'Pague com Pix para confirmar o pedido'
                      : 'Finalize seu pedido'}
            </h1>

            <p className="text-sm text-ink-soft">
              {activeOrder?.status === 'RECUSADO'
                ? pagamentoAtual?.erroSanitizado ||
                  'A transação foi recusada pelo provedor e o estoque reservado foi devolvido automaticamente ao acervo.'
                : activeOrder?.status === 'RECONCILIACAO_ESTORNO'
                  ? activeOrder.reconciliacaoMotivo ||
                    'O pagamento foi confirmado após o vencimento da reserva e será estornado/reconciliado.'
                  : expiredOnClock || activeOrder?.status === 'EXPIRADO'
                    ? 'O prazo de 15 minutos desta reserva terminou no servidor.'
                    : 'As peças estão garantidas em seu nome com este grupo de reserva até o fim do cronômetro.'}
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
                  Reserva <strong className="text-ink">{activeReservation?.grupoId}</strong>
                </>
              )}
            </span>

            {activeOrder?.status !== 'RECUSADO' && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 font-semibold',
                  expiredOnClock ? 'text-danger' : 'text-ink',
                )}
              >
                <Clock className="h-3.5 w-3.5 text-terracota-600" aria-hidden="true" />
                {expiredOnClock ? 'Expirada (00:00)' : `Expira em ${formatPixCountdown(remainingSeconds)}`}
              </span>
            )}
          </div>

          {pagamentoAtual?.ambiente === 'sandbox' && activeOrder?.metodoPagamento !== 'PIX' && (
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
            pagamentoAtual && (
              <PixPaymentPanel pagamento={pagamentoAtual} remainingSeconds={remainingSeconds} />
            )}

          {/* Itens vinculados à reserva / pedido */}
          <ul className="flex flex-col divide-y divide-border/60">
            {displayLines.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 py-3">
                {line.imageUrl ? (
                  <img src={line.imageUrl} alt={line.imageAlt} className="h-14 w-14 shrink-0 object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 bg-surface-muted" />
                )}
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

          {/* Dados do comprador + endereço para cotação multi-origem com o grupoId já reservado */}
          {!activeOrder && !expiredOnClock && (
            <div className="flex flex-col gap-8 border-t border-border pt-6">
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
                  Endereço de entrega (cotação multi-origem)
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
            </div>
          )}

          {/* Cotação multi-origem calculada no backend */}
          {!activeOrder && zipDigits.length !== 8 && (
            <p className="border-t border-border pt-4 text-sm text-ink-soft">
              Informe um CEP válido (8 dígitos) acima para calcular o frete real por ateliê de origem (subtotal das peças:{' '}
              <strong className="text-ink">{currency.format(itemsSubtotal)}</strong>).
            </p>
          )}

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

          {/* Escolha de pagamento e captura (somente enquanto ainda não há pedido aberto nem expirado) */}
          {!expiredOnClock && !activeOrder && shippingStatus === 'ready' && shippingQuote && (
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
                <>
                  {!customerReadyForPayment && (
                    <p className="text-xs text-ink-soft">
                      Preencha nome, e-mail, telefone e número do endereço acima para liberar o pagamento com cartão.
                    </p>
                  )}
                  <CardTokenizationForm
                    totalAmount={shippingQuote.valorTotalPedido}
                    disabled={remainingSeconds <= 0 || !customerReadyForPayment}
                    isSubmittingParent={isPaying}
                    onTokenized={(card) => submitCheckout('CARTAO_CREDITO', card)}
                  />
                </>
              )}
            </section>
          )}

          {reservationError && (
            <p role="alert" className="border border-danger/30 bg-surface-muted px-4 py-3 text-sm text-danger">
              {reservationError.message}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            {!activeOrder && !expiredOnClock && activeReservation && (
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={isMutatingReservation}
                aria-busy={isMutatingReservation}
                onClick={async () => {
                  const unidades = activeReservation.itens.reduce(
                    (sum, item) => sum + item.quantidade,
                    0,
                  )
                  const ok = await cancelActiveReservation()
                  if (ok) {
                    setShippingQuote(null)
                    lastQuotedKeyRef.current = null
                    setCancelledMessage(
                      `Reserva cancelada no servidor: ${unidades} unidade(s) devolvida(s) ao estoque disponível.`,
                    )
                  }
                }}
              >
                {isMutatingReservation ? 'Devolvendo estoque…' : 'Cancelar reserva e devolver estoque'}
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
