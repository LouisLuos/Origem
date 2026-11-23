import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { MercadoPagoPaymentGateway } from '../../src/integrations/mercadoPago.gateway.js';
import { PagarmeV5PaymentGateway } from '../../src/integrations/pagarmeV5.gateway.js';
import {
  PAGAMENTO_ERROR_CODES,
  PaymentGatewayError,
} from '../../src/integrations/paymentGateway.contracts.js';
import { UnconfiguredPaymentGateway } from '../../src/integrations/unconfiguredPayment.gateway.js';

describe('HU-10 — Adaptadores PaymentGatewayPort (Pagar.me v5, Mercado Pago, Unconfigured)', () => {
  let server: http.Server;
  let baseUrl = '';
  let lastOrderPayload: Record<string, unknown> | null = null;
  let simulatedDelayMs = 0;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/orders' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          setTimeout(() => {
            if (res.writableEnded) return;
            lastOrderPayload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
              string,
              unknown
            >;
            const payments = (lastOrderPayload.payments ?? []) as Array<Record<string, unknown>>;
            const method = payments[0]?.payment_method;

            if (method === 'pix') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  id: 'or_test_pix_1',
                  status: 'pending',
                  charges: [
                    {
                      id: 'ch_test_pix_1',
                      status: 'pending',
                      last_transaction: {
                        id: 'tx_1',
                        status: 'waiting_payment',
                        qr_code: '00020101021226850014br.gov.bcb.pix2563sandbox.origem',
                        qr_code_url: 'https://api.pagar.me/qrcode/mock.png',
                        expires_at: new Date(Date.now() + 500_000).toISOString(),
                      },
                    },
                  ],
                }),
              );
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                id: 'or_test_card_1',
                status: 'paid',
                charges: [
                  {
                    id: 'ch_test_card_1',
                    status: 'paid',
                    last_transaction: {
                      id: 'tx_2',
                      status: 'captured',
                      card: { brand: 'Visa', last_four_digits: '4242' },
                    },
                  },
                ],
              }),
            );
          }, simulatedDelayMs);
        });
        return;
      }

      if (req.url?.startsWith('/charges/ch_test_') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'ch_test_pix_1',
            status: 'paid',
            last_transaction: { status: 'paid' },
          }),
        );
        return;
      }

      res.writeHead(404).end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const inputBase = {
    pedidoId: '11111111-1111-4111-8111-111111111111',
    pagamentoId: '22222222-2222-4222-8222-222222222222',
    codigoPedido: 'OR-20261123-AA11BB',
    reservaGrupoId: '33333333-3333-4333-8333-333333333333',
    idempotencyKey: 'pgto_unit_1',
    valorCentavos: 12490,
    valorFreteCentavos: 2490,
    expiraEm: new Date(Date.now() + 500_000),
    agora: new Date(),
    comprador: {
      usuarioId: '44444444-4444-4444-8444-444444444444',
      nome: 'Maria Artesanato',
      email: 'maria@origem.pe.br',
      cpfCnpj: '12345678909',
      telefone: '81999998888',
    },
    enderecoEntrega: {
      cep: '50010000',
      logradouro: 'Rua da Aurora',
      numero: '123',
      bairro: 'Boa Vista',
      cidade: 'Recife',
      uf: 'PE',
    },
    itens: [
      {
        pecaId: '55555555-5555-4555-8555-555555555555',
        titulo: 'Moringa Caruaru',
        quantidade: 1,
        precoUnitarioCentavos: 10000,
      },
    ],
  };

  it('PagarmeV5 envia expires_in fracionário em segundos alinhado à reserva e gera Pix', async () => {
    simulatedDelayMs = 0;
    const gateway = new PagarmeV5PaymentGateway({
      baseUrl,
      secretKey: 'sk_test_mock_key',
      ambiente: 'sandbox',
      timeoutMs: 3000,
      webhookSecret: 'wh_secret_test',
    });

    const agora = new Date('2026-11-23T12:00:00.000Z');
    const expiraEm = new Date('2026-11-23T12:08:20.000Z'); // 500s restantes
    const res = await gateway.criarPagamentoPix({ ...inputBase, agora, expiraEm });

    assert.equal(res.status, 'PENDENTE');
    assert.equal(res.externalPaymentId, 'ch_test_pix_1');
    assert.ok(res.pixCopiaECola?.includes('br.gov.bcb.pix'));

    const payments = (lastOrderPayload?.payments ?? []) as Array<{ pix?: { expires_in?: number } }>;
    assert.equal(payments[0]?.pix?.expires_in, 500);
  });

  it('PagarmeV5 processa cartão tokenizado sem PAN/CVV e valida HMAC no webhook', async () => {
    const gateway = new PagarmeV5PaymentGateway({
      baseUrl,
      secretKey: 'sk_test_mock_key',
      ambiente: 'sandbox',
      timeoutMs: 3000,
      webhookSecret: 'wh_secret_test',
    });

    const cardRes = await gateway.criarPagamentoCartao({
      ...inputBase,
      cardToken: 'tok_pagarme_123456',
      parcelas: 3,
    });
    assert.equal(cardRes.status, 'APROVADO');
    assert.equal(cardRes.cartaoUltimosDigitos, '4242');

    const body = {
      id: 'hook_001',
      type: 'charge.paid',
      data: {
        id: 'ch_test_pix_1',
        status: 'paid',
        metadata: { pedidoId: inputBase.pedidoId, pagamentoId: inputBase.pagamentoId },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body), 'utf8');
    const sig = crypto.createHmac('sha256', 'wh_secret_test').update(rawBody).digest('hex');

    const okWebhook = gateway.validarEInterpretarWebhook({
      headers: { 'x-hub-signature': `sha256=${sig}` },
      query: {},
      rawBody,
      body,
    });
    assert.equal(okWebhook.assinaturaValida, true);
    assert.equal(okWebhook.eventoExternoId, 'hook_001');

    const badWebhook = gateway.validarEInterpretarWebhook({
      headers: { 'x-hub-signature': 'sha256=invalido' },
      query: {},
      rawBody,
      body,
    });
    assert.equal(badWebhook.assinaturaValida, false);
  });

  it('PagarmeV5 marca resultadoDesconhecido=true quando timeout estoura em criação', async () => {
    simulatedDelayMs = 250;
    const gateway = new PagarmeV5PaymentGateway({
      baseUrl,
      secretKey: 'sk_test_mock_key',
      ambiente: 'sandbox',
      timeoutMs: 80,
      webhookSecret: 'wh_secret_test',
    });

    await assert.rejects(
      () => gateway.criarPagamentoPix(inputBase),
      (err: unknown) =>
        err instanceof PaymentGatewayError &&
        err.resultadoDesconhecido === true &&
        err.codigo === PAGAMENTO_ERROR_CODES.GATEWAY_TIMEOUT_RESULTADO_DESCONHECIDO,
    );
    simulatedDelayMs = 0;
  });

  it('MercadoPago valida expiração mínima de 30 min no Pix e assinatura HMAC oficial', async () => {
    const mp = new MercadoPagoPaymentGateway({
      baseUrl: 'https://api.mercadopago.com',
      accessToken: 'TEST-123',
      ambiente: 'sandbox',
      timeoutMs: 3000,
      webhookSecret: 'mp_secret_123',
    });

    // Reserva de 15 min (900s) é menor que 1800s (30 min) -> rejeita explicitamente sem divergência silenciosa
    await assert.rejects(
      () =>
        mp.criarPagamentoPix({
          ...inputBase,
          agora: new Date('2026-11-23T12:00:00.000Z'),
          expiraEm: new Date('2026-11-23T12:15:00.000Z'),
        }),
      (err: unknown) =>
        err instanceof PaymentGatewayError &&
        err.codigo === PAGAMENTO_ERROR_CODES.GATEWAY_EXPIRACAO_INCOMPATIVEL,
    );

    const ts = '1732360000';
    const dataId = '987654321';
    const reqId = 'req-abc-123';
    const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
    const v1 = crypto.createHmac('sha256', 'mp_secret_123').update(manifest).digest('hex');

    const evt = mp.validarEInterpretarWebhook({
      headers: {
        'x-signature': `ts=${ts},v1=${v1}`,
        'x-request-id': reqId,
      },
      query: { 'data.id': dataId },
      rawBody: Buffer.from('{}'),
      body: { id: 1001, action: 'payment.updated', data: { id: dataId } },
    });
    assert.equal(evt.assinaturaValida, true);
    assert.equal(evt.externalPaymentId, dataId);
  });

  it('UnconfiguredPaymentGateway opera fail-closed sem simular aprovação', async () => {
    const disabled = new UnconfiguredPaymentGateway();
    assert.equal(disabled.configurado, false);
    await assert.rejects(
      () => disabled.criarPagamentoPix(inputBase),
      (err: unknown) =>
        err instanceof PaymentGatewayError &&
        err.statusHttp === 503 &&
        err.codigo === PAGAMENTO_ERROR_CODES.PROVEDOR_PAGAMENTO_NAO_CONFIGURADO,
    );
  });
});
