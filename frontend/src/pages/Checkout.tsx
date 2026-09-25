import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronRight, CreditCard, FileText, QrCode } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button, Container, Input, cn, currency } from '@/design-system'
import { ErrorBlock, LoadingBlock } from '@/components/AsyncState'
import { useCatalog } from '@/context/CatalogContext'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { calculateShipping, useOrders } from '@/context/OrderContext'
import type { OrderCustomer, OrderLine, PaymentMethod } from '@/context/OrderContext'

const paymentOptions: { id: PaymentMethod; label: string; hint: string; icon: typeof QrCode }[] = [
  { id: 'pix', label: 'Pix', hint: 'Aprovação imediata', icon: QrCode },
  { id: 'card', label: 'Cartão de crédito', hint: 'Em até 3x sem juros', icon: CreditCard },
  { id: 'boleto', label: 'Boleto', hint: 'Vence em 3 dias úteis', icon: FileText },
]

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

export function Checkout() {
  const { items, clearCart } = useCart()
  const { placeOrder } = useOrders()
  const { products, status: catalogStatus, error: catalogError, reload: reloadCatalog } = useCatalog()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<OrderCustomer>(() => ({
    ...emptyCustomer,
    name: user?.name ?? '',
    email: user?.email ?? '',
  }))
  const [payment, setPayment] = useState<PaymentMethod>('pix')
  const [errors, setErrors] = useState<Errors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [zipStatus, setZipStatus] = useState<'idle' | 'loading' | 'notFound' | 'error'>('idle')

  const zipDigits = onlyDigits(customer.zip)
  // Preenche rua, bairro, cidade e UF via ViaCEP assim que o CEP tem 8 dígitos.
  useEffect(() => {
    if (zipDigits.length !== 8) {
      setZipStatus('idle')
      return
    }
    const controller = new AbortController()
    setZipStatus('loading')
    fetch(`https://viacep.com.br/ws/${zipDigits}/json/`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('viacep')
        return response.json() as Promise<{ erro?: boolean; logradouro: string; bairro: string; localidade: string; uf: string }>
      })
      .then((data) => {
        if (data.erro) {
          setZipStatus('notFound')
          return
        }
        setCustomer((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade,
          state: data.uf,
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

  const lines: OrderLine[] = items.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.id)
    return product
      ? [
          {
            productId: product.id,
            title: product.title,
            imageUrl: product.imageUrl,
            imageAlt: product.imageAlt,
            artisan: product.artisan,
            unitPrice: product.price,
            quantity: item.quantity,
          },
        ]
      : []
  })

  if (catalogStatus !== 'ready' && !isSubmitting) {
    return (
      <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
        <Container>
          {catalogStatus === 'error' ? (
            <ErrorBlock message={catalogError} onRetry={reloadCatalog} />
          ) : (
            <LoadingBlock label="Carregando seu pedido…" />
          )}
        </Container>
      </main>
    )
  }

  // O carrinho só é esvaziado ao concluir o pedido, que já navega para a confirmação.
  if (lines.length === 0 && !isSubmitting) return <Navigate to="/carrinho" replace />

  const subtotal = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0)
  const shipping = calculateShipping(subtotal)
  const total = subtotal + shipping

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

    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const order = await placeOrder({
        customer: { ...customer, state: customer.state.trim().toUpperCase() },
        userEmail: user?.email,
        paymentMethod: payment,
        lines,
        subtotal,
        shipping,
        total,
      })
      clearCart()
      navigate(`/pedido/${order.id}`, { replace: true })
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : 'Não foi possível concluir o pedido.')
      setIsSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="pb-16 pt-24 sm:pb-24 sm:pt-28">
      <Container>
        <nav aria-label="Trilha de navegação" className="flex flex-wrap items-center gap-1.5 pb-6 text-xs text-ink-soft">
          <Link to="/carrinho" className="hover:text-terracota-600 hover:underline underline-offset-4">
            Carrinho
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span aria-current="page" className="text-ink">
            Finalizar compra
          </span>
        </nav>

        <h1 className="pb-8 text-2xl font-semibold text-ink sm:text-3xl">Finalizar compra</h1>

        <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
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
              <div className="grid gap-4 sm:grid-cols-6">
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
              <p className="text-xs text-ink-soft">Simulação: nenhum pagamento real é processado.</p>
            </fieldset>
          </div>

          <aside className="flex h-fit flex-col gap-4 border border-border bg-aubergine-400/10 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink">Resumo do pedido</h2>

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
              <p role="alert" className="text-sm text-danger">
                {submitError} Revise o carrinho e tente novamente.
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Processando…' : 'Confirmar pedido'}
            </Button>
          </aside>
        </form>
      </Container>
    </main>
  )
}
