import type { ReservationGroupLike } from './cartReservation.util'

export interface ReservationErrorInfo {
  readonly status?: number
  readonly code?: string
  readonly message: string
}

export interface ReservationSyncSnapshot<T extends ReservationGroupLike = ReservationGroupLike> {
  readonly ok: boolean
  readonly activeCartReservation: T | null
  readonly serverOffsetMs: number
}

export type ExpirationRecheckOutcome =
  | 'EXPIRED_OR_CLEARED'
  | 'RESCHEDULED'
  | 'EXHAUSTED'

/** Extrai status HTTP, código de domínio e mensagem legível a partir de falhas da API ou rede. */
export function extractReservationErrorInfo(
  reason: unknown,
  fallback: string,
): ReservationErrorInfo {
  if (reason && typeof reason === 'object') {
    const candidate = reason as {
      message?: unknown
      name?: unknown
      status?: unknown
      code?: unknown
    }
    const status = typeof candidate.status === 'number' ? candidate.status : undefined
    let code = typeof candidate.code === 'string' ? candidate.code : undefined
    if (!code && candidate.name === 'AbortError') {
      code = 'TIMEOUT'
    }
    const message =
      reason instanceof Error && reason.message.trim().length > 0
        ? reason.message
        : typeof candidate.message === 'string' && candidate.message.trim().length > 0
          ? candidate.message
          : fallback

    return {
      ...(status !== undefined ? { status } : {}),
      ...(code !== undefined ? { code } : {}),
      message,
    }
  }

  return {
    message: typeof reason === 'string' && reason.trim().length > 0 ? reason : fallback,
  }
}

/**
 * Executa o cancelamento de uma reserva livre sem limpeza otimista em caso de erro de rede,
 * timeout ou HTTP 5xx, exigindo ressincronização com o servidor antes de permitir novas ações.
 */
export async function executeSafeCancelFreeReservation<
  T extends ReservationGroupLike,
>(params: {
  readonly current: T | null
  readonly cancelReservation: (grupoId: string) => Promise<unknown>
  readonly resyncFromServer: (opts?: {
    readonly triggerCatalogReload?: boolean
  }) => Promise<ReservationSyncSnapshot<T>>
  readonly onCleared: () => void
  readonly onError: (error: ReservationErrorInfo) => void
  readonly onMarkNeedsResync: (value: boolean) => void
}): Promise<boolean> {
  const { current, cancelReservation, resyncFromServer, onCleared, onError, onMarkNeedsResync } =
    params

  if (!current) {
    return true
  }

  if (current.possuiPedidoAtivo || current.pedidoVinculado?.ativo) {
    onError({
      status: 409,
      code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
      message: 'Esta reserva está vinculada a um pedido ativo e não pode ser cancelada diretamente.',
    })
    return false
  }

  try {
    await cancelReservation(current.grupoId)
    onMarkNeedsResync(false)
    onCleared()
    return true
  } catch (reason) {
    const errInfo = extractReservationErrorInfo(
      reason,
      'Não foi possível liberar a reserva atual no servidor.',
    )

    if (
      errInfo.code === 'RESERVA_VINCULADA_A_PEDIDO_ATIVO' ||
      errInfo.code === 'RESERVA_TRANSICAO_INVALIDA'
    ) {
      onError({
        ...errInfo,
        message:
          errInfo.code === 'RESERVA_VINCULADA_A_PEDIDO_ATIVO'
            ? errInfo.message || 'A reserva já possui um pedido ativo e não pode ser alterada.'
            : errInfo.message,
      })
      onMarkNeedsResync(true)
      const sync = await resyncFromServer({ triggerCatalogReload: true })
      if (sync.ok) {
        onMarkNeedsResync(false)
      }
      return false
    }

    if (errInfo.status === 404) {
      onMarkNeedsResync(true)
      const sync = await resyncFromServer({ triggerCatalogReload: true })
      if (sync.ok && sync.activeCartReservation?.grupoId !== current.grupoId) {
        onMarkNeedsResync(false)
        onCleared()
        return true
      }
      onError(errInfo)
      return false
    }

    onMarkNeedsResync(true)
    onError({
      ...errInfo,
      message:
        'Não foi possível confirmar o cancelamento da reserva no servidor. Ressincronizamos o estado antes de liberar novas alterações.',
    })

    const sync = await resyncFromServer({ triggerCatalogReload: true })
    if (sync.ok) {
      onMarkNeedsResync(false)
    }

    return false
  }
}

/**
 * Sincroniza a expiração da reserva com o servidor e agenda nova verificação limitada caso o
 * backend ainda mantenha a mesma reserva ativa por pequeno desvio de relógio/latência.
 */
export async function executeExpirationSyncWithRecheck<
  T extends ReservationGroupLike,
>(params: {
  readonly targetReservation: Pick<T, 'grupoId' | 'expiraEm'> | null
  readonly maxAttempts?: number
  readonly currentAttemptCount: number
  readonly syncFromServer: (opts?: {
    readonly triggerCatalogReload?: boolean
  }) => Promise<ReservationSyncSnapshot<T>>
  readonly computeDelayMs: (expiresAtIso: string, serverOffsetMs: number) => number
  readonly scheduleRecheck: (delayMs: number) => void
  readonly onConfirmedCleared?: () => void
  readonly onExhausted?: () => void
}): Promise<ExpirationRecheckOutcome> {
  const maxAttempts = params.maxAttempts ?? 3
  const sync = await params.syncFromServer({ triggerCatalogReload: true })

  if (!sync.ok) {
    if (params.currentAttemptCount < maxAttempts) {
      params.scheduleRecheck(1000)
      return 'RESCHEDULED'
    }
    params.onExhausted?.()
    return 'EXHAUSTED'
  }

  if (
    sync.activeCartReservation &&
    params.targetReservation &&
    sync.activeCartReservation.grupoId === params.targetReservation.grupoId
  ) {
    if (params.currentAttemptCount < maxAttempts) {
      const delayMs = params.computeDelayMs(
        sync.activeCartReservation.expiraEm,
        sync.serverOffsetMs,
      )
      params.scheduleRecheck(delayMs)
      return 'RESCHEDULED'
    }
    params.onExhausted?.()
    return 'EXHAUSTED'
  }

  params.onConfirmedCleared?.()
  return 'EXPIRED_OR_CLEARED'
}
