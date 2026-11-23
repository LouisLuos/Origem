'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, CreditCard, FileText, QrCode, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { Navigate } from '@/components/Navigate'
import { Badge, Button, ButtonLink, Container, Input, cn, currency } from '@/design-system'
import { ResourceGate } from '@/components/AsyncState'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { useCatalog } from '@/context/CatalogContext'
import { calculateShipping, paymentLabels } from '@/context/OrderContext'
import type { OrderCustomer, OrderLine, PaymentMethod } from '@/context/OrderContext'
import { addressService } from '@/services/addressService'
import { addressBookService, formatAddressLine, formatCep, type SavedAddress } from '@/services/addressBookService'
import { isApiError } from '@/services/api'
import { stockService, type StockReservationGroup } from '@/services/stockService'
import { errorMessage } from '@/utils/errors'

const paymentOptions: { id: PaymentMethod; label: string; hint: string; icon: typeof QrCode }[] = [
  { id: 'pix', label: 'Pix', hint: 'Captura integrada prevista para HU-10', icon: QrCode },
  { id: 'card', label: 'Cartão de crédito', hint: 'Captura integrada prevista para HU-10', icon: CreditCard },
  { id: 'boleto', label: 'Boleto', hint: 'Captura integrada prevista para HU-10', icon: FileText },
]

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const emptyCustomer: OrderCustomer = {
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

const requiredFields: (keyof OrderCustomer)[] = [
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

type Errors = Partial<Record<keyof OrderCustomer, string>>

const NEW_ADDRESS = 'novo'

type AddressField = 'zip' | 'street' | 'number' | 'complement' | 'neighborhood' | 'city' | 'state'

const emptyAddressFields: Pick<OrderCustomer, AddressField> = {
  zip: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

const clearedAddressErrors: Errors = {
  zip: undefined,
  street: undefined,
  number: undefined,
  neighborhood: undefined,
  city: undefined,
  state: undefined,
}

function savedAddressFields(address: SavedAddress): Pick<OrderCustomer, AddressField> {
  return {
    zip: formatCep(address.cep),
    street: address.logradouro,
    number: address.numero,
    complement: address.complemento ?? '',
    neighborhood: address.bairro,
    city: address.cidade,
    state: address.uf,
  }
}

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

/** Máscaras aplicadas enquanto o usuário digita; campos ausentes ficam como digitados. */
const formatters: Partial<Record<keyof OrderCustomer, (value: string) => string>> = {
  phone: formatPhone,
  zip: formatZip,
  state: (value) => value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase(),
}

function validate(customer: OrderCustomer): Errors {
  const errors: Errors = {}
  for (const field of requiredFields) {
    if (!customer[field].trim()) errors[field] = 'Campo obrigatório'
  }
  if (!errors.phone && ![10, 11].includes(onlyDigits(customer.phone).length)) errors.phone = 'Telefone inválido'
  if (!errors.email && !/^\S+@\S+\.\S+$/.test(customer.email)) errors.email = 'E-mail inválido'
  if (!errors.zip && onlyDigits(customer.zip).length !== 8) errors.zip = 'CEP deve ter 8 dígitos'
  if (!errors.state && !/^[A-Za-z]{2}$/.test(customer.state.trim())) errors.state = 'Use a sigla (ex.: PE)'
  return errors
}

interface ConfirmedReservationState {
  readonly reservation: StockReservationGroup
  readonly lines: readonly OrderLine[]
  readonly subtotal: number
  readonly shipping: number
  readonly total: number
  readonly paymentMethod: PaymentMethod
  readonly cancelledMessage?: string
}

export function Checkout() {
  const { lines: cartLines, clearCart } = useCart()
  const { status: catalogStatus, error: catalogError, reload: reloadCatalog } = useCatalog()
  const { user, hydrated: authHydrated } = useAuth()

  const [customer, setCustomer] = useState<OrderCustomer>(() => ({
    ...emptyCustomer,
    name: user?.name ?? '',
    email: user?.email ?? '',
  }))
  const [payment, setPayment] = useState<PaymentMethod>('pix')
  const [errors, setErrors] = useState<Errors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ status?: number; message: string } | null>(null)
  const [zipStatus, setZipStatus] = useState<'idle' | 'loading' | 'notFound' | 'error'>('idle')
  const [confirmedReservation, setConfirmedReservation] = useState<ConfirmedReservationState | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>(NEW_ADDRESS)

  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null)
  const savedZipRef = useRef<string | null>(null)

  const applySavedAddress = (address: SavedAddress) => {
    savedZipRef.current = address.cep
    setSelectedAddressId(address.id)
    setCustomer((prev) => ({ ...prev, ...savedAddressFields(address) }))
    setErrors((prev) => ({ ...prev, ...clearedAddressErrors }))
  }

  const chooseNewAddress = () => {
    savedZipRef.current = null
    setSelectedAddressId(NEW_ADDRESS)
    setCustomer((prev) => ({ ...prev, ...emptyAddressFields }))
  }

  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    addressBookService
      .list()
      .then((addresses) => {
        if (!active) return
        setSavedAddresses(addresses)
        const first = addresses[0]
        if (!first) return
        savedZipRef.current = first.cep
        setSelectedAddressId(first.id)
        setCustomer((prev) => ({ ...prev, ...savedAddressFields(first) }))
      })
      .catch(() => {
        // Sem livro de endereços, o checkout segue com o formulário manual.
      })
    return () => {
      active = false
    }
  }, [userId])

  const zipDigits = onlyDigits(customer.zip)
  useEffect(() => {
    if (zipDigits.length !== 8 || zipDigits === savedZipRef.current) {
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
        setErrors((prev) => ({ ...prev, street: undefined, neighborhood: undefined, city: undefined, state: undefined }))
        setZipStatus('idle')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setZipStatus('error')
      })
    return () => controller.abort()
  }, [zipDigits])

  if (!authHydrated) {
    return <ResourceGate status="loading" label="Verificando sessão…" />
  }

  if (!user && !confirmedReservation) {
    return <Navigate to="/entrar?from=/checkout" />
  }

  const lines: OrderLine[] = cartLines.map(({ product, quantity }) => ({
    productId: product.id,
    title: product.title,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    artisan: product.artisan,
    unitPrice: product.price,
    quantity,
  }))

  if (confirmedReservation) {
    const { reservation, cancelledMessage } = confirmedReservation
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          <div className="mx-auto flex max-w-2xl flex-col gap-6 border border-border bg-surface p-6 sm:p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              {cancelledMessage ? (
                <RotateCcw className="h-11 w-11 text-terracota-600" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-11 w-11 text-oliva-600" aria-hidden="true" />
              )}
              <Badge tone={cancelledMessage ? 'neutral' : 'oliva'}>
                {cancelledMessage ? 'Reserva cancelada e estoque devolvido' : 'Reserva temporária de estoque ativa'}
              </Badge>
              <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
                {cancelledMessage ? 'Estoque devolvido à vitrine' : 'Estoque reservado por 15 minutos'}
              </h1>
              <p className="text-sm text-ink-soft">
                {cancelledMessage
                  ? cancelledMessage
                  : 'Suas unidades foram debitadas atomicamente no PostgreSQL. A confirmação definitiva do pagamento será integrada na HU-10 (nenhuma cobrança foi simulada).'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface-muted px-4 py-3 text-xs text-ink-soft">
              <span>
                Reserva <strong className="text-ink">{reservation.grupoId}</strong>
              </span>
              {!cancelledMessage && (
                <span className="inline-flex items-center gap-1.5 text-ink">
                  <Clock className="h-3.5 w-3.5 text-terracota-600" aria-hidden="true" />
                  Expira em {dateTimeFormat.format(new Date(reservation.expiraEm))}
                </span>
              )}
            </div>

            <ul className="flex flex-col divide-y divide-border/60">
              {confirmedReservation.lines.map((line) => (
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

            <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-ink-soft">
              <div className="flex justify-between">
                <span>Forma escolhida (pendente de captura HU-10)</span>
                <span className="text-ink">{paymentLabels[confirmedReservation.paymentMethod]}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-ink">
                <span>Total estimado</span>
                <span>{currency.format(confirmedReservation.total)}</span>
              </div>
            </div>

            {cancelError && (
              <p role="alert" className="border border-danger/30 bg-surface-muted px-4 py-3 text-sm text-danger">
                {cancelError}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              {!cancelledMessage && (
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
                      setConfirmedReservation((prev) =>
                        prev
                          ? {
                            ...prev,
                            cancelledMessage: `Reserva cancelada no servidor: ${res.unidadesDevolvidas} unidade(s) devolvida(s) ao saldo disponível.`,
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

  if (catalogStatus !== 'ready' && !isSubmitting) {
    return (
      <ResourceGate status={catalogStatus} label="Carregando seu pedido…" error={catalogError} onRetry={reloadCatalog} />
    )
  }

  if (lines.length === 0 && !isSubmitting) return <Navigate to="/carrinho" />

  const subtotal = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0)
  const shipping = calculateShipping(subtotal)
  const total = subtotal + shipping
  const hasStockMismatch = cartLines.some(
    (line) => line.product.stock === 0 || line.quantity > (line.product.stock ?? line.quantity),
  )

  const update = (name: keyof OrderCustomer) => (event: { target: { value: string } }) => {
    const value = formatters[name]?.(event.target.value) ?? event.target.value
    setCustomer((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const field = (name: keyof OrderCustomer, label: string, extra: Record<string, string | number> = {}) => (
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
        <span role="status" className={cn('text-xs', zipStatus === 'loading' ? 'text-ink-soft' : 'text-danger')}>
          {zipStatus === 'loading' && 'Buscando endereço…'}
          {zipStatus === 'notFound' && 'CEP não encontrado. Preencha o endereço manualmente.'}
          {zipStatus === 'error' && 'Não foi possível buscar o CEP. Preencha manualmente.'}
        </span>
      )}
    </div>
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate(customer)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (hasStockMismatch) {
      setSubmitError({
        status: 409,
        message: 'A quantidade no carrinho excede o estoque disponível. Ajuste os itens antes de reservar.',
      })
      reloadCatalog()
      return
    }

    const signature = lines.map((line) => `${line.productId}:${line.quantity}`).join('|')
    if (idempotencyRef.current?.signature !== signature) {
      idempotencyRef.current = { signature, key: crypto.randomUUID() }
    }
    const idempotencyKey = idempotencyRef.current.key

    setSubmitError(null)
    setIsSubmitting(true)
    try {
        const reservation = await stockService.reserveStock(
          lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          idempotencyKey,
        )
      setConfirmedReservation({
          reservation,
          lines,
          subtotal,
          shipping,
          total,
          paymentMethod: payment,
        })
      clearCart()
      reloadCatalog()
      } catch (reason) {
        const status = isApiError(reason) ? reason.status : undefined
        if (status === 409) {
          // Atualiza o estoque exibido na vitrine/carrinho imediatamente após conflito real no PostgreSQL
          reloadCatalog()
        }
        setSubmitError({
          status,
          message: errorMessage(reason, 'Não foi possível reservar os itens selecionados.'),
        })
        setIsSubmitting(false)
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
              Reservar e finalizar compra
            </span>
          </nav>

          <h1 className="pb-8 text-2xl font-semibold text-ink sm:text-3xl">Reservar e finalizar compra</h1>

          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
            <div className="flex flex-col gap-10">
              <fieldset className="flex flex-col gap-4">
                <legend className="pb-2 text-sm font-semibold uppercase tracking-widest text-ink">Seus dados</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">{field('name', 'Nome completo', { autoComplete: 'name', placeholder: 'Maria da Silva' })}</div>
                  {field('email', 'E-mail', { type: 'email', autoComplete: 'email', placeholder: 'maria@email.com' })}
                  {field('phone', 'Telefone', { type: 'tel', autoComplete: 'tel', placeholder: '(81) 99999-9999', maxLength: 15 })}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-4">
                <legend className="pb-2 text-sm font-semibold uppercase tracking-widest text-ink">
                  Endereço de entrega
                </legend>
                {savedAddresses.length > 0 && (
                  <div role="radiogroup" aria-label="Endereços salvos" className="grid gap-3 sm:grid-cols-2">
                    {savedAddresses.map((address) => (
                      <label
                        key={address.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 border bg-surface px-4 py-3 text-sm transition-colors',
                          selectedAddressId === address.id ? 'border-terracota' : 'border-border hover:border-ink-soft/50',
                        )}
                      >
                        <input
                          type="radio"
                          name="saved-address"
                          checked={selectedAddressId === address.id}
                          onChange={() => applySavedAddress(address)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-terracota"
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium text-ink">{formatAddressLine(address)}</span>
                          <span className="text-ink-soft">
                            {address.cidade}/{address.uf} · CEP {formatCep(address.cep)}
                          </span>
                        </span>
                      </label>
                    ))}
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 border bg-surface px-4 py-3 text-sm transition-colors',
                        selectedAddressId === NEW_ADDRESS ? 'border-terracota' : 'border-border hover:border-ink-soft/50',
                      )}
                    >
                      <input
                        type="radio"
                        name="saved-address"
                        checked={selectedAddressId === NEW_ADDRESS}
                        onChange={chooseNewAddress}
                        className="h-4 w-4 shrink-0 accent-terracota"
                      />
                      <span className="font-medium text-ink">Usar outro endereço</span>
                    </label>
                  </div>
                )}
                <div className={cn('grid gap-4 sm:grid-cols-6', selectedAddressId !== NEW_ADDRESS && 'hidden')}>
                  <div className="sm:col-span-2">
                    {field('zip', 'CEP', { inputMode: 'numeric', autoComplete: 'postal-code', placeholder: '50000-000', maxLength: 9 })}
                  </div>
                  <div className="sm:col-span-4">{field('street', 'Rua', { autoComplete: 'address-line1', placeholder: 'Rua da Aurora' })}</div>
                  <div className="sm:col-span-2">{field('number', 'Número', { placeholder: '123' })}</div>
                  <div className="sm:col-span-4">{field('complement', 'Complemento (opcional)', { placeholder: 'Apto 101' })}</div>
                  <div className="sm:col-span-2">{field('neighborhood', 'Bairro', { placeholder: 'Boa Vista' })}</div>
                  <div className="sm:col-span-3">{field('city', 'Cidade', { autoComplete: 'address-level2', placeholder: 'Recife' })}</div>
                  <div className="sm:col-span-1">
                    {field('state', 'UF', { maxLength: 2, autoComplete: 'address-level1', placeholder: 'PE' })}
                  </div>
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="pb-2 text-sm font-semibold uppercase tracking-widest text-ink">Pagamento</legend>
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
                  Esta etapa realiza a reserva atômica real de estoque por 15 minutos no PostgreSQL. A captura real do pagamento será integrada na HU-10.
                </p>
              </fieldset>
            </div>

            <aside className="flex h-fit flex-col gap-4 border border-border bg-aubergine-400/10 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">Resumo da reserva</h2>

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
                  <span>Subtotal</span>
                  <span className="font-medium text-ink">{currency.format(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Frete</span>
                  <span className={cn('font-medium', shipping === 0 ? 'text-oliva-600' : 'text-ink')}>
                    {shipping === 0 ? 'Grátis' : currency.format(shipping)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-ink">
                <span>Total</span>
                <span>{currency.format(total)}</span>
              </div>

              {submitError && (
              <div role="alert" className="flex flex-col gap-2 border border-danger/30 bg-surface p-3 text-sm text-danger">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {submitError.status === 409 ? 'Estoque atualizado no servidor: ' : ''}
                    {submitError.message}
                  </span>
                </div>
                {submitError.status === 409 && (
                  <Link href="/carrinho" className="text-xs font-semibold text-ink underline underline-offset-4">
                    Voltar ao carrinho para ajustar quantidades
                  </Link>
                )}
              </div>
              )}

                <Button type="submit" variant="primary" size="lg" disabled={isSubmitting || hasStockMismatch} aria-busy={isSubmitting}>
                  {isSubmitting ? 'Reservando estoque…' : 'Reservar estoque (15 min)'}
                </Button>
            </aside>
          </form>
        </Container>
      </main>
    )
  }
