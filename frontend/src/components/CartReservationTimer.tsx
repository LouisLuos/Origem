'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Clock, RotateCcw } from 'lucide-react'
import { Badge, Button, cn } from '@/design-system'
import { readStorage, writeStorage } from '@/services/storage'

const STORAGE_KEY = 'origem:cart_reservation_expires_at'
const DEFAULT_TTL_SECONDS = 900 // 15 minutos normativos (Invariante 1)

export interface CartReservationTimerProps {
  /** Duração da reserva em segundos (padrão normativo: 15 minutos = 900s). */
  initialSeconds?: number
  /** Disparado quando o tempo de reserva é zerado. */
  onExpire?: () => void
  /** Disparado quando o usuário solicita reiniciar a contagem. */
  onReset?: () => void
  className?: string
}

export function CartReservationTimer({
  initialSeconds = DEFAULT_TTL_SECONDS,
  onExpire,
  onReset,
  className,
}: CartReservationTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const [isExpired, setIsExpired] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Lê ou inicializa o timestamp absoluto de expiração no storage para não resetar no F5
  useEffect(() => {
    const now = Date.now()
    const storedExpiresAt = readStorage<number | null>(STORAGE_KEY, null)

    let targetTime: number

    if (!storedExpiresAt || typeof storedExpiresAt !== 'number') {
      targetTime = now + initialSeconds * 1000
      writeStorage(STORAGE_KEY, targetTime)
    } else {
      targetTime = storedExpiresAt
    }

    const remaining = Math.max(0, Math.floor((targetTime - now) / 1000))
    setSecondsLeft(remaining)
    setIsExpired(remaining <= 0)
    setHydrated(true)
  }, [initialSeconds])

  useEffect(() => {
    if (!hydrated) return

    if (secondsLeft <= 0) {
      if (!isExpired) {
        setIsExpired(true)
        onExpire?.()
      }
      return
    }

    const timer = setInterval(() => {
      const now = Date.now()
      const stored = readStorage<number | null>(STORAGE_KEY, null)
      if (!stored) return

      const remaining = Math.max(0, Math.floor((stored - now) / 1000))
      setSecondsLeft(remaining)

      if (remaining <= 0) {
        setIsExpired(true)
        onExpire?.()
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [hydrated, secondsLeft, isExpired, onExpire])

  const handleReset = useCallback(() => {
    const nextExpiresAt = Date.now() + initialSeconds * 1000
    writeStorage(STORAGE_KEY, nextExpiresAt)
    setSecondsLeft(initialSeconds)
    setIsExpired(false)
    onReset?.()
  }, [initialSeconds, onReset])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const isLowTime = secondsLeft > 0 && secondsLeft <= 120

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
            <strong>Reserva expirada:</strong> O prazo de 15 minutos encerrou e as peças retornaram à vitrine.
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="border-danger/40 text-danger hover:bg-danger/10"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Renovar reserva
        </Button>
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
            <span>Peças garantidas por:</span>
          )}
        </span>
        <span className="font-mono text-sm font-bold text-ink">
          {formattedTime}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Badge tone={isLowTime ? 'terracota' : 'oliva'}>
          {isLowTime ? 'Últimos minutos' : 'Reserva ativa (15 min)'}
        </Badge>
        <span className="hidden text-[11px] sm:inline text-ink-soft/80">
          Invariante 1 contra venda concorrente
        </span>
      </div>
    </div>
  )
}
