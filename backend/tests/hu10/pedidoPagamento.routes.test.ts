import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import express, { type Request } from 'express';
import { FRETE_ERROR_CODES, UnconfiguredCotacaoFreteProvider } from '../../src/integrations/frete.provider.js';
import { HttpSandboxPaymentGateway } from '../../src/integrations/httpSandbox.gateway.js';
import { PAGAMENTO_ERROR_CODES } from '../../src/integrations/paymentGateway.contracts.js';
import { UnconfiguredPaymentGateway } from '../../src/integrations/unconfiguredPayment.gateway.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import type { AuthIdentityProvider } from '../../src/repositories/contracts/auth.contracts.js';
import type { PedidoDetalhado } from '../../src/repositories/contracts/pedidosPagamentos.contracts.js';
import type { PrismaPedidoPagamentoRepository } from '../../src/repositories/prismaPedidoPagamento.repository.js';
import type { GrupoReservaCheckoutCarregado } from '../../src/repositories/prismaReserva.repository.js';
import { createPagamentoRoutes } from '../../src/routes/pagamento.routes.js';
import { createPedidoRoutes } from '../../src/routes/pedido.routes.js';
import { createCheckoutPagamentoService } from '../../src/services/checkoutPagamento.service.js';
import { AppError } from '../../src/utils/AppError.js';

const COMPRADOR_A = '11111111-1111-4111-8111-111111111111';
const COMPRADOR_B = '22222222-2222-4222-8222-222222222222';
const RESERVA_GRUPO = '33333333-3333-4333-8333-333333333333';
const PEDIDO_A_ID = '44444444-4444-4444-8444-444444444444';

const ENDERECO_VALIDO = {
  nomeDestinatario: 'Maria Silva',
  email: 'maria@origem.pe.br',
  telefone: '81999998888',
  cep: '50010000',
  logradouro: 'Rua da Aurora',
  numero: '123',
  bairro: 'Boa Vista',
  cidade: 'Recife',
  uf: 'PE',
};

const GRUPO_CARREGADO_FIXTURE: GrupoReservaCheckoutCarregado = {
  grupoId: RESERVA_GRUPO,
  usuarioId: COMPRADOR_A,
  expiraEm: new Date(Date.now() + 10 * 60_000),
  comprador: {
    usuarioId: COMPRADOR_A,
    nome: 'Maria Silva',
    email: 'maria@origem.pe.br',
    cpfCnpj: '12345678909',
    telefoneWhatsapp: '81999998888',
  },
  itens: [
    {
      reservaId: '55555555-5555-4555-8555-555555555555',
      pecaId: '66666666-6666-4666-8666-666666666666',
      titulo: 'Moranga de Barro',
      quantidade: 1,
      precoUnitarioString: '100.00',
      pesoGramas: 700,
      comprimentoCm: 20,
      larguraCm: 15,
      alturaCm: 20,
      isFragil: true,
      fotoPrincipalUrl: null,
      atelieId: '77777777-7777-4777-8777-777777777777',
      atelieNome: 'Barro Vivo',
      poloCultural: 'Caruaru',
      atelieCepOrigem: '55002000',
      titularUsuarioId: '88888888-8888-4888-8888-888888888888',
      titularNome: 'Mestre Vitalino',
      titularEmail: 'mestre@origem.pe.br',
      titularWhatsapp: '81988887777',
    },
  ],
};

function createFakeRepo(overrides: Partial<PrismaPedidoPagamentoRepository> = {}): PrismaPedidoPagamentoRepository {
  return {
    async buscarPorIdempotencyKey() {
      return null;
    },
    async carregarGrupoReservaAtiva() {
      return GRUPO_CARREGADO_FIXTURE;
    },
    async iniciarPedidoEPagamentoAntesGateway() {
      throw new Error('Não esperado nesta asserção.');
    },
    async registrarResultadoGatewayNoCheckout() {
      throw new Error('Não esperado nesta asserção.');
    },
    async registrarErroGatewayNoCheckout() {
      // noop
    },
    async processarWebhookAtomico() {
      throw new Error('Não esperado nesta asserção.');
    },
    async listarPedidosUsuario() {
      return [];
    },
    async buscarPedidoUsuarioPorIdOuCodigo(usuarioId) {
      if (usuarioId !== COMPRADOR_A) {
        throw new AppError('Você não tem permissão para consultar este pedido.', 403);
      }
      const pedido: PedidoDetalhado = {
        id: PEDIDO_A_ID,
        codigoPedido: 'OR-20261123-AA1122',
        usuarioId: COMPRADOR_A,
        reservaGrupoId: RESERVA_GRUPO,
        status: 'PENDENTE_PAGAMENTO',
        metodoPagamento: 'PIX',
        valorTotalPecas: 100,
        valorTotalFrete: 20,
        valorTotalPedido: 120,
        enderecoEntrega: ENDERECO_VALIDO,
        fretesPorOrigem: [],
        itens: [],
        subpedidosGerados: false,
        reconciliacaoMotivo: null,
        criadoEm: new Date().toISOString(),
        pagoEm: null,
        canceladoEm: null,
        pagamentoAtual: null,
      };
      return pedido;
    },
    async marcarExpiracaoReservaExpirada() {
      throw new Error('Não esperado');
    },
    async expirarPedidosPendentesVencidos() {
      return { pedidosExpirados: 0, unidadesDevolvidas: 0 };
    },
    ...overrides,
  };
}

const mockAuthProvider: AuthIdentityProvider = {
  async verify(credentials) {
    if (credentials.bearerToken === 'tok_a') {
      return {
        status: 'AUTHENTICATED',
        identity: { userId: COMPRADOR_A, email: 'maria@origem.pe.br' },
      };
    }
    if (credentials.bearerToken === 'tok_b') {
      return {
        status: 'AUTHENTICATED',
        identity: { userId: COMPRADOR_B, email: 'outro@origem.pe.br' },
      };
    }
    return { status: 'UNAUTHENTICATED', reason: 'Token inválido.' };
  },
};

async function withServer(
  deps: {
    readonly freteProvider?: ConstructorParameters<typeof createCheckoutPagamentoService>[0] extends infer D
      ? D extends { readonly freteProvider?: infer F }
        ? F
        : never
      : never;
    readonly service: ReturnType<typeof createCheckoutPagamentoService>;
  },
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(
    '/api/v1/pedidos',
    createPedidoRoutes({ authProvider: mockAuthProvider, service: deps.service }),
  );
  app.use('/api/v1/pagamentos', createPagamentoRoutes({ service: deps.service }));
  app.use(errorHandler);

  let server: Server | undefined;
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const addr = server!.address() as { port: number };
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
}

describe('HU-10 — Rotas HTTP de Checkout, Pedidos e Webhooks (Contrato e Segurança)', () => {
  it('exige autenticação JWT (401) em /pedidos/* e isola titularidade (403) em GET /pedidos/:pedidoId', async () => {
    const service = createCheckoutPagamentoService({
      repository: createFakeRepo(),
      freteProvider: new UnconfiguredCotacaoFreteProvider(),
      paymentGateway: new UnconfiguredPaymentGateway(),
    });

    await withServer({ service }, async (base) => {
      const r1 = await fetch(`${base}/api/v1/pedidos/meus`);
      assert.equal(r1.status, 401);

      const r2 = await fetch(`${base}/api/v1/pedidos/cotar-frete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaGrupoId: RESERVA_GRUPO, cepDestino: '50010000' }),
      });
      assert.equal(r2.status, 401);

      const r3 = await fetch(`${base}/api/v1/pedidos/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(r3.status, 401);

      const r4 = await fetch(`${base}/api/v1/pedidos/${PEDIDO_A_ID}`, {
        headers: { Authorization: 'Bearer tok_b' },
      });
      assert.equal(r4.status, 403);

      const r5 = await fetch(`${base}/api/v1/pedidos/${PEDIDO_A_ID}`, {
        headers: { Authorization: 'Bearer tok_a' },
      });
      assert.equal(r5.status, 200);
    });
  });

  it('rejeita PAN/CVV (422), opera fail-closed sem provedores de frete/pagamento (503) e detecta conflito Idempotency-Key (409)', async () => {
    const repo = createFakeRepo({
      async buscarPorIdempotencyKey(_uid, key) {
        if (key === 'chave-duplicada') {
          return {
            payloadHash: '0'.repeat(64),
            pedido: await createFakeRepo().buscarPedidoUsuarioPorIdOuCodigo(COMPRADOR_A, {
              tipo: 'id',
              valor: PEDIDO_A_ID,
            }),
          };
        }
        return null;
      },
    });

    const serviceSemFrete = createCheckoutPagamentoService({
      repository: repo,
      freteProvider: new UnconfiguredCotacaoFreteProvider(),
      paymentGateway: new UnconfiguredPaymentGateway(),
    });

    await withServer({ service: serviceSemFrete }, async (base) => {
      // PAN/CVV bloqueado imediatamente
      const rPan = await fetch(`${base}/api/v1/pedidos/checkout`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok_a',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-pan-test',
        },
        body: JSON.stringify({
          reservaGrupoId: RESERVA_GRUPO,
          metodoPagamento: 'CARTAO_CREDITO',
          enderecoEntrega: ENDERECO_VALIDO,
          cartao: { token: 'tok_x', parcelas: 1, numeroCartao: '4111111111111111', cvv: '123' },
        }),
      });
      assert.equal(rPan.status, 422);
      const jPan = (await rPan.json()) as { codigo?: string };
      assert.equal(jPan.codigo, PAGAMENTO_ERROR_CODES.DADOS_SENSIVEIS_CARTAO_PROIBIDOS);

      // Frete fail-closed (503 PROVEDOR_FRETE_NAO_CONFIGURADO)
      const rFrete = await fetch(`${base}/api/v1/pedidos/cotar-frete`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok_a', 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaGrupoId: RESERVA_GRUPO, cepDestino: '50010000' }),
      });
      assert.equal(rFrete.status, 503);
      const jFrete = (await rFrete.json()) as { codigo?: string };
      assert.equal(jFrete.codigo, FRETE_ERROR_CODES.PROVEDOR_FRETE_NAO_CONFIGURADO);

      // Conflito Idempotency-Key (409)
      const rIdem = await fetch(`${base}/api/v1/pedidos/checkout`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok_a',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'chave-duplicada',
        },
        body: JSON.stringify({
          reservaGrupoId: RESERVA_GRUPO,
          metodoPagamento: 'PIX',
          enderecoEntrega: ENDERECO_VALIDO,
        }),
      });
      assert.equal(rIdem.status, 409);
      const jIdem = (await rIdem.json()) as { codigo?: string };
      assert.equal(jIdem.codigo, PAGAMENTO_ERROR_CODES.CONFLITO_IDEMPOTENCIA);
    });

    // Com frete ok, mas gateway de pagamento disabled -> 503 PROVEDOR_PAGAMENTO_NAO_CONFIGURADO
    const serviceSemGateway = createCheckoutPagamentoService({
      repository: createFakeRepo(),
      freteProvider: { async cotar() { return { valorBrl: 20, prazoEstimadoDias: 3 }; } },
      paymentGateway: new UnconfiguredPaymentGateway(),
    });

    await withServer({ service: serviceSemGateway }, async (base) => {
      const rPgto = await fetch(`${base}/api/v1/pedidos/checkout`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok_a',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-sem-pgto',
        },
        body: JSON.stringify({
          reservaGrupoId: RESERVA_GRUPO,
          metodoPagamento: 'PIX',
          enderecoEntrega: ENDERECO_VALIDO,
        }),
      });
      assert.equal(rPgto.status, 503);
      const jPgto = (await rPgto.json()) as { codigo?: string };
      assert.equal(jPgto.codigo, PAGAMENTO_ERROR_CODES.PROVEDOR_PAGAMENTO_NAO_CONFIGURADO);
    });
  });

  it('rejeita webhook com assinatura HMAC inválida (401) na rota pública de pagamentos', async () => {
    const gw = new HttpSandboxPaymentGateway({
      endpoint: 'http://127.0.0.1:1/inexistente',
      webhookSecret: 'segredo-real',
      ambiente: 'sandbox',
      timeoutMs: 1000,
    });
    const service = createCheckoutPagamentoService({
      repository: createFakeRepo(),
      freteProvider: { async cotar() { return { valorBrl: 15, prazoEstimadoDias: 2 }; } },
      paymentGateway: gw,
    });

    await withServer({ service }, async (base) => {
      const payload = JSON.stringify({
        eventoExternoId: 'evt-1',
        tipoEvento: 'payment.paid',
        externalPaymentId: 'ext-1',
      });
      const wrongSig = crypto.createHmac('sha256', 'segredo-errado').update(payload).digest('hex');

      const res = await fetch(`${base}/api/v1/pagamentos/webhook/http_sandbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-origem-signature': `sha256=${wrongSig}`,
        },
        body: payload,
      });
      assert.equal(res.status, 401);
      const json = (await res.json()) as { codigo?: string };
      assert.equal(json.codigo, PAGAMENTO_ERROR_CODES.WEBHOOK_ASSINATURA_INVALIDA);
    });
  });
});
