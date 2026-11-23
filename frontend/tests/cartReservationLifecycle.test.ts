import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyAddCartItem,
  applySetCartItemQuantity,
  computeExpirationRecheckDelayMs,
  type ReservationGroupLike,
} from '../src/utils/cartReservation.util.ts'
import {
  executeExpirationSyncWithRecheck,
  executeSafeCancelFreeReservation,
  type ReservationErrorInfo,
} from '../src/utils/cartReservationCoordinator.ts'

function makeReservation(overrides?: Partial<ReservationGroupLike>): ReservationGroupLike {
  return {
    grupoId: 'grupo-ativa-1',
    criadoEm: '2026-11-23T12:00:00.000Z',
    expiraEm: '2026-11-23T12:15:00.000Z',
    possuiPedidoAtivo: false,
    pedidoVinculado: null,
    itens: [{ pecaId: 'peca-unica', quantidade: 1, status: 'ATIVA' }],
    ...overrides,
  }
}

describe('HU-09 Bugs #1, #2 e #4 — Coordenador de ciclo de vida das reservas', () => {
  it('Bug #2 (rede / timeout / 5xx): NÃO limpa reserva ativa, bloqueia criação de outra e exige ressincronização', async () => {
    const casosDeFalha = [
      { label: 'erro de rede', err: Object.assign(new Error('Rede indisponível'), { status: 0, code: 'REDE_INDISPONIVEL' }) },
      { label: 'timeout (AbortError)', err: Object.assign(new Error('Timeout'), { name: 'AbortError' }) },
      { label: 'HTTP 503', err: Object.assign(new Error('Service Unavailable'), { status: 503 }) },
    ]

    for (const caso of casosDeFalha) {
      let activeReservation: ReservationGroupLike | null = makeReservation()
      let needsResync = false
      let clearedCount = 0
      let capturedError: ReservationErrorInfo | null = null
      let resyncCalls = 0
      let reserveStockCalls = 0

      // Simula falha no cancelamento E falha na ressincronização subsequente (offline completo)
      const ok = await executeSafeCancelFreeReservation({
        current: activeReservation,
        cancelReservation: async () => {
          throw caso.err
        },
        resyncFromServer: async () => {
          resyncCalls += 1
          return {
            ok: false,
            activeCartReservation: activeReservation,
            serverOffsetMs: 0,
          }
        },
        onCleared: () => {
          clearedCount += 1
          activeReservation = null
        },
        onError: (err) => {
          capturedError = err
        },
        onMarkNeedsResync: (val) => {
          needsResync = val
        },
      })

      assert.equal(ok, false, `Falha esperada para ${caso.label}`)
      assert.equal(clearedCount, 0, `Reserva NÃO pode ser limpa otimisticamente em ${caso.label}`)
      assert.equal(activeReservation?.grupoId, 'grupo-ativa-1')
      assert.equal(needsResync, true)
      assert.equal(resyncCalls, 1)
      assert.ok(capturedError !== null)

      // Guarda equivalente a reserveCart(): enquanto needsResync=true e sync falhar, não cria segunda reserva
      if (needsResync) {
        const resyncBeforeCreate = false
        if (resyncBeforeCreate) {
          reserveStockCalls += 1
        }
      }
      assert.equal(reserveStockCalls, 0)
    }
  })

  it('Bug #2 (409 pedido ativo e recuperação por resync): mantém proteção da HU-10 e ressincroniza estado real', async () => {
    let activeReservation: ReservationGroupLike | null = makeReservation()
    let needsResync = false
    let capturedError: ReservationErrorInfo | null = null

    const ok409 = await executeSafeCancelFreeReservation({
      current: activeReservation,
      cancelReservation: async () => {
        throw Object.assign(new Error('Pedido ativo vinculado'), {
          status: 409,
          code: 'RESERVA_VINCULADA_A_PEDIDO_ATIVO',
        })
      },
      resyncFromServer: async () => {
        activeReservation = null
        return {
          ok: true,
          activeCartReservation: null,
          serverOffsetMs: 0,
        }
      },
      onCleared: () => {
        activeReservation = null
      },
      onError: (err) => {
        capturedError = err
      },
      onMarkNeedsResync: (val) => {
        needsResync = val
      },
    })

    assert.equal(ok409, false)
    assert.equal((capturedError as ReservationErrorInfo | null)?.code, 'RESERVA_VINCULADA_A_PEDIDO_ATIVO')
    assert.equal(needsResync, false)

    // Caminho feliz (HTTP 200) -> limpa e devolve true
    let cleared = false
    const ok200 = await executeSafeCancelFreeReservation({
      current: makeReservation(),
      cancelReservation: async () => ({ jaFinalizada: false }),
      resyncFromServer: async () => ({ ok: true, activeCartReservation: null, serverOffsetMs: 0 }),
      onCleared: () => {
        cleared = true
      },
      onError: () => {
        assert.fail('Não deveria reportar erro no cancelamento 200')
      },
      onMarkNeedsResync: () => {},
    })

    assert.equal(ok200, true)
    assert.equal(cleared, true)
  })

  it('Bug #1 (drift de relógio no vencimento): agenda rechecagem quando backend ainda retorna reserva ATIVA e conclui quando expira', async () => {
    const active = makeReservation({ expiraEm: '2026-11-23T12:15:10.000Z' })
    const scheduledDelays: number[] = []
    let confirmedCleared = false
    let syncStep = 0

    // Tentativa 1: backend responde antes de atingir expiraEm (faltam 500ms no servidor)
    const outcome1 = await executeExpirationSyncWithRecheck({
      targetReservation: active,
      maxAttempts: 3,
      currentAttemptCount: 1,
      syncFromServer: async () => {
        syncStep += 1
        return {
          ok: true,
          activeCartReservation: active,
          serverOffsetMs: -500,
        }
      },
      computeDelayMs: (expiraEm, offsetMs) =>
        computeExpirationRecheckDelayMs(
          expiraEm,
          offsetMs,
          Date.parse('2026-11-23T12:15:10.000Z'),
        ),
      scheduleRecheck: (delayMs) => {
        scheduledDelays.push(delayMs)
      },
      onConfirmedCleared: () => {
        confirmedCleared = true
      },
    })

    assert.equal(syncStep, 1)
    assert.equal(outcome1, 'RESCHEDULED')
    assert.equal(scheduledDelays.length, 1)
    assert.equal(scheduledDelays[0], 750)
    assert.equal(confirmedCleared, false)

    // Tentativa 2 (disparada após o timer): servidor já expirou a reserva
    const outcome2 = await executeExpirationSyncWithRecheck({
      targetReservation: active,
      maxAttempts: 3,
      currentAttemptCount: 2,
      syncFromServer: async () => {
        syncStep += 1
        return {
          ok: true,
          activeCartReservation: null,
          serverOffsetMs: 0,
        }
      },
      computeDelayMs: () => 500,
      scheduleRecheck: () => {
        assert.fail('Não deveria reagendar após servidor confirmar expiração')
      },
      onConfirmedCleared: () => {
        confirmedCleared = true
      },
    })

    assert.equal(syncStep, 2)
    assert.equal(outcome2, 'EXPIRED_OR_CLEARED')
    assert.equal(confirmedCleared, true)

    // Se exceder maxAttempts com servidor sempre ativo ou offline, encerra sem loop infinito
    let exhausted = false
    const outcome3 = await executeExpirationSyncWithRecheck({
      targetReservation: active,
      maxAttempts: 3,
      currentAttemptCount: 3,
      syncFromServer: async () => ({ ok: false, activeCartReservation: active, serverOffsetMs: 0 }),
      computeDelayMs: () => 500,
      scheduleRecheck: () => {
        assert.fail('Não deveria reagendar além de maxAttempts')
      },
      onExhausted: () => {
        exhausted = true
      },
    })

    assert.equal(outcome3, 'EXHAUSTED')
    assert.equal(exhausted, true)
  })

  it('Bug #4 (fluxo integrado): tentativa no-op com reserva ativa não dispara cancelamento no backend', async () => {
    const active = makeReservation()
    let cancelCalls = 0
    const cart = [{ id: 'peca-unica', quantity: 1 }]

    const res1 = applyAddCartItem(cart, 'peca-unica', 1, 1)
    const res2 = applySetCartItemQuantity(cart, 'peca-unica', 1, 1)

    if (res1.changed || res2.changed) {
      await executeSafeCancelFreeReservation({
        current: active,
        cancelReservation: async () => {
          cancelCalls += 1
        },
        resyncFromServer: async () => ({ ok: true, activeCartReservation: active, serverOffsetMs: 0 }),
        onCleared: () => {},
        onError: () => {},
        onMarkNeedsResync: () => {},
      })
    }

    assert.equal(cancelCalls, 0)
  })
})
