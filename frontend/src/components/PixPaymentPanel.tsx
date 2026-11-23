'use client'

import { useState } from 'react'
import { Check, Clock, Copy, ShieldCheck } from 'lucide-react'
import { Button, cn } from '@/design-system'
import type { PaymentDetails } from '@/services/orderService'

export function formatPixCountdown(seconds: number): string {
  const safe = Math.max(0, seconds)
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export interface PixPaymentPanelProps {
  readonly pagamento: PaymentDetails
  readonly remainingSeconds: number
}

/**
 * Painel compartilhado para exibição de QR Code Pix dinâmico e código Copia e Cola
 * sincronizados com o prazo real (`expiraEm`) do servidor.
 */
export function PixPaymentPanel({ pagamento, remainingSeconds }: PixPaymentPanelProps) {
  const [copiedPix, setCopiedPix] = useState(false)
  const expiredOnClock = remainingSeconds <= 0

  return (
    <section
      aria-label="Pagamento via Pix"
      className="flex flex-col items-center gap-4 border border-terracota/40 bg-surface-muted/30 p-6"
    >
      {pagamento.ambiente === 'sandbox' && (
        <div className="flex w-full items-center gap-2 border border-border bg-aubergine-400/10 px-4 py-2.5 text-xs text-ink">
          <ShieldCheck className="h-4 w-4 shrink-0 text-terracota-600" aria-hidden="true" />
          <span>
            <strong>Ambiente Sandbox ({pagamento.gateway})</strong> — operação em homologação, sem cobrança real.
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Clock className="h-4 w-4 text-terracota-600" aria-hidden="true" />
        <span className={cn(expiredOnClock ? 'text-danger' : 'text-ink')}>
          {expiredOnClock
            ? 'Código Pix expirado (00:00)'
            : `Válido por ${formatPixCountdown(remainingSeconds)}`}
        </span>
      </div>

      {!expiredOnClock ? (
        <>
          {pagamento.pixQrCodeBase64 ? (
            <img
              src={
                pagamento.pixQrCodeBase64.startsWith('data:')
                  ? pagamento.pixQrCodeBase64
                  : `data:image/png;base64,${pagamento.pixQrCodeBase64}`
              }
              alt="QR Code Pix para pagamento do pedido"
              className="h-52 w-52 border border-border bg-white p-2 object-contain"
            />
          ) : pagamento.pixTicketUrl ? (
            <img
              src={pagamento.pixTicketUrl}
              alt="QR Code Pix para pagamento do pedido"
              className="h-52 w-52 border border-border bg-white p-2 object-contain"
            />
          ) : null}

          {pagamento.pixCopiaECola && (
            <div className="flex w-full max-w-lg flex-col gap-2">
              <label htmlFor={`pix-copia-${pagamento.id}`} className="text-xs font-medium text-ink">
                Pix Copia e Cola
              </label>
              <div className="flex gap-2">
                <input
                  id={`pix-copia-${pagamento.id}`}
                  readOnly
                  value={pagamento.pixCopiaECola}
                  className="min-w-0 flex-1 border border-border bg-surface px-3 py-2 text-xs text-ink"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!pagamento.pixCopiaECola) return
                    await navigator.clipboard.writeText(pagamento.pixCopiaECola)
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
        </>
      ) : (
        <p className="text-center text-xs text-danger">
          O tempo limite de 15 minutos deste Pix expirou e o QR Code foi ocultado. Se ainda desejar as peças, inicie uma nova compra pela vitrine.
        </p>
      )}
    </section>
  )
}
