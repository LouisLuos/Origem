import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildItemsSignature,
  buildReservedQuantityMap,
  computeRemainingSeconds,
  computeServerOffsetMs,
  doesCartMatchReservation,
  effectiveAvailableQuantity,
  isCartCheckoutReservation,
  selectCurrentCartReservation,
  type ReservationGroupLike,
} from '../src/utils/cartReservation.util.ts'

describe('HU-09 Etapa 2 — Utilitários puros de reserva real no frontend', () => {
  it('calcula offset de relógio e segundos restantes com base exclusivamente em servidorAgora e expiraEm', () => {
    const servidorAgora = '2026-11-23T12:00:10.000Z'
    const expiraEm = '2026-11-23T12:15:10.000Z'
    // Simula navegador atrasado 10 segundos em relação ao servidor
    const localNowMs = Date.parse('2026-11-23T12:00:00.000Z')
    const offsetMs = computeServerOffsetMs(servidorAgora, localNowMs)
    assert.equal(offsetMs, 10_000)

    const restante = computeRemainingSeconds(expiraEm, offsetMs, localNowMs)
    assert.equal(restante, 900)

    // Passados exatamente 15 min no servidor -> 0s (nunca negativo)
    const depoisLocalMs = Date.parse('2026-11-23T12:15:05.000Z')
    assert.equal(computeRemainingSeconds(expiraEm, offsetMs, depoisLocalMs), 0)
  })

  it('separa reserva livre do carrinho/checkout de reserva vinculada a pedido ativo (HU-10) e ignora vencidas/terminais', () => {
    const serverNowMs = Date.parse('2026-11-23T12:05:00.000Z')

    const reservaExpirada: ReservationGroupLike = {
      grupoId: 'g-expirada',
      criadoEm: '2026-11-23T11:30:00.000Z',
      expiraEm: '2026-11-23T11:45:00.000Z',
      possuiPedidoAtivo: false,
      pedidoVinculado: null,
      itens: [{ pecaId: 'p-1', quantidade: 1, status: 'EXPIRADA' }],
    }

    const reservaComPedidoPendente: ReservationGroupLike = {
      grupoId: 'g-pedido-pix',
      criadoEm: '2026-11-23T12:04:00.000Z',
      expiraEm: '2026-11-23T12:14:00.000Z',
      possuiPedidoAtivo: true,
      pedidoVinculado: {
        pedidoId: 'ped-1',
        codigoPedido: 'OR-20261123-000001',
        status: 'PENDENTE_PAGAMENTO',
        ativo: true,
      },
      itens: [{ pecaId: 'p-2', quantidade: 1, status: 'ATIVA' }],
    }

    const reservaLivreAtual: ReservationGroupLike = {
      grupoId: 'g-livre',
      criadoEm: '2026-11-23T12:02:00.000Z',
      expiraEm: '2026-11-23T12:17:00.000Z',
      possuiPedidoAtivo: false,
      pedidoVinculado: {
        pedidoId: 'ped-old',
        codigoPedido: 'OR-RECUSADO',
        status: 'RECUSADO',
        ativo: false,
      },
      itens: [{ pecaId: 'p-3', quantidade: 2, status: 'ATIVA' }],
    }

    assert.equal(isCartCheckoutReservation(reservaExpirada, serverNowMs), false)
    assert.equal(isCartCheckoutReservation(reservaComPedidoPendente, serverNowMs), false)
    assert.equal(isCartCheckoutReservation(reservaLivreAtual, serverNowMs), true)

    const selection = selectCurrentCartReservation(
      [reservaExpirada, reservaComPedidoPendente, reservaLivreAtual],
      serverNowMs,
    )
    assert.equal(selection.activeCartReservation?.grupoId, 'g-livre')
    assert.equal(selection.activeOrderReservation?.grupoId, 'g-pedido-pix')
  })

  it('impede auto-bloqueio de peça única reservada pelo próprio comprador (stock = 0 no catálogo + 1 reservada = 1 disponível para ele)', () => {
    const serverNowMs = Date.parse('2026-11-23T12:05:00.000Z')
    const reservaUnica: ReservationGroupLike = {
      grupoId: 'g-unica',
      criadoEm: '2026-11-23T12:00:00.000Z',
      expiraEm: '2026-11-23T12:15:00.000Z',
      possuiPedidoAtivo: false,
      pedidoVinculado: null,
      itens: [{ pecaId: 'AAAA-1111', quantidade: 1, status: 'ATIVA' }],
    }

    const map = buildReservedQuantityMap(reservaUnica, serverNowMs)
    const propriaReserva = map.get('aaaa-1111') ?? 0
    assert.equal(propriaReserva, 1)

    // Catálogo exibe stock=0 após o decremento no PostgreSQL, mas o comprador dono continua podendo prosseguir
    assert.equal(effectiveAvailableQuantity(0, propriaReserva), 1)
    // Terceiros sem reserva continuam bloqueados em 0
    assert.equal(effectiveAvailableQuantity(0, 0), 0)
  })

  it('gera assinatura canônica independente da ordem dos itens e detecta alteração de quantidade no carrinho', () => {
    const sig1 = buildItemsSignature([
      { id: 'PECA-B', quantity: 2 },
      { id: 'peca-a', quantity: 1 },
    ])
    const sig2 = buildItemsSignature([
      { id: 'peca-a', quantity: 1 },
      { id: 'peca-b', quantity: 2 },
    ])
    assert.equal(sig1, sig2)

    const reserva: ReservationGroupLike = {
      grupoId: 'g-1',
      criadoEm: '2026-11-23T12:00:00.000Z',
      expiraEm: '2026-11-23T12:15:00.000Z',
      itens: [
        { pecaId: 'peca-a', quantidade: 1, status: 'ATIVA' },
        { pecaId: 'peca-b', quantidade: 2, status: 'ATIVA' },
      ],
    }

    assert.equal(
      doesCartMatchReservation(
        [
          { id: 'peca-b', quantity: 2 },
          { id: 'peca-a', quantity: 1 },
        ],
        reserva,
      ),
      true,
    )
    assert.equal(
      doesCartMatchReservation(
        [
          { id: 'peca-a', quantity: 1 },
          { id: 'peca-b', quantity: 3 },
        ],
        reserva,
      ),
      false,
    )
  })
})
