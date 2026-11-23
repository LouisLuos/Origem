import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyAddCartItem,
  applyRemoveCartItem,
  applySetCartItemQuantity,
  buildItemsSignature,
  buildReservedQuantityMap,
  classifyPendingCheckoutOrders,
  computeExpirationRecheckDelayMs,
  computeRemainingMs,
  computeRemainingSeconds,
  computeServerOffsetMs,
  doesCartMatchReservation,
  effectiveAvailableQuantity,
  isCartCheckoutReservation,
  resolveProductDetailStockState,
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

  it('Bug #1: computeRemainingSeconds usa Math.ceil evitando 0 prematuro antes de expiraEm e calcula delay de rechecagem', () => {
    const expiraEm = '2026-11-23T12:15:10.000Z'
    const targetMs = Date.parse(expiraEm)

    assert.equal(computeRemainingMs(expiraEm, 0, targetMs - 800), 800)
    assert.equal(computeRemainingSeconds(expiraEm, 0, targetMs - 999), 1)
    assert.equal(computeRemainingSeconds(expiraEm, 0, targetMs - 800), 1)
    assert.equal(computeRemainingSeconds(expiraEm, 0, targetMs - 1), 1)

    // Exatamente no instante de vencimento e após ele -> 0s
    assert.equal(computeRemainingSeconds(expiraEm, 0, targetMs), 0)
    assert.equal(computeRemainingSeconds(expiraEm, 0, targetMs + 500), 0)

    // Delay de rechecagem respeita buffer, mínimo e máximo
    assert.equal(computeExpirationRecheckDelayMs(expiraEm, 0, targetMs - 800), 1050)
    assert.equal(computeExpirationRecheckDelayMs(expiraEm, 0, targetMs + 100), 300)
    assert.equal(computeExpirationRecheckDelayMs(expiraEm, 0, targetMs - 60_000), 15_000)
  })

  it('Bug #3: diferencia pedido PENDENTE_PAGAMENTO recuperável de pedido já vencido sem que pedido APROVADO mascare pendente', () => {
    const serverNowMs = Date.parse('2026-11-23T12:20:00.000Z')

    const reservaPedidoAprovadoRecente: ReservationGroupLike = {
      grupoId: 'g-aprovado',
      criadoEm: '2026-11-23T12:18:00.000Z',
      expiraEm: '2026-11-23T12:33:00.000Z',
      possuiPedidoAtivo: true,
      pedidoVinculado: {
        pedidoId: 'ped-aprovado',
        codigoPedido: 'OR-APROVADO',
        status: 'APROVADO',
        ativo: true,
      },
      itens: [{ pecaId: 'p-1', quantidade: 1, status: 'CONFIRMADA' }],
    }

    const reservaPixVencido: ReservationGroupLike = {
      grupoId: 'g-pix-vencido',
      criadoEm: '2026-11-23T12:00:00.000Z',
      expiraEm: '2026-11-23T12:15:00.000Z',
      possuiPedidoAtivo: true,
      pedidoVinculado: {
        pedidoId: 'ped-vencido',
        codigoPedido: 'OR-PIX-VENCIDO',
        status: 'PENDENTE_PAGAMENTO',
        ativo: true,
      },
      itens: [{ pecaId: 'p-2', quantidade: 1, status: 'ATIVA' }],
    }

    const reservaPixAtivo: ReservationGroupLike = {
      grupoId: 'g-pix-ativo',
      criadoEm: '2026-11-23T12:12:00.000Z',
      expiraEm: '2026-11-23T12:27:00.000Z',
      possuiPedidoAtivo: true,
      pedidoVinculado: {
        pedidoId: 'ped-ativo',
        codigoPedido: 'OR-PIX-ATIVO',
        status: 'PENDENTE_PAGAMENTO',
        ativo: true,
      },
      itens: [{ pecaId: 'p-3', quantidade: 1, status: 'ATIVA' }],
    }

    const selected = selectCurrentCartReservation(
      [reservaPedidoAprovadoRecente, reservaPixVencido, reservaPixAtivo],
      serverNowMs,
    )
    assert.equal(selected.activeOrderReservation?.grupoId, 'g-pix-ativo')
    assert.equal(selected.expiredPendingOrderReservation?.grupoId, 'g-pix-vencido')

    // Quando há pedido Pix dentro do prazo, ele continua recuperável
    const c1 = classifyPendingCheckoutOrders({
      orders: [],
      activeOrderReservation: selected.activeOrderReservation,
      expiredPendingOrderReservation: selected.expiredPendingOrderReservation,
      serverOffsetMs: 0,
      localNowMs: serverNowMs,
    })
    assert.equal(c1.recoverableOrderCode, 'OR-PIX-ATIVO')
    assert.equal(c1.awaitingReconciliationOrderCode, 'OR-PIX-VENCIDO')

    // Quando só existe o pedido vencido (ex.: scheduler de 60s ainda não rodou), não bloqueia como recuperável
    const selectedOnlyExpired = selectCurrentCartReservation(
      [reservaPedidoAprovadoRecente, reservaPixVencido],
      serverNowMs,
    )
    assert.equal(selectedOnlyExpired.activeOrderReservation, null)
    assert.equal(selectedOnlyExpired.expiredPendingOrderReservation?.grupoId, 'g-pix-vencido')

    const c2 = classifyPendingCheckoutOrders({
      orders: [
        {
          codigoPedido: 'OR-PIX-VENCIDO',
          status: 'PENDENTE_PAGAMENTO',
          pagamentoAtual: { expiraEm: '2026-11-23T12:15:00.000Z' },
        },
      ],
      activeOrderReservation: selectedOnlyExpired.activeOrderReservation,
      expiredPendingOrderReservation: selectedOnlyExpired.expiredPendingOrderReservation,
      serverOffsetMs: 0,
      localNowMs: serverNowMs,
    })
    assert.equal(c2.recoverableOrderCode, null)
    assert.equal(c2.awaitingReconciliationOrderCode, 'OR-PIX-VENCIDO')

    // Quando o servidor finalmente marca EXPIRADO/APROVADO em `orders`, deixa até de constar como aguardando
    const c3 = classifyPendingCheckoutOrders({
      orders: [
        {
          codigoPedido: 'OR-PIX-VENCIDO',
          status: 'EXPIRADO',
          pagamentoAtual: { expiraEm: '2026-11-23T12:15:00.000Z' },
        },
      ],
      activeOrderReservation: null,
      expiredPendingOrderReservation: selectedOnlyExpired.expiredPendingOrderReservation,
      serverOffsetMs: 0,
      localNowMs: serverNowMs,
    })
    assert.equal(c3.recoverableOrderCode, null)
    assert.equal(c3.awaitingReconciliationOrderCode, null)
  })

  it('Bug #4: mutações puras no carrinho detectam operações no-op sem cancelar reserva válida', () => {
    const initial = [{ id: 'peca-unica', quantity: 1 }]

    // Clamp em limite = 1 -> no-op
    const addSame = applyAddCartItem(initial, 'peca-unica', 1, 1)
    assert.equal(addSame.changed, false)
    assert.deepEqual(addSame.items, initial)

    // Mesma quantidade -> no-op
    const setSame = applySetCartItemQuantity(initial, 'peca-unica', 1, 1)
    assert.equal(setSame.changed, false)

    // Remoção de item ausente -> no-op
    const removeMissing = applyRemoveCartItem(initial, 'outra-peca')
    assert.equal(removeMissing.changed, false)

    // Alteração para quantity <= 0 ou aumento válido -> changed = true
    const removeViaZero = applySetCartItemQuantity(initial, 'peca-unica', 0, 1)
    assert.equal(removeViaZero.changed, true)
    assert.deepEqual(removeViaZero.items, [])

    const addNew = applyAddCartItem(initial, 'peca-lote', 2, 5)
    assert.equal(addNew.changed, true)
    assert.equal(addNew.items.length, 2)
  })

  it('Bug #5: resolveProductDetailStockState reconhece reserva do próprio comprador mantendo Esgotado para terceiros', () => {
    // Outro comprador diante de peça única já reservada (stock = 0 no catálogo, 0 reservado por ele)
    const outroComprador = resolveProductDetailStockState({
      publicStock: 0,
      reservedByCurrentUser: 0,
      quantityInCart: 0,
    })
    assert.equal(outroComprador.isSoldOut, true)
    assert.equal(outroComprador.effectiveAvailable, 0)
    assert.equal(outroComprador.isFullyReservedByCurrentUser, false)

    // Comprador dono da reserva única (stock = 0 no catálogo + 1 reservada em seu nome)
    const donoUnica = resolveProductDetailStockState({
      publicStock: 0,
      reservedByCurrentUser: 1,
      quantityInCart: 1,
    })
    assert.equal(donoUnica.isSoldOut, false)
    assert.equal(donoUnica.effectiveAvailable, 1)
    assert.equal(donoUnica.remainingAddable, 0)
    assert.equal(donoUnica.isFullyReservedByCurrentUser, true)

    // Comprador com 2 reservadas de um lote de 5 (sobram 3 públicas)
    const donoParcial = resolveProductDetailStockState({
      publicStock: 3,
      reservedByCurrentUser: 2,
      quantityInCart: 2,
    })
    assert.equal(donoParcial.isSoldOut, false)
    assert.equal(donoParcial.effectiveAvailable, 5)
    assert.equal(donoParcial.remainingAddable, 3)
    assert.equal(donoParcial.isFullyReservedByCurrentUser, false)
  })
})
