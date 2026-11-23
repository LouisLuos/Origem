'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Clock, RotateCcw, XCircle } from 'lucide-react'
import { Badge, Button, cn } from '@/design-system'
import { computeRemainingSeconds } from '@/utils/cartReservation.util'

export interface CartReservationTimerProps {
  /** Instante ISO de expiração autoritativo retornado pelo PostgreSQL/backend (`expiraEm`). */
  readonly expiresAtIso?: string | null
  /** Compensação de relógio (`servidorAgora - Date.now()`) calculada na resposta do servidor. */
  readonly serverOffsetMs?: number
  /** Indica expiração já confirmada pelo servidor mesmo sem grupo ativo. */
  readonly isExpiredExternal?: boolean
  /** Bloqueia ações durante chamada de renovação ou cancelamento na API. */
  readonly isBusy?: boolean
  /** Chamado uma única vez por expiração quando o cronômetro chega a 00:00. */
  readonly onExpire?: () => void
  /** Solicita nova reserva real no backend (gera novo grupoId + Idempotency-Key). */
  readonly onRenew?: () => void
  /** Opcional: cancela explicitamente a reserva ativa e devolve estoque ao catálogo. */
  readonly onCancel?: () => void
  readonly className?: string
}

export function CartReservationTimer({
  expiresAtIso,
  serverOffsetMs = 0,
  isExpiredExternal = false,
  isBusy = false,
  onExpire,
  onRenew,
  onCancel,
  className,
}: CartReservationTimerProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const expiredNotifiedForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!expiresAtIso) return

    const tick = () => setNowMs(Date.now())
    const syncId = window.setTimeout(tick, 0)
    const intervalId = window.setInterval(tick, 1000)

    return () => {
      window.clearTimeout(syncId)
      window.clearInterval(intervalId)
    }
  }, [expiresAtIso])

  const remainingSeconds = computeRemainingSeconds(expiresAtIso, serverOffsetMs, nowMs)
  const isExpired = isExpiredExternal || (Boolean(expiresAtIso) && remainingSeconds <= 0)

  useEffect(() => {
    if (!expiresAtIso || remainingSeconds > 0 || isExpiredExternal) return
    if (expiredNotifiedForRef.current === expiresAtIso) return
    expiredNotifiedForRef.current = expiresAtIso
    onExpire?.()
  }, [expiresAtIso, remainingSeconds, isExpiredExternal, onExpire])

  if (!expiresAtIso && !isExpiredExternal) {
    return null
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const isLowTime = !isExpired && remainingSeconds > 0 && remainingSeconds <= 120

  if (isExpired) {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Reserva expirada:</strong> O prazo de 15 minutos no servidor encerrou e as peças retornaram à vitrine.
          </span>
        </div>
        {onRenew && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            aria-busy={isBusy}
            onClick={onRenew}
            className="border-danger/40 text-danger hover:bg-danger/10"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {isBusy ? 'Renovando…' : 'Renovar reserva'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border px-4 py-2.5 text-xs transition-colors',
        isLowTime
          ? 'border-warning/50 bg-warning/5 text-ink'
          : 'border-border bg-surface-muted/60 text-ink-soft',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Clock
          className={cn(
            'h-3.5 w-3.5',
            isLowTime ? 'animate-pulse text-warning' : 'text-terracota-600',
          )}
          aria-hidden="true"
        />
        <span>
          {isLowTime ? (
            <strong className="text-warning">Atenção:</strong>
          ) : (
            <span>Reserva confirmada no servidor por:</span>
          )}
        </span>
        <span className="font-mono text-sm font-bold text-ink">{formattedTime}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isLowTime ? 'terracota' : 'oliva'}>
          {isLowTime ? 'Últimos minutos' : 'Reserva ativa (15 min)'}
        </Badge>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={onCancel}
            className="h-7 px-2 text-xs text-ink-soft hover:text-terracota-600"
          >
            <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Liberar reserva
          </Button>
        )}
      </div>
    </div>
  )
}
