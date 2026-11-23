/**
 * Integração REAL completa da HU-10 contra PostgreSQL/Supabase + Redis/BullMQ (HU-17) +
 * Express HTTP real + Reservas HU-06 + Provedores HTTP controlados (Gateway & Frete).
 *
 * Todos os cenários (`BDD 1`, `BDD 2`, `BDD 3`, `TC09`) são 100% independentes entre si
 * (podem ser executados isoladamente via `--test-name-pattern`) e contam com timeouts explícitos
 * e limpeza completa em bloco `after()`, sem depender de ordem de execução nem travar em falhas do Redis.
 */
import assert from 'node:assert/strict';
import crypto, { randomUUID } from 'node:crypto';
import http, { type Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { Queue } from 'bullmq';
import express, { type Request } from 'express';
import {
  createBullMqQueueConnectionOptions,
  pingRedis,
} from '../../src/cache/redis.client.js';
import { prisma } from '../../src/config/database.js';
import { HttpEmailProvider } from '../../src/integrations/email.provider.js';
import { HttpCotacaoFreteProvider } from '../../src/integrations/frete.provider.js';
import { HttpSandboxPaymentGateway } from '../../src/integrations/httpSandbox.gateway.js';
import { PAGAMENTO_ERROR_CODES } from '../../src/integrations/paymentGateway.contracts.js';
import { HttpWhatsAppProvider } from '../../src/integrations/whatsapp.provider.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import {
  createNotificationProducer,
  type NotificationJobData,
} from '../../src/queues/notification.queue.js';
import { createNotificationWorker } from '../../src/queues/notification.worker.js';
import { prismaNotificacaoLogRepository } from '../../src/repositories/prismaNotificacaoLog.repository.js';
import { prismaNotificacaoOutboxRepository } from '../../src/repositories/prismaNotificacaoOutbox.repository.js';
import { createEstoqueRoutes } from '../../src/routes/estoque.routes.js';
import { createPagamentoRoutes } from '../../src/routes/pagamento.routes.js';
import { createPedidoRoutes } from '../../src/routes/pedido.routes.js';
import { createCheckoutPagamentoService } from '../../src/services/checkoutPagamento.service.js';
import { createNotificacaoEventosService } from '../../src/services/notificacaoEventos.service.js';
import { createNotificacaoOutboxRelay } from '../../src/services/notificacaoOutbox.relay.js';
import { jwtAuthIdentityProvider, sessionTokenService } from '../../src/utils/authToken.util.js';

const habilitado = process.env.RUN_HU10_INTEGRATION === '1';

async function esperarCondicao(
  condicao: () => Promise<boolean>,
  timeoutMs = 15_000,
  intervaloMs = 150,
): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    if (await condicao()) return;
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new Error(`Condição assíncrona não satisfeita em ${timeoutMs} ms.`);
}

async function comTimeout<T>(promessa: Promise<T>, ms: number, rotulo: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promessa.finally(() => {
        if (timer) clearTimeout(timer);
      }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[HU-10 test cleanup] Timeout após ${ms}ms em: ${rotulo}`);
          resolve(null);
        }, ms);
        timer.unref?.();
      }),
    ]);
  } catch {
    return null;
  }
}

async function fecharServidorHttpRapido(server: Server | undefined, rotulo: string): Promise<void> {
  if (!server) return;
  server.closeAllConnections?.();
  await comTimeout(
    new Promise<void>((resolve) => server.close(() => resolve())),
    2500,
    rotulo,
  );
}

describe(
  'HU-10 — Checkout Unificado, Webhooks Idempotentes, HU-06 e HU-17 (Infra Real)',
  { skip: !habilitado, timeout: 120_000 },
  () => {
    const queueName = `hu10_bdd_${randomUUID().slice(0, 8)}`;
    const prefix = 'origem_hu10_test';
    const webhookSecret = 'wh_sec_hu10_integracao_2026';

    const usuariosCriadosIds: string[] = [];
    const artesaosCriadosIds: string[] = [];
    const ateliesCriadosIds: string[] = [];
    const pecasCriadasIds: string[] = [];

    let externalServer: Server | undefined;
    let externalBaseUrl = '';
    let apiServer: Server | undefined;
    let apiBaseUrl = '';

    let queue: Queue<NotificationJobData> | undefined;
    let workerHandle: ReturnType<typeof createNotificationWorker> | undefined;
    let producer: ReturnType<typeof createNotificationProducer> | undefined;

    let buyerToken = '';
    let atelie1Id = '';
    let atelie2Id = '';
    let peca1Id = '';
    let peca2Id = '';
    let pecaExpiradaId = '';
    let pecaRecusaId = '';
    let pecaTc09Id = '';

    interface GatewayRecord {
      externalPaymentId: string;
      pedidoId?: string;
      status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
      gatewayStatusRaw: string;
      erroSanitizado?: string;
      expiresInSeconds?: number;
      cartaoBandeira?: string;
      cartaoUltimosDigitos?: string;
    }
    const gatewayStore = new Map<string, GatewayRecord>();
    let pixCreationCount = 0;
    let cardCreationCount = 0;

    const freteChamadas: Array<{ cepOrigem: string; cepDestino: string; pesoGramas: number }> = [];
    const emailsRecebidos: Array<{ to: string; subject: string; idempotencyKey: string }> = [];
    const whatsappsRecebidos: Array<{ to: string; idempotencyKey: string }> = [];

    const enderecoValido = {
      nomeDestinatario: 'Maria Compradora HU10',
      email: 'maria.hu10@origem.test',
      telefone: '81998887777',
      cep: '50010000',
      logradouro: 'Rua da Aurora',
      numero: '450',
      complemento: 'Sala 3',
      bairro: 'Boa Vista',
      cidade: 'Recife',
      uf: 'PE',
    };

    function assinarWebhook(bodyObj: unknown): { rawBody: string; signature: string } {
      const rawBody = JSON.stringify(bodyObj);
      const hmac = crypto.createHmac('sha256', webhookSecret).update(rawBody, 'utf8').digest('hex');
      return { rawBody, signature: `sha256=${hmac}` };
    }

    async function postJson(
      pathUrl: string,
      body: unknown,
      headers: Record<string, string> = {},
    ): Promise<{ status: number; json: Record<string, unknown> }> {
      const res = await fetch(`${apiBaseUrl}${pathUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json()) as Record<string, unknown>;
      return { status: res.status, json };
    }

    async function getJson(
      pathUrl: string,
      headers: Record<string, string> = {},
    ): Promise<{ status: number; json: Record<string, unknown> }> {
      const res = await fetch(`${apiBaseUrl}${pathUrl}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json()) as Record<string, unknown>;
      return { status: res.status, json };
    }

    async function enviarWebhookAssinado(payload: unknown): Promise<{
      status: number;
      json: Record<string, unknown>;
    }> {
      const signed = assinarWebhook(payload);
      const res = await fetch(`${apiBaseUrl}/api/v1/pagamentos/webhook/http_sandbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-origem-signature': signed.signature,
        },
        body: signed.rawBody,
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json()) as Record<string, unknown>;
      return { status: res.status, json };
    }

    before(async () => {
      const redisOk = await pingRedis();
      assert.equal(redisOk, true, 'Redis real deve estar ativo (WSL2 Ubuntu) para testar HU-10 + HU-17.');

      // 1) Servidor HTTP controlado (Gateway sandbox + Frete multi-origem + Notificações HU-17)
      externalServer = http.createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body =
          chunks.length > 0
            ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>)
            : {};

        if (req.url === '/frete/cotar' && req.method === 'POST') {
          const cepOrigem = String(body.cepOrigem ?? '');
          const cepDestino = String(body.cepDestino ?? '');
          const cubagem = (body.cubagem ?? {}) as { pesoGramas?: number };
          freteChamadas.push({
            cepOrigem,
            cepDestino,
            pesoGramas: Number(cubagem.pesoGramas ?? 0),
          });
          const valorBrl = cepOrigem === '55002000' ? 21.5 : 14.25;
          const prazoEstimadoDias = cepOrigem === '55002000' ? 3 : 2;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valorBrl, prazoEstimadoDias }));
          return;
        }

        if (req.url === '/gateway/pix' && req.method === 'POST') {
          pixCreationCount += 1;
          const extId = `pix_ext_${pixCreationCount}_${randomUUID().slice(0, 6)}`;
          const expiresInSeconds = Number(body.expiresInSeconds ?? 0);
          gatewayStore.set(extId, {
            externalPaymentId: extId,
            status: 'PENDENTE',
            gatewayStatusRaw: 'waiting_payment',
            expiresInSeconds,
          });
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              externalPaymentId: extId,
              status: 'PENDENTE',
              gatewayStatusRaw: 'waiting_payment',
              pixCopiaECola: `00020101021226850014br.gov.bcb.pix2563${extId}`,
              pixQrCodeBase64:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
              pixTicketUrl: `${externalBaseUrl}/qrcode/${extId}`,
              gatewayExpiraEm: body.expiraEm,
            }),
          );
          return;
        }

        if (req.url === '/gateway/card' && req.method === 'POST') {
          cardCreationCount += 1;
          const token = String(body.cardToken ?? '');
          const extId = `card_ext_${cardCreationCount}_${randomUUID().slice(0, 6)}`;

          if (token === 'tok_timeout') {
            const timer = setTimeout(() => {
              if (!res.writableEnded) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ externalPaymentId: extId, status: 'APROVADO' }));
              }
            }, 350);
            timer.unref?.();
            // Mesmo com timeout na resposta HTTP, registra no gateway para reconciliação posterior
            gatewayStore.set(extId, {
              externalPaymentId: extId,
              pedidoId: typeof body.pedidoId === 'string' ? body.pedidoId : undefined,
              status: 'APROVADO',
              gatewayStatusRaw: 'paid',
              cartaoBandeira: 'Visa',
              cartaoUltimosDigitos: '4242',
            });
            return;
          }

          if (token === 'tok_recusar_sync') {
            gatewayStore.set(extId, {
              externalPaymentId: extId,
              status: 'RECUSADO',
              gatewayStatusRaw: 'not_authorized',
              erroSanitizado: 'Transação não autorizada pelo emissor.',
              cartaoBandeira: 'Mastercard',
              cartaoUltimosDigitos: '1111',
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(gatewayStore.get(extId)));
            return;
          }

          if (token === 'tok_pendente_webhook') {
            gatewayStore.set(extId, {
              externalPaymentId: extId,
              status: 'PENDENTE',
              gatewayStatusRaw: 'processing',
              cartaoBandeira: 'Visa',
              cartaoUltimosDigitos: '8888',
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(gatewayStore.get(extId)));
            return;
          }

          gatewayStore.set(extId, {
            externalPaymentId: extId,
            status: 'APROVADO',
            gatewayStatusRaw: 'paid',
            cartaoBandeira: 'Visa',
            cartaoUltimosDigitos: '4242',
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(gatewayStore.get(extId)));
          return;
        }

        if (req.url?.startsWith('/gateway/payments/') && req.method === 'GET') {
          const id = decodeURIComponent(req.url.replace('/gateway/payments/', ''));
          const record = gatewayStore.get(id);
          if (!record) {
            res.writeHead(404).end();
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(record));
          return;
        }

        if (req.url === '/notify/email' && req.method === 'POST') {
          emailsRecebidos.push({
            to: String(body.to ?? ''),
            subject: String(body.subject ?? ''),
            idempotencyKey: String(body.idempotencyKey ?? ''),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ messageId: `email-${emailsRecebidos.length}` }));
          return;
        }

        if (req.url === '/notify/whatsapp' && req.method === 'POST') {
          whatsappsRecebidos.push({
            to: String(body.to ?? ''),
            idempotencyKey: String(body.idempotencyKey ?? ''),
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ messageId: `wa-${whatsappsRecebidos.length}` }));
          return;
        }

        res.writeHead(404).end();
      });

      await new Promise<void>((resolve) => {
        externalServer!.listen(0, '127.0.0.1', () => {
          const addr = externalServer!.address() as { port: number };
          externalBaseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });

      // 2) Massa isolada no PostgreSQL Supabase
      const sufixo = randomUUID().slice(0, 8);
      const uBuyer = await prisma.usuario.create({
        data: {
          nome: 'Maria Compradora HU10',
          email: `compradora.hu10.${sufixo}@origem.test`,
          cpfCnpj: `710${Math.floor(10_000_000 + Math.random() * 89_000_000)}`,
          telefoneWhatsapp: '81998887777',
          senhaHash: 'hash_hu10',
        },
      });
      const uArt1 = await prisma.usuario.create({
        data: {
          nome: 'Mestre Caruaru HU10',
          email: `art1.hu10.${sufixo}@origem.test`,
          cpfCnpj: `720${Math.floor(10_000_000 + Math.random() * 89_000_000)}`,
          telefoneWhatsapp: '81997776666',
          senhaHash: 'hash_hu10',
        },
      });
      const uArt2 = await prisma.usuario.create({
        data: {
          nome: 'Mestra Olinda HU10',
          email: `art2.hu10.${sufixo}@origem.test`,
          cpfCnpj: `730${Math.floor(10_000_000 + Math.random() * 89_000_000)}`,
          telefoneWhatsapp: '81996665555',
          senhaHash: 'hash_hu10',
        },
      });
      usuariosCriadosIds.push(uBuyer.id, uArt1.id, uArt2.id);

      buyerToken = await sessionTokenService.issue({
        id: uBuyer.id,
        email: uBuyer.email,
        nome: uBuyer.nome,
        senhaHash: uBuyer.senhaHash,
        status: uBuyer.status,
        papeis: ['COMPRADOR'],
      });

      const art1 = await prisma.artesao.create({
        data: {
          usuarioId: uArt1.id,
          biografiaCultural: 'Cerâmica figurativa Caruaru.',
          tipoChavePix: 'EVP',
          chavePixCriptografada: 'enc-hu10-1',
        },
      });
      const art2 = await prisma.artesao.create({
        data: {
          usuarioId: uArt2.id,
          biografiaCultural: 'Renda renascença Olinda.',
          tipoChavePix: 'EVP',
          chavePixCriptografada: 'enc-hu10-2',
        },
      });
      artesaosCriadosIds.push(art1.id, art2.id);

      const atl1 = await prisma.atelie.create({
        data: {
          artesaoId: art1.id,
          nomeComercial: 'Barro Caruaru HU10',
          poloCultural: 'Caruaru',
        },
      });
      const atl2 = await prisma.atelie.create({
        data: {
          artesaoId: art2.id,
          nomeComercial: 'Rendas Olinda HU10',
          poloCultural: 'Olinda',
        },
      });
      atelie1Id = atl1.id;
      atelie2Id = atl2.id;
      ateliesCriadosIds.push(atl1.id, atl2.id);

      await prisma.endereco.createMany({
        data: [
          {
            cep: '55002000',
            logradouro: 'Rua Mestre Vitalino',
            numero: '10',
            bairro: 'Alto do Moura',
            cidade: 'Caruaru',
            uf: 'PE',
            atelieId: atl1.id,
          },
          {
            cep: '53020000',
            logradouro: 'Rua do Amparo',
            numero: '55',
            bairro: 'Carmo',
            cidade: 'Olinda',
            uf: 'PE',
            atelieId: atl2.id,
          },
        ],
      });

      const p1 = await prisma.peca.create({
        data: {
          atelieId: atl1.id,
          titulo: 'Boi de Barro Pintado',
          descricao: 'Peça artesanal de Caruaru para integração HU-10.',
          tipologia: 'Cerâmica',
          preco: '120.00',
          pesoGramas: 900,
          comprimentoCm: 25,
          larguraCm: 18,
          alturaCm: 22,
          isFragil: true,
          quantidadeEstoque: 10,
          status: 'DISPONIVEL',
        },
      });
      const p2 = await prisma.peca.create({
        data: {
          atelieId: atl2.id,
          titulo: 'Centro de Mesa Renascença',
          descricao: 'Peça artesanal de Olinda para integração HU-10.',
          tipologia: 'Têxtil',
          preco: '80.00',
          pesoGramas: 350,
          comprimentoCm: 30,
          larguraCm: 25,
          alturaCm: 6,
          isFragil: false,
          quantidadeEstoque: 10,
          status: 'DISPONIVEL',
        },
      });
      const pExp = await prisma.peca.create({
        data: {
          atelieId: atl1.id,
          titulo: 'Pote Miniatura Expiração',
          descricao: 'Peça dedicada ao cenário de reserva vencida no BDD 1.',
          tipologia: 'Cerâmica',
          preco: '45.00',
          pesoGramas: 400,
          comprimentoCm: 15,
          larguraCm: 15,
          alturaCm: 15,
          isFragil: false,
          quantidadeEstoque: 5,
          status: 'DISPONIVEL',
        },
      });
      const pRec = await prisma.peca.create({
        data: {
          atelieId: atl1.id,
          titulo: 'Quartinha de Barro',
          descricao: 'Peça dedicada aos cenários de recusa no BDD 3.',
          tipologia: 'Cerâmica',
          preco: '50.00',
          pesoGramas: 600,
          comprimentoCm: 18,
          larguraCm: 15,
          alturaCm: 20,
          isFragil: true,
          quantidadeEstoque: 5,
          status: 'DISPONIVEL',
        },
      });
      const pTc09 = await prisma.peca.create({
        data: {
          atelieId: atl2.id,
          titulo: 'Xale de Renda Filé',
          descricao: 'Peça dedicada aos cenários de segurança e reconciliação no TC09.',
          tipologia: 'Têxtil',
          preco: '90.00',
          pesoGramas: 300,
          comprimentoCm: 22,
          larguraCm: 18,
          alturaCm: 6,
          isFragil: false,
          quantidadeEstoque: 5,
          status: 'DISPONIVEL',
        },
      });
      peca1Id = p1.id;
      peca2Id = p2.id;
      pecaExpiradaId = pExp.id;
      pecaRecusaId = pRec.id;
      pecaTc09Id = pTc09.id;
      pecasCriadasIds.push(p1.id, p2.id, pExp.id, pRec.id, pTc09.id);

      // 3) Inicializar Fila + Worker BullMQ reais (HU-17) + OutboxRelay
      queue = new Queue<NotificationJobData>(queueName, {
        connection: createBullMqQueueConnectionOptions(),
        prefix,
      });
      queue.on('error', () => {
        // EvitaUnhandledError caso Redis oscile ao encerrar
      });

      producer = createNotificationProducer({
        queue,
        logRepository: prismaNotificacaoLogRepository,
        policy: { queueName, prefix, attempts: 3, backoffInitialMs: 500, concurrency: 4 },
      });

      workerHandle = createNotificationWorker({
        emailProvider: new HttpEmailProvider({
          endpoint: `${externalBaseUrl}/notify/email`,
          from: 'Origem <noreply@origem.local>',
          timeoutMs: 2000,
        }),
        whatsappProvider: new HttpWhatsAppProvider({
          endpoint: `${externalBaseUrl}/notify/whatsapp`,
          defaultLanguage: 'pt_BR',
          timeoutMs: 2000,
        }),
        logRepository: prismaNotificacaoLogRepository,
        policy: { queueName, prefix, attempts: 3, backoffInitialMs: 500, concurrency: 4 },
        logger: () => {},
      });

      const eventosService = createNotificacaoEventosService({
        producer,
        logRepository: prismaNotificacaoLogRepository,
      });

      const outboxRelay = createNotificacaoOutboxRelay({
        outboxRepository: prismaNotificacaoOutboxRepository,
        eventosService,
      });

      const freteProvider = new HttpCotacaoFreteProvider({
        endpoint: `${externalBaseUrl}/frete/cotar`,
        timeoutMs: 3000,
      });

      const gateway = new HttpSandboxPaymentGateway({
        endpoint: `${externalBaseUrl}/gateway`,
        webhookSecret,
        ambiente: 'sandbox',
        timeoutMs: 150,
      });

      const checkoutService = createCheckoutPagamentoService({
        freteProvider,
        paymentGateway: gateway,
        outboxRelay,
      });

      // 4) Express app isolado com rotas reais
      const testApp = express();
      testApp.use(
        express.json({
          verify: (req, _res, buf) => {
            (req as Request).rawBody = Buffer.from(buf);
          },
        }),
      );
      testApp.use('/api/v1/estoque', createEstoqueRoutes({ authProvider: jwtAuthIdentityProvider }));
      testApp.use(
        '/api/v1/pedidos',
        createPedidoRoutes({ authProvider: jwtAuthIdentityProvider, service: checkoutService }),
      );
      testApp.use('/api/v1/pagamentos', createPagamentoRoutes({ service: checkoutService }));
      testApp.use(errorHandler);

      await new Promise<void>((resolve) => {
        apiServer = testApp.listen(0, '127.0.0.1', () => {
          const addr = apiServer!.address() as { port: number };
          apiBaseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    }, 30_000);

    after(async () => {
      await fecharServidorHttpRapido(apiServer, 'apiServer');
      if (workerHandle) {
        await workerHandle.close(true, 3000).catch(() => {});
      }
      if (queue) {
        await comTimeout(queue.obliterate({ force: true }), 2000, 'queue.obliterate');
        await comTimeout(queue.close(), 2000, 'queue.close');
      }
      await fecharServidorHttpRapido(externalServer, 'externalServer');

      try {
        if (usuariosCriadosIds.length > 0) {
          const pedidosUsuario = await prisma.pedido.findMany({
            where: { usuarioId: { in: usuariosCriadosIds } },
            select: { id: true },
          });
          const pedidosIds = pedidosUsuario.map((p) => p.id);

          if (pedidosIds.length > 0) {
            const pagamentosUsuario = await prisma.pagamento.findMany({
              where: { pedidoId: { in: pedidosIds } },
              select: { id: true },
            });
            const pagamentosIds = pagamentosUsuario.map((pg) => pg.id);

            if (pagamentosIds.length > 0) {
              await prisma.webhookPagamento.deleteMany({
                where: { pagamentoId: { in: pagamentosIds } },
              });
            }
            await prisma.outboxEventoNotificacao.deleteMany({
              where: { aggregateId: { in: pedidosIds } },
            });
            await prisma.$executeRaw`
              DELETE FROM "logs_notificacoes" WHERE "pedido_id" = ANY(${pedidosIds}::uuid[])
            `;
            await prisma.pagamento.deleteMany({ where: { pedidoId: { in: pedidosIds } } });
            await prisma.pedido.deleteMany({ where: { id: { in: pedidosIds } } });
          }

          await prisma.$executeRaw`
            DELETE FROM "logs_notificacoes" WHERE "usuario_id" = ANY(${usuariosCriadosIds}::uuid[])
          `;
          await prisma.reserva.deleteMany({ where: { usuarioId: { in: usuariosCriadosIds } } });
          await prisma.reservaGrupo.deleteMany({ where: { usuarioId: { in: usuariosCriadosIds } } });
        }

        if (pecasCriadasIds.length > 0) {
          await prisma.peca.deleteMany({ where: { id: { in: pecasCriadasIds } } });
        }
        if (ateliesCriadosIds.length > 0) {
          await prisma.endereco.deleteMany({ where: { atelieId: { in: ateliesCriadosIds } } });
          await prisma.$executeRaw`
            DELETE FROM "logs_notificacoes" WHERE "atelie_id" = ANY(${ateliesCriadosIds}::uuid[])
          `;
          await prisma.atelie.deleteMany({ where: { id: { in: ateliesCriadosIds } } });
        }
        if (artesaosCriadosIds.length > 0) {
          await prisma.artesao.deleteMany({ where: { id: { in: artesaosCriadosIds } } });
        }
        if (usuariosCriadosIds.length > 0) {
          await prisma.usuario.deleteMany({ where: { id: { in: usuariosCriadosIds } } });
        }
      } finally {
        await comTimeout(prisma.$disconnect(), 2500, 'prisma.$disconnect');
      }
    }, 30_000);

    it(
      'BDD 1: gera Pix dinâmico com expiração fracionária alinhada à reserva, calcula frete multi-origem e bloqueia reserva expirada',
      { timeout: 45_000 },
      async () => {
        const resReserva = await postJson(
          '/api/v1/estoque/reservas',
          {
            lines: [
              { productId: peca1Id, quantity: 1 }, // Caruaru: R$ 120,00
              { productId: peca2Id, quantity: 2 }, // Olinda: 2 x R$ 80,00 = R$ 160,00
            ],
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `res-bdd1-${randomUUID()}` },
        );
        assert.equal(resReserva.status, 201);
        const reservaGrupoId = String(resReserva.json.grupoId);

        // Ajusta expiração fracionária (~500s restantes) garantindo criadoEm < expiraEm
        const agora = Date.now();
        await prisma.reserva.updateMany({
          where: { grupoId: reservaGrupoId },
          data: {
            criadoEm: new Date(agora - 400_000),
            expiraEm: new Date(agora + 500_000),
          },
        });

        const cotacao = await postJson(
          '/api/v1/pedidos/cotar-frete',
          { reservaGrupoId, cepDestino: '50010-000' },
          { Authorization: `Bearer ${buyerToken}` },
        );
        assert.equal(cotacao.status, 200);
        assert.equal(cotacao.json.valorTotalPecas, 280);
        assert.equal(cotacao.json.valorTotalFrete, 35.75); // 21.50 (Caruaru) + 14.25 (Olinda)
        assert.equal(cotacao.json.valorTotalPedido, 315.75);
        assert.equal((cotacao.json.fretesPorOrigem as unknown[]).length, 2);

        const chaveCheckout = `chk-bdd1-${randomUUID()}`;
        const checkout = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId,
            metodoPagamento: 'PIX',
            enderecoEntrega: enderecoValido,
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': chaveCheckout },
        );

        assert.equal(checkout.status, 201);
        assert.equal(checkout.json.idempotente, false);
        const pedido = checkout.json.pedido as {
          id: string;
          status: string;
          valorTotalPedido: number;
          pagamentoAtual: {
            externalPaymentId: string;
            ambiente: string;
            pixCopiaECola: string;
          };
        };

        assert.equal(pedido.status, 'PENDENTE_PAGAMENTO');
        assert.equal(pedido.valorTotalPedido, 315.75);
        assert.equal(pedido.pagamentoAtual.ambiente, 'sandbox');
        assert.ok(pedido.pagamentoAtual.pixCopiaECola.includes(pedido.pagamentoAtual.externalPaymentId));

        const gwRecord = gatewayStore.get(pedido.pagamentoAtual.externalPaymentId);
        assert.ok(gwRecord && gwRecord.expiresInSeconds !== undefined);
        assert.ok(
          gwRecord.expiresInSeconds >= 485 && gwRecord.expiresInSeconds <= 501,
          `expiresInSeconds esperado ~500s, obtido ${gwRecord.expiresInSeconds}s`,
        );

        // Idempotência do checkout com mesma Idempotency-Key
        const countAntes = pixCreationCount;
        const replay = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId,
            metodoPagamento: 'PIX',
            enderecoEntrega: enderecoValido,
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': chaveCheckout },
        );
        assert.equal(replay.status, 200);
        assert.equal(replay.json.idempotente, true);
        assert.equal(pixCreationCount, countAntes);

        // Reserva vencida bloqueia criação de cobrança Pix e satisfaz reservas_expira_em_check
        const resExpirada = await postJson(
          '/api/v1/estoque/reservas',
          { lines: [{ productId: pecaExpiradaId, quantity: 1 }] },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `res-exp-${randomUUID()}` },
        );
        assert.equal(resExpirada.status, 201);
        const grupoExpId = String(resExpirada.json.grupoId);
        await prisma.reserva.updateMany({
          where: { grupoId: grupoExpId },
          data: {
            criadoEm: new Date(Date.now() - 20 * 60_000),
            expiraEm: new Date(Date.now() - 10_000),
          },
        });

        const checkoutExp = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId: grupoExpId,
            metodoPagamento: 'PIX',
            enderecoEntrega: enderecoValido,
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `chk-exp-${randomUUID()}` },
        );
        assert.equal(checkoutExp.status, 409);
        assert.equal(pixCreationCount, countAntes);

        const pExpDb = await prisma.peca.findUniqueOrThrow({ where: { id: pecaExpiradaId } });
        assert.equal(pExpDb.quantidadeEstoque, 5);
      },
    );

    it(
      'BDD 2: processa eventos distintos do mesmo pagamento, deduplica webhooks simultâneos, confirma HU-06 e entrega HU-17 sem duplicar nem regredir',
      { timeout: 45_000 },
      async () => {
        const resReserva = await postJson(
          '/api/v1/estoque/reservas',
          {
            lines: [
              { productId: peca1Id, quantity: 1 },
              { productId: peca2Id, quantity: 1 },
            ],
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `res-bdd2-${randomUUID()}` },
        );
        assert.equal(resReserva.status, 201);
        const grupoBdd2Id = String(resReserva.json.grupoId);

        const peca1Antes = (await prisma.peca.findUniqueOrThrow({ where: { id: peca1Id } }))
          .quantidadeEstoque;

        const chkBdd2 = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId: grupoBdd2Id,
            metodoPagamento: 'PIX',
            enderecoEntrega: enderecoValido,
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `chk-bdd2-${randomUUID()}` },
        );
        assert.equal(chkBdd2.status, 201);
        const pedidoBdd2 = chkBdd2.json.pedido as {
          id: string;
          pagamentoAtual: { externalPaymentId: string };
        };
        const extPixId = pedidoBdd2.pagamentoAtual.externalPaymentId;

        // 1) Evento intermediário antes da aprovação
        const resPending = await enviarWebhookAssinado({
          eventoExternoId: `evt-pending-${randomUUID()}`,
          tipoEvento: 'payment.pending',
          externalPaymentId: extPixId,
          status: 'PENDENTE',
          metadata: { pedidoId: pedidoBdd2.id },
        });
        assert.equal(resPending.status, 200);

        // 2) Disparo simultâneo (5x Promise.all) do webhook de aprovação
        const gw = gatewayStore.get(extPixId)!;
        gw.status = 'APROVADO';
        gw.gatewayStatusRaw = 'paid';

        const evtPaidPayload = {
          eventoExternoId: `evt-paid-${randomUUID()}`,
          tipoEvento: 'payment.paid',
          externalPaymentId: extPixId,
          status: 'APROVADO',
          metadata: { pedidoId: pedidoBdd2.id },
        };

        const respostas = await Promise.all(
          Array.from({ length: 5 }, () => enviarWebhookAssinado(evtPaidPayload)),
        );
        for (const r of respostas) assert.equal(r.status, 200);
        assert.equal(respostas.filter((r) => r.json.duplicado === false).length, 1);
        assert.equal(respostas.filter((r) => r.json.duplicado === true).length, 4);

        const pedidoDb = await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoBdd2.id } });
        assert.equal(pedidoDb.status, 'APROVADO');
        assert.ok(pedidoDb.pagoEm);

        const reservasDb = await prisma.reserva.findMany({ where: { grupoId: grupoBdd2Id } });
        assert.ok(reservasDb.every((r) => r.status === 'CONFIRMADA'));

        const webhooksDb = await prisma.webhookPagamento.findMany({
          where: { pagamento: { pedidoId: pedidoBdd2.id } },
        });
        assert.equal(webhooksDb.length, 2);

        // Aguarda Outbox ser publicado e processado pelo Worker BullMQ real (5 notificações únicas)
        await esperarCondicao(async () => {
          const outbox = await prisma.outboxEventoNotificacao.findFirst({
            where: { aggregateId: pedidoBdd2.id },
          });
          const enviados = await prisma.logNotificacao.count({
            where: { pedidoId: pedidoBdd2.id, status: 'ENVIADA' },
          });
          return outbox?.status === 'PUBLICADO' && enviados === 5;
        }, 15_000);

        const logsPedido = await prisma.logNotificacao.findMany({
          where: { pedidoId: pedidoBdd2.id },
        });
        assert.equal(logsPedido.length, 5);
        assert.ok(logsPedido.every((l) => l.status === 'ENVIADA'));

        // Proteção anti-regressão após APROVADO
        gw.status = 'RECUSADO';
        gw.gatewayStatusRaw = 'failed';
        const resLateFail = await enviarWebhookAssinado({
          eventoExternoId: `evt-late-fail-${randomUUID()}`,
          tipoEvento: 'payment.failed',
          externalPaymentId: extPixId,
          status: 'RECUSADO',
          metadata: { pedidoId: pedidoBdd2.id },
        });
        assert.equal(resLateFail.status, 200);
        assert.equal(resLateFail.json.statusPedidoFinal, 'APROVADO');
        assert.equal(resLateFail.json.acao, 'IGNORADO_PROTECAO_ANTI_REGRESSAO');

        const peca1Depois = (await prisma.peca.findUniqueOrThrow({ where: { id: peca1Id } }))
          .quantidadeEstoque;
        assert.equal(peca1Depois, peca1Antes);
      },
    );

    it(
      'BDD 3: recusa cartão tokenizado (síncrona e via webhook) cancelando reserva HU-06 e devolvendo saldo exatamente 1 vez',
      { timeout: 45_000 },
      async () => {
        const res1 = await postJson(
          '/api/v1/estoque/reservas',
          { lines: [{ productId: pecaRecusaId, quantity: 2 }] },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `res-rec1-${randomUUID()}` },
        );
        assert.equal(res1.status, 201);
        const grupo1 = String(res1.json.grupoId);

        const pecaAntesRecusa = await prisma.peca.findUniqueOrThrow({ where: { id: pecaRecusaId } });
        assert.equal(pecaAntesRecusa.quantidadeEstoque, 3);

        const chkRecSync = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId: grupo1,
            metodoPagamento: 'CARTAO_CREDITO',
            enderecoEntrega: enderecoValido,
            cartao: { token: 'tok_recusar_sync', parcelas: 2, ultimosDigitos: '1111' },
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `chk-rec1-${randomUUID()}` },
        );
        assert.equal(chkRecSync.status, 201);
        const pedido1 = chkRecSync.json.pedido as {
          id: string;
          status: string;
          pagamentoAtual: { status: string; cartaoUltimosDigitos: string | null };
        };
        assert.equal(pedido1.status, 'RECUSADO');
        assert.equal(pedido1.pagamentoAtual.status, 'RECUSADO');
        assert.equal(pedido1.pagamentoAtual.cartaoUltimosDigitos, '1111');

        const pecaAposRecSync = await prisma.peca.findUniqueOrThrow({ where: { id: pecaRecusaId } });
        assert.equal(pecaAposRecSync.quantidadeEstoque, 5);

        const reservas1 = await prisma.reserva.findMany({ where: { grupoId: grupo1 } });
        assert.equal(reservas1[0]?.status, 'CANCELADA');

        // Recusa assíncrona via webhook + duplicado sem devolução em dobro
        const res2 = await postJson(
          '/api/v1/estoque/reservas',
          { lines: [{ productId: pecaRecusaId, quantity: 2 }] },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `res-rec2-${randomUUID()}` },
        );
        assert.equal(res2.status, 201);
        const grupo2 = String(res2.json.grupoId);

        const chkRecAsync = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId: grupo2,
            metodoPagamento: 'CARTAO_CREDITO',
            enderecoEntrega: enderecoValido,
            cartao: { token: 'tok_pendente_webhook', parcelas: 1, ultimosDigitos: '8888' },
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `chk-rec2-${randomUUID()}` },
        );
        assert.equal(chkRecAsync.status, 201);
        const pedido2 = chkRecAsync.json.pedido as {
          id: string;
          status: string;
          pagamentoAtual: { externalPaymentId: string };
        };
        assert.equal(pedido2.status, 'PENDENTE_PAGAMENTO');

        const extId2 = pedido2.pagamentoAtual.externalPaymentId;
        gatewayStore.get(extId2)!.status = 'RECUSADO';
        gatewayStore.get(extId2)!.erroSanitizado = 'Cartão bloqueado.';

        const payloadFail = {
          eventoExternoId: `evt-card-fail-${randomUUID()}`,
          tipoEvento: 'payment.failed',
          externalPaymentId: extId2,
          status: 'RECUSADO',
          metadata: { pedidoId: pedido2.id },
        };

        const rWh1 = await enviarWebhookAssinado(payloadFail);
        const rWh2 = await enviarWebhookAssinado(payloadFail);
        assert.equal(rWh1.status, 200);
        assert.equal(rWh2.status, 200);
        assert.equal(rWh2.json.duplicado, true);

        const pecaAposRecAsync = await prisma.peca.findUniqueOrThrow({
          where: { id: pecaRecusaId },
        });
        assert.equal(pecaAposRecAsync.quantidadeEstoque, 5);
      },
    );

    it(
      'TC09: rejeita webhook sem assinatura válida (401), trata timeout como ERRO_COMUNICACAO e encaminha pagamento pós-expiração para RECONCILIACAO_ESTORNO',
      { timeout: 45_000 },
      async () => {
        // 1) Assinatura inválida deve retornar 401 e NÃO poluir webhooks_pagamento
        const eventoForjadoId = `evt-forjado-teste-${randomUUID()}`;
        const resForjado = await fetch(`${apiBaseUrl}/api/v1/pagamentos/webhook/http_sandbox`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-origem-signature': 'sha256=falsa' },
          body: JSON.stringify({
            eventoExternoId: eventoForjadoId,
            tipoEvento: 'payment.paid',
            externalPaymentId: 'ext_qualquer',
          }),
          signal: AbortSignal.timeout(10_000),
        });
        assert.equal(resForjado.status, 401);
        const jsonForjado = (await resForjado.json()) as { codigo?: string };
        assert.equal(jsonForjado.codigo, PAGAMENTO_ERROR_CODES.WEBHOOK_ASSINATURA_INVALIDA);

        const poluido = await prisma.webhookPagamento.findFirst({
          where: { eventoExternoId: eventoForjadoId },
        });
        assert.equal(poluido, null, 'Payload não autenticado não pode envenenar deduplicação');

        // 2) Timeout na chamada de criação -> ERRO_COMUNICACAO mantendo reserva até conciliação
        const resT = await postJson(
          '/api/v1/estoque/reservas',
          { lines: [{ productId: pecaTc09Id, quantity: 1 }] },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `res-to-${randomUUID()}` },
        );
        assert.equal(resT.status, 201);
        const grupoT = String(resT.json.grupoId);

        const chkTimeout = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId: grupoT,
            metodoPagamento: 'CARTAO_CREDITO',
            enderecoEntrega: enderecoValido,
            cartao: { token: 'tok_timeout', parcelas: 1, ultimosDigitos: '4242' },
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `chk-to-${randomUUID()}` },
        );
        assert.equal(chkTimeout.status, 504);
        assert.equal(
          chkTimeout.json.codigo,
          PAGAMENTO_ERROR_CODES.GATEWAY_TIMEOUT_RESULTADO_DESCONHECIDO,
        );

        const pedidoTimeout = await prisma.pedido.findFirstOrThrow({
          where: { reservaGrupoId: grupoT },
          include: { pagamentos: true },
        });
        assert.equal(pedidoTimeout.status, 'PENDENTE_PAGAMENTO');
        assert.equal(pedidoTimeout.pagamentos[0]?.status, 'ERRO_COMUNICACAO');

        // 2b) Recuperação real de timeout (ERRO_COMUNICACAO -> APROVADO) quando webhook assinado confirma depois
        const recordTimeout = Array.from(gatewayStore.values()).find(
          (g) => g.pedidoId === pedidoTimeout.id,
        );
        assert.ok(recordTimeout, 'Gateway controlado deve registrar externalPaymentId criado durante timeout');

        const resRecuperacao = await enviarWebhookAssinado({
          eventoExternoId: `evt-timeout-heal-${randomUUID()}`,
          tipoEvento: 'payment.paid',
          externalPaymentId: recordTimeout.externalPaymentId,
          status: 'APROVADO',
          metadata: {
            pedidoId: pedidoTimeout.id,
            pagamentoId: pedidoTimeout.pagamentos[0]!.id,
          },
        });
        assert.equal(resRecuperacao.status, 200);
        assert.equal(resRecuperacao.json.statusPedidoFinal, 'APROVADO');
        assert.equal(resRecuperacao.json.outboxRegistrado, true);

        const reservaCurada = await prisma.reserva.findMany({ where: { grupoId: grupoT } });
        assert.equal(reservaCurada[0]?.status, 'CONFIRMADA');
        await esperarCondicao(async () => {
          const outboxCurado = await prisma.outboxEventoNotificacao.findFirst({
            where: { aggregateId: pedidoTimeout.id },
          });
          return outboxCurado?.status === 'PUBLICADO';
        }, 12_000);

        // 3) Pagamento aprovado tardiamente após expiração da reserva -> RECONCILIACAO_ESTORNO
        const resLate = await postJson(
          '/api/v1/estoque/reservas',
          { lines: [{ productId: pecaTc09Id, quantity: 1 }] },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `res-late-${randomUUID()}` },
        );
        assert.equal(resLate.status, 201);
        const grupoLate = String(resLate.json.grupoId);

        const chkLate = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId: grupoLate,
            metodoPagamento: 'PIX',
            enderecoEntrega: enderecoValido,
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `chk-late-${randomUUID()}` },
        );
        assert.equal(chkLate.status, 201);
        const pedidoLate = chkLate.json.pedido as {
          id: string;
          pagamentoAtual: { externalPaymentId: string };
        };
        const extLate = pedidoLate.pagamentoAtual.externalPaymentId;

        await prisma.reserva.updateMany({
          where: { grupoId: grupoLate },
          data: {
            criadoEm: new Date(Date.now() - 20 * 60_000),
            expiraEm: new Date(Date.now() - 10_000),
          },
        });
        gatewayStore.get(extLate)!.status = 'APROVADO';

        const resLateWh = await enviarWebhookAssinado({
          eventoExternoId: `evt-late-paid-${randomUUID()}`,
          tipoEvento: 'payment.paid',
          externalPaymentId: extLate,
          status: 'APROVADO',
          metadata: { pedidoId: pedidoLate.id },
        });
        assert.equal(resLateWh.status, 200);
        assert.equal(resLateWh.json.statusPedidoFinal, 'RECONCILIACAO_ESTORNO');
        assert.equal(resLateWh.json.outboxRegistrado, false);

        const pedidoReconc = await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoLate.id } });
        assert.equal(pedidoReconc.status, 'RECONCILIACAO_ESTORNO');
        assert.ok(pedidoReconc.reconciliacaoMotivo);

        const reservasLate = await prisma.reserva.findMany({ where: { grupoId: grupoLate } });
        assert.equal(reservasLate[0]?.status, 'EXPIRADA');

        // 4) Expiração automática de pedido Pix abandonado via GET /api/v1/pedidos/meus devolvendo saldo HU-06
        const estoqueAntesAbandono = (
          await prisma.peca.findUniqueOrThrow({ where: { id: pecaTc09Id } })
        ).quantidadeEstoque;
        const resAbandono = await postJson(
          '/api/v1/estoque/reservas',
          { lines: [{ productId: pecaTc09Id, quantity: 1 }] },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `res-abnd-${randomUUID()}` },
        );
        assert.equal(resAbandono.status, 201);
        const grupoAbandono = String(resAbandono.json.grupoId);

        const chkAbandono = await postJson(
          '/api/v1/pedidos/checkout',
          {
            reservaGrupoId: grupoAbandono,
            metodoPagamento: 'PIX',
            enderecoEntrega: enderecoValido,
          },
          { Authorization: `Bearer ${buyerToken}`, 'Idempotency-Key': `chk-abnd-${randomUUID()}` },
        );
        assert.equal(chkAbandono.status, 201);
        const pedidoAbandono = chkAbandono.json.pedido as {
          id: string;
          pagamentoAtual: { id: string };
        };

        const criadoAntigo = new Date(Date.now() - 20 * 60_000);
        const expiraVencido = new Date(Date.now() - 10_000);
        await prisma.pagamento.update({
          where: { id: pedidoAbandono.pagamentoAtual.id },
          data: { criadoEm: criadoAntigo, expiraEm: expiraVencido },
        });
        await prisma.reserva.updateMany({
          where: { grupoId: grupoAbandono },
          data: { criadoEm: criadoAntigo, expiraEm: expiraVencido },
        });

        const listaMeus = await getJson('/api/v1/pedidos/meus', {
          Authorization: `Bearer ${buyerToken}`,
        });
        assert.equal(listaMeus.status, 200);
        const pedidosLista = listaMeus.json.dados as Array<{
          id: string;
          status: string;
          pagamentoAtual: { status: string } | null;
        }>;
        const abandonoNaLista = pedidosLista.find((p) => p.id === pedidoAbandono.id);
        assert.equal(abandonoNaLista?.status, 'EXPIRADO');
        assert.equal(abandonoNaLista?.pagamentoAtual?.status, 'EXPIRADO');

        const estoqueAposAbandono = (
          await prisma.peca.findUniqueOrThrow({ where: { id: pecaTc09Id } })
        ).quantidadeEstoque;
        assert.equal(estoqueAposAbandono, estoqueAntesAbandono);

        // 5) Consulta autenticada do pedido pelo dono
        const consultaDono = await getJson(`/api/v1/pedidos/${pedidoLate.id}`, {
          Authorization: `Bearer ${buyerToken}`,
        });
        assert.equal(consultaDono.status, 200);
        assert.equal(
          (consultaDono.json.pedido as { status: string }).status,
          'RECONCILIACAO_ESTORNO',
        );
      },
    );
  },
);
