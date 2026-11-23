'use client'

import { useState } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { Button, Input, cn, currency } from '@/design-system'
import type { TokenizedCardInput } from '@/services/orderService'

const PAGARME_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY?.trim() ?? ''
const PAGARME_API_BASE_URL = (
  process.env.NEXT_PUBLIC_PAGARME_API_BASE_URL?.trim() || 'https://sdx-api.pagar.me/core/v5'
).replace(/\/+$/, '')
const CUSTOM_TOKENIZATION_URL = process.env.NEXT_PUBLIC_PAYMENT_TOKENIZATION_URL?.trim() ?? ''

function passesLuhn(digits: string): boolean {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number.parseInt(digits[i] ?? '0', 10)
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

function inferBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  if (/^(4011|4312|4389|4514|4576|5041|5066|509|6277|6362|6363|650|6516|6550)/.test(digits)) {
    return 'Elo'
  }
  if (/^(606282|3841)/.test(digits)) return 'Hipercard'
  return 'Cartao'
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export interface CardTokenizationFormProps {
  readonly totalAmount: number
  readonly disabled?: boolean
  readonly isSubmittingParent?: boolean
  readonly onTokenized: (card: TokenizedCardInput) => Promise<void>
}

/**
 * Formulário de cartão de crédito com tokenização client-side exclusiva no provedor oficial.
 * Número completo e CVV são enviados diretamente para a API pública do gateway e nunca para o backend Origem.
 */
export function CardTokenizationForm({
  totalAmount,
  disabled = false,
  isSubmittingParent = false,
  onTokenized,
}: CardTokenizationFormProps) {
  const [cardNumber, setCardNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [tokenizing, setTokenizing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const tokenizationConfigured = Boolean(PAGARME_PUBLIC_KEY || CUSTOM_TOKENIZATION_URL)
  const busy = disabled || tokenizing || isSubmittingParent

  async function handleTokenizeAndSubmit() {
    setFormError(null)
    if (!tokenizationConfigured) {
      setFormError(
        'Chave pública do gateway (NEXT_PUBLIC_PAGARME_PUBLIC_KEY) não configurada neste ambiente.',
      )
      return
    }

    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length < 13 || digits.length > 19 || !passesLuhn(digits)) {
      setFormError('Número de cartão inválido.')
      return
    }

    const holder = holderName.trim()
    if (holder.length < 3) {
      setFormError('Informe o nome impresso no cartão.')
      return
    }

    const expMatch = /^(\d{2})\/(\d{2})$/.exec(expiry.trim())
    if (!expMatch) {
      setFormError('Informe a validade no formato MM/AA.')
      return
    }
    const expMonth = Number.parseInt(expMatch[1]!, 10)
    const expYear = 2000 + Number.parseInt(expMatch[2]!, 10)
    const now = new Date()
    if (
      expMonth < 1 ||
      expMonth > 12 ||
      expYear < now.getFullYear() ||
      (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)
    ) {
      setFormError('Cartão com data de validade expirada.')
      return
    }

    const cvvDigits = cvv.replace(/\D/g, '')
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      setFormError('Código de segurança (CVV) inválido.')
      return
    }

    const endpoint = CUSTOM_TOKENIZATION_URL
      ? CUSTOM_TOKENIZATION_URL
      : `${PAGARME_API_BASE_URL}/tokens?appId=${encodeURIComponent(PAGARME_PUBLIC_KEY)}`

    setTokenizing(true)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          type: 'card',
          card: {
            number: digits,
            holder_name: holder.toUpperCase(),
            exp_month: expMonth,
            exp_year: expYear,
            cvv: cvvDigits,
          },
        }),
      })

      const data = (await response.json().catch(() => null)) as {
        id?: string
        token?: string
        message?: string
        card?: { brand?: string; last_four_digits?: string }
      } | null

      const token = data?.id ?? data?.token
      if (!response.ok || typeof token !== 'string' || token.trim().length < 8) {
        setFormError(
          data?.message ?? 'Não foi possível tokenizar o cartão junto ao provedor de pagamento.',
        )
        return
      }

      const ultimosDigitos = data?.card?.last_four_digits ?? digits.slice(-4)
      const bandeira = data?.card?.brand ?? inferBrand(digits)

      // Limpa dados sensíveis da memória local imediatamente após tokenizar
      setCardNumber('')
      setCvv('')

      await onTokenized({
        token: token.trim(),
        parcelas,
        bandeira,
        ultimosDigitos,
      })
    } catch {
      setFormError('Falha de comunicação ao tokenizar cartão no provedor.')
    } finally {
      setTokenizing(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-4 border border-border bg-surface-muted/40 p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink">
          <Lock className="h-3.5 w-3.5 text-oliva-600" aria-hidden="true" />
          Tokenização segura direta no gateway
        </span>
        <span>CVV e número não passam pelo servidor Origem</span>
      </div>

      {!tokenizationConfigured && (
        <div role="status" className="flex items-start gap-2 border border-border bg-surface p-3 text-xs text-ink-soft">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-terracota-600" aria-hidden="true" />
          <span>
            Pagamento por cartão aguarda configuração da chave pública do gateway (`NEXT_PUBLIC_PAGARME_PUBLIC_KEY`).
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Número do cartão"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            disabled={busy || !tokenizationConfigured}
            className="py-2.5"
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            label="Nome impresso no cartão"
            autoComplete="cc-name"
            placeholder="MARIA DA SILVA"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            disabled={busy || !tokenizationConfigured}
            className="py-2.5"
          />
        </div>
        <Input
          label="Validade (MM/AA)"
          inputMode="numeric"
          autoComplete="off"
          placeholder="12/29"
          maxLength={5}
          value={expiry}
          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
          disabled={busy || !tokenizationConfigured}
          className="py-2.5"
        />
        <Input
          label="CVV"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="123"
          maxLength={4}
          value={cvv}
          onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
          disabled={busy || !tokenizationConfigured}
          className="py-2.5"
        />
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="card-installments" className="text-xs font-medium text-ink">
            Parcelamento
          </label>
          <select
            id="card-installments"
            value={parcelas}
            onChange={(e) => setParcelas(Number.parseInt(e.target.value, 10))}
            disabled={busy || !tokenizationConfigured}
            className={cn(
              'border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-terracota focus:outline-none',
            )}
          >
            {Array.from({ length: 12 }, (_, idx) => idx + 1).map((n) => (
              <option key={n} value={n}>
                {n}x de {currency.format(totalAmount / n)} sem acréscimo
              </option>
            ))}
          </select>
        </div>
      </div>

      {formError && (
        <p role="alert" className="text-xs text-danger">
          {formError}
        </p>
      )}

      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={busy || !tokenizationConfigured}
        aria-busy={busy}
        onClick={() => void handleTokenizeAndSubmit()}
      >
        {tokenizing
          ? 'Tokenizando cartão…'
          : isSubmittingParent
            ? 'Processando pagamento…'
            : `Pagar ${currency.format(totalAmount)} com cartão`}
      </Button>
    </div>
  )
}
