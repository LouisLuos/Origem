import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Queue } from 'bullmq';
import { prisma } from '../../src/config/database.js';
import { createBullMqConnectionOptions, pingRedis } from '../../src/cache/redis.client.js';
import { HttpEmailProvider } from '../../src/integrations/email.provider.js';
import { HttpWhatsAppProvider } from '../../src/integrations/whatsapp.provider.js';
import { executarFiscalizacaoSlaPostagem } from '../../src/jobs/checkPostageSla.job.js';
import { createNotificationProducer, type NotificationJobData } from '../../src/queues/notification.queue.js';
import { createNotificationWorker } from '../../src/queues/notification.worker.js';
import { prismaNotificacaoLogRepository } from '../../src/repositories/prismaNotificacaoLog.repository.js';
import type { SubpedidoSlaRepository } from '../../src/repositories/contracts/slaPostagem.contracts.js';
import { createNotificacaoEventosService } from '../../src/services/notificacaoEventos.service.js';
import { createCalendarioFeriados } from '../../src/utils/diasUteis.util.js';

const habilitado = process.env.RUN_HU17_INTEGRATION === '1';

async function esperarCondicao(
  condicao: () => Promise<boolean>,
  timeoutMs = 15_000,
  intervaloMs = 100,
): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    if (await condicao()) {
      return;
    }
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new Error(`Condição de teste assíncrono não satisfeita em ${timeoutMs} ms.`);
}

describe(
  'HU-17 — Integração Real com BullMQ/Redis + PostgreSQL Supabase + Provedores Controlados',
  { skip: !habilitado },
  () => {
    const queueName = `hu17_bdd_${randomUUID().slice(0, 8)}`;
    const prefix = 'origem_test';
    const usuariosCriadosIds: string[] = [];
    const artesaosCriadosIds: string[] = [];
    const ateliesCriadosIds: string[] = [];
    const logsParaLimparIds: string[] = [];

    let providerServer: http.Server;
    let providerBaseUrl = '';
    const emailsRecebidos: Array<{ to: string; subject: string; html: string; idempotencyKey: string }> = [];
    const whatsappsRecebidos: Array<{ to: string; textFallback: string; idempotencyKey: string }> = [];

    // Mapa para simular HTTP 503 por idempotencyKey no BDD 3
    const roteamentoFalhasPorChave = new Map<
      string,
      { falhaAteTentativa: number; tentativas: number[]; modoSempre503?: boolean }
    >();

    let queue: Queue<NotificationJobData>;
    let workerHandle: ReturnType<typeof createNotificationWorker>;
    let producer: ReturnType<typeof createNotificationProducer>;

    let compradorUsuarioId = '';
    let titular1UsuarioId = '';
    let titular2UsuarioId = '';
    let atelie1RealId = '';
    let atelie2RealId = '';

    before(async () => {
      const redisDisponivel = await pingRedis();
      assert.equal(redisDisponivel, true, 'Redis real deve estar acessível para integração HU-17.');

      // 1) Servidor HTTP controlado (sem envio externo real)
      providerServer = http.createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = chunks.length > 0 ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>) : {};
        const key = String(body.idempotencyKey ?? req.headers['idempotency-key'] ?? '');

        const regraFalha = roteamentoFalhasPorChave.get(key);
        if (regraFalha) {
          regraFalha.tentativas.push(Date.now());
          const tentativaAtual = regraFalha.tentativas.length;
          if (regraFalha.modoSempre503 || tentativaAtual <= regraFalha.falhaAteTentativa) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ erro: 'Provedor controlado simulando HTTP 503' }));
            return;
          }
        }

        if (req.url === '/email') {
          emailsRecebidos.push({
            to: String(body.to ?? ''),
            subject: String(body.subject ?? ''),
            html: String(body.html ?? ''),
            idempotencyKey: key,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ messageId: `ctrl-email-${emailsRecebidos.length}` }));
          return;
        }

        if (req.url === '/whatsapp') {
          whatsappsRecebidos.push({
            to: String(body.to ?? ''),
            textFallback: String(body.textFallback ?? ''),
            idempotencyKey: key,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ messageId: `ctrl-wa-${whatsappsRecebidos.length}` }));
          return;
        }

        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => {
        providerServer.listen(0, '127.0.0.1', () => {
          const addr = providerServer.address();
          if (addr && typeof addr === 'object') {
            providerBaseUrl = `http://127.0.0.1:${addr.port}`;
          }
          resolve();
        });
      });

      // 2) Criar usuários temporários reais no Supabase (limpos no after)
      const sufixo = randomUUID().slice(0, 8);
      const uComp = await prisma.usuario.create({
        data: {
          nome: 'Compradora Teste HU17',
          email: `compradora.hu17.${sufixo}@origem.test`,
          cpfCnpj: `910${Math.floor(10_000_000 + Math.random() * 89_000_000)}`,
          telefoneWhatsapp: '81991112222',
          senhaHash: 'hash_teste_hu17',
        },
      });
      const uArt1 = await prisma.usuario.create({
        data: {
          nome: 'Mestre Barro HU17',
          email: `artesao1.hu17.${sufixo}@origem.test`,
          cpfCnpj: `920${Math.floor(10_000_000 + Math.random() * 89_000_000)}`,
          telefoneWhatsapp: '81992223333',
          senhaHash: 'hash_teste_hu17',
        },
      });
      const uArt2 = await prisma.usuario.create({
        data: {
          nome: 'Mestra Renda HU17',
          email: `artesao2.hu17.${sufixo}@origem.test`,
          cpfCnpj: `930${Math.floor(10_000_000 + Math.random() * 89_000_000)}`,
          telefoneWhatsapp: '81993334444',
          senhaHash: 'hash_teste_hu17',
        },
      });
      compradorUsuarioId = uComp.id;
      titular1UsuarioId = uArt1.id;
      titular2UsuarioId = uArt2.id;
      usuariosCriadosIds.push(uComp.id, uArt1.id, uArt2.id);

      const art1 = await prisma.artesao.create({
        data: {
          usuarioId: uArt1.id,
          biografiaCultural: 'Biografia teste HU-17 ateliê 1.',
          tipoChavePix: 'ALEATORIA',
          chavePixCriptografada: 'enc-teste-hu17-1',
        },
      });
      const art2 = await prisma.artesao.create({
        data: {
          usuarioId: uArt2.id,
          biografiaCultural: 'Biografia teste HU-17 ateliê 2.',
          tipoChavePix: 'ALEATORIA',
          chavePixCriptografada: 'enc-teste-hu17-2',
        },
      });
      artesaosCriadosIds.push(art1.id, art2.id);

      const atl1 = await prisma.atelie.create({
        data: {
          artesaoId: art1.id,
          nomeComercial: 'Ateliê Barro Vivo HU17',
          poloCultural: 'Caruaru',
        },
      });
      const atl2 = await prisma.atelie.create({
        data: {
          artesaoId: art2.id,
          nomeComercial: 'Casa da Renda HU17',
          poloCultural: 'Pesqueira',
        },
      });
      atelie1RealId = atl1.id;
      atelie2RealId = atl2.id;
      ateliesCriadosIds.push(atl1.id, atl2.id);

      // 3) Inicializar Fila + Worker BullMQ reais com backoff exponencial 1s e 3 tentativas
      queue = new Queue<NotificationJobData>(queueName, {
        connection: createBullMqConnectionOptions(),
        prefix,
      });

      producer = createNotificationProducer({
        queue,
        logRepository: prismaNotificacaoLogRepository,
        policy: {
          queueName,
          prefix,
          attempts: 3,
          backoffInitialMs: 1000,
          concurrency: 4,
        },
      });

      workerHandle = createNotificationWorker({
        emailProvider: new HttpEmailProvider({
          endpoint: `${providerBaseUrl}/email`,
          from: 'Origem <noreply@origem.local>',
          timeoutMs: 2000,
        }),
        whatsappProvider: new HttpWhatsAppProvider({
          endpoint: `${providerBaseUrl}/whatsapp`,
          defaultLanguage: 'pt_BR',
          timeoutMs: 2000,
        }),
        logRepository: prismaNotificacaoLogRepository,
        policy: {
          queueName,
          prefix,
          attempts: 3,
          backoffInitialMs: 1000,
          concurrency: 4,
        },
        logger: () => {},
      });
    });

    after(async () => {
      if (workerHandle) await workerHandle.close();
      if (queue) {
        await queue.obliterate({ force: true }).catch(() => {});
        await queue.close();
      }
      if (providerServer) {
        await new Promise<void>((resolve) => providerServer.close(() => resolve()));
      }
      if (logsParaLimparIds.length > 0) {
        await prisma.$executeRaw`
          DELETE FROM "logs_notificacoes" WHERE "id" = ANY(${logsParaLimparIds}::uuid[])
        `;
      }
      if (ateliesCriadosIds.length > 0) {
        await prisma.atelie.deleteMany({
          where: { id: { in: ateliesCriadosIds } },
        });
      }
      if (artesaosCriadosIds.length > 0) {
        await prisma.artesao.deleteMany({
          where: { id: { in: artesaosCriadosIds } },
        });
      }
      if (usuariosCriadosIds.length > 0) {
        await prisma.usuario.deleteMany({
          where: { id: { in: usuariosCriadosIds } },
        });
      }
    });

    it('BDD 1: processa PagamentoAprovado de forma assíncrona, envia recibo + avisos aos ateliês, audita e evita duplicidade', async () => {
      const servicoEventos = createNotificacaoEventosService({
        producer,
        logRepository: prismaNotificacaoLogRepository,
      });

      const pedidoId = randomUUID();
      const atelie1Id = atelie1RealId;
      const atelie2Id = atelie2RealId;

      const evento = {
        pedidoId,
        codigoPedido: `ORD-BDD1-${pedidoId.slice(0, 6)}`,
        aprovadoEm: new Date('2026-11-22T18:00:00.000Z'),
        metodoPagamento: 'PIX' as const,
        comprador: {
          usuarioId: compradorUsuarioId,
          nome: 'Compradora Teste HU17',
          email: 'compradora.bdd1@origem.local',
          consentimentoWhatsapp: false,
        },
        destino: { cidade: 'Recife', uf: 'PE' },
        valorTotalPecas: 420,
        valorTotalFrete: 50,
        valorTotalPedido: 470,
        atelies: [
          {
            subpedidoId: randomUUID(),
            atelieId: atelie1Id,
            atelieNome: 'Ateliê Barro Vivo',
            titularUsuarioId: titular1UsuarioId,
            titularNome: 'Mestre Barro',
            titularEmail: 'mestre.barro@origem.local',
            titularWhatsapp: '81992223333',
            consentimentoWhatsappTitular: true,
            valorFreteAtelie: 25,
          },
          {
            subpedidoId: randomUUID(),
            atelieId: atelie2Id,
            atelieNome: 'Casa da Renda',
            titularUsuarioId: titular2UsuarioId,
            titularNome: 'Mestra Renda',
            titularEmail: 'mestra.renda@origem.local',
            titularWhatsapp: '81993334444',
            consentimentoWhatsappTitular: false,
            valorFreteAtelie: 25,
          },
        ],
        itens: [
          {
            atelieId: atelie1Id,
            atelieNome: 'Ateliê Barro Vivo',
            poloCultural: 'Caruaru',
            pecaId: randomUUID(),
            tituloPeca: 'Moradia Sertaneja',
            quantidade: 1,
            precoUnitario: 200,
            subtotalItem: 200,
            isFragil: true,
          },
          {
            atelieId: atelie2Id,
            atelieNome: 'Casa da Renda',
            poloCultural: 'Pesqueira',
            pecaId: randomUUID(),
            tituloPeca: 'Caminho de Mesa Renascença',
            quantidade: 2,
            precoUnitario: 110,
            subtotalItem: 220,
            isFragil: false,
          },
        ],
      };

      const pub1 = await servicoEventos.publicarPagamentoAprovado(evento);
      for (const r of pub1.resultados) logsParaLimparIds.push(r.logId);

      // 1 email comprador + 1 email atelie1 + 1 email atelie2 + 1 whatsapp atelie1 (atelie2 sem consentimento = IGNORADA)
      assert.equal(pub1.notificacoesEnfileiradas, 4);
      assert.equal(pub1.notificacoesIgnoradas, 1);

      await esperarCondicao(async () => {
        const logs = await prismaNotificacaoLogRepository.listarPorPedido(pedidoId);
        const pendentes = logs.filter(
          (l) => l.status === 'ENFILEIRADA' || l.status === 'PROCESSANDO',
        );
        return pendentes.length === 0 && logs.length === 5;
      });

      const logsDepois = await prismaNotificacaoLogRepository.listarPorPedido(pedidoId);
      const enviadas = logsDepois.filter((l) => l.status === 'ENVIADA');
      const ignoradas = logsDepois.filter((l) => l.status === 'IGNORADA');
      assert.equal(enviadas.length, 4);
      assert.equal(ignoradas.length, 1);
      // Privacidade: e-mails não ficam em texto completo no banco
      assert.equal(
        logsDepois.some((l) => l.destinatario === 'compradora.bdd1@origem.local'),
        false,
      );

      const reciboComprador = emailsRecebidos.find((e) => e.to === 'compradora.bdd1@origem.local');
      assert.ok(reciboComprador);
      assert.match(reciboComprador.html, /R\$ 470,00/);
      assert.match(reciboComprador.html, /Moradia Sertaneja/);
      assert.match(reciboComprador.html, /Caminho de Mesa Renascença/);

      const emailsAntesReenvio = emailsRecebidos.length;
      const waAntesReenvio = whatsappsRecebidos.length;

      // Republicação duplicada do mesmo evento não deve gerar novos envios
      const pub2 = await servicoEventos.publicarPagamentoAprovado(evento);
      assert.equal(pub2.notificacoesEnfileiradas, 0);
      assert.equal(pub2.notificacoesDuplicadas, 5);
      await new Promise((r) => setTimeout(r, 250));
      assert.equal(emailsRecebidos.length, emailsAntesReenvio);
      assert.equal(whatsappsRecebidos.length, waAntesReenvio);
    });

    it('BDD 2: fiscalização de SLA identifica subpedido no 5º dia útil, alerta titular por e-mail/WhatsApp e evita duplicatas', async () => {
      const pedidoId = randomUUID();
      const subpedidoDia5Id = randomUUID();
      const subpedidoDia3Id = randomUUID();
      const atelieId = atelie1RealId;

      const repoSla: SubpedidoSlaRepository = {
        configurado: true,
        async listarAguardandoPostagem() {
          return [
            {
              subpedidoId: subpedidoDia5Id,
              pedidoId,
              codigoPedido: 'ORD-SLA-DIA5',
              atelieId,
              atelieNome: 'Ateliê Barro Vivo',
              titularUsuarioId: titular1UsuarioId,
              titularNome: 'Mestre Barro',
              titularEmail: 'sla.titular@origem.local',
              titularWhatsapp: '81992223333',
              consentimentoWhatsappTitular: true,
              statusLogistico: 'AGUARDANDO_POSTAGEM',
              codigoRastreio: null,
              dataPostagem: null,
              // Segunda 16/11 -> sem feriado, 23/11 é o 5º dia útil; COM feriado em 19/11, 24/11 é o 5º dia útil
              pagamentoAprovadoEm: new Date('2026-11-16T10:00:00-03:00'),
              resumoItens: ['Moradia Sertaneja'],
            },
            {
              subpedidoId: subpedidoDia3Id,
              pedidoId,
              codigoPedido: 'ORD-SLA-DIA3',
              atelieId,
              atelieNome: 'Ateliê Barro Vivo',
              titularUsuarioId: titular1UsuarioId,
              titularNome: 'Mestre Barro',
              titularEmail: 'sla.titular@origem.local',
              titularWhatsapp: '81992223333',
              consentimentoWhatsappTitular: true,
              statusLogistico: 'AGUARDANDO_POSTAGEM',
              codigoRastreio: null,
              dataPostagem: null,
              pagamentoAprovadoEm: new Date('2026-11-19T10:00:00-03:00'),
              resumoItens: ['Peça Recente'],
            },
          ];
        },
      };

      const calendarioFeriado = createCalendarioFeriados(['2026-11-19']);

      // Em 23/11 com feriado em 19/11, são apenas 4 dias úteis -> NÃO dispara ainda
      const antesDo5o = await executarFiscalizacaoSlaPostagem(
        {
          subpedidoRepository: repoSla,
          producer,
          calendarioFeriados: calendarioFeriado,
        },
        new Date('2026-11-23T14:00:00-03:00'),
      );
      assert.equal(antesDo5o.subpedidosEmAlertaDia5, 0);
      assert.equal(antesDo5o.alertasEnfileirados, 0);

      // Em 24/11 completa exatamente o 5º dia útil -> dispara e-mail e WhatsApp
      const no5oDia = await executarFiscalizacaoSlaPostagem(
        {
          subpedidoRepository: repoSla,
          producer,
          calendarioFeriados: calendarioFeriado,
        },
        new Date('2026-11-24T09:00:00-03:00'),
      );
      for (const r of no5oDia.resultados) logsParaLimparIds.push(r.logId);

      assert.equal(no5oDia.subpedidosEmAlertaDia5, 1);
      assert.equal(no5oDia.alertasEnfileirados, 2);

      await esperarCondicao(async () => {
        const logs = await prismaNotificacaoLogRepository.listarPorSubpedido(subpedidoDia5Id);
        return logs.length === 2 && logs.every((l) => l.status === 'ENVIADA');
      });

      const emailSla = emailsRecebidos.find(
        (e) => e.to === 'sla.titular@origem.local' && /ORD-SLA-DIA5/.test(e.subject),
      );
      const waSla = whatsappsRecebidos.find((w) => /ORD-SLA-DIA5/.test(w.textFallback));
      assert.ok(emailSla);
      assert.ok(waSla);
      assert.match(emailSla.html, /risco de cancelamento/i);
      assert.match(waSla.textFallback, /Risco de cancelamento/i);

      // Reexecução da fiscalização não gera alertas duplicados
      const repeticao = await executarFiscalizacaoSlaPostagem(
        {
          subpedidoRepository: repoSla,
          producer,
          calendarioFeriados: calendarioFeriado,
        },
        new Date('2026-11-24T18:00:00-03:00'),
      );
      assert.equal(repeticao.alertasEnfileirados, 0);
      assert.equal(repeticao.alertasDuplicados, 2);
    });

    it('BDD 3: HTTP 503 dispara backoff exponencial (1s -> 2s), recupera na 3ª tentativa e respeita limite de 3 tentativas sem bloquear chamador', async () => {
      const chaveRecuperavel = `bdd3_recupera_${randomUUID().replace(/-/g, '')}`;
      const chaveEsgota = `bdd3_esgota_${randomUUID().replace(/-/g, '')}`;
      roteamentoFalhasPorChave.set(chaveRecuperavel, { falhaAteTentativa: 2, tentativas: [] });
      roteamentoFalhasPorChave.set(chaveEsgota, {
        falhaAteTentativa: 99,
        tentativas: [],
        modoSempre503: true,
      });

      const payloadComum = {
        template: 'ATUALIZACAO_STATUS_PEDIDO' as const,
        dados: {
          pedidoId: randomUUID(),
          codigoPedido: 'ORD-BDD3-503',
          destinatarioNome: 'Comprador Resiliência',
          novoStatus: 'EM_TRANSITO' as const,
          ocorrenciaEm: new Date('2026-11-22T20:00:00.000Z'),
        },
      };

      const t0 = Date.now();
      const [enq1, enq2] = await Promise.all([
        producer.enfileirar({
          eventoOrigem: 'TesteBDD3Recupera',
          canal: 'EMAIL',
          destinatarioReal: 'recupera@origem.local',
          usuarioId: compradorUsuarioId,
          payloadTemplate: payloadComum,
          idempotencyKey: chaveRecuperavel,
        }),
        producer.enfileirar({
          eventoOrigem: 'TesteBDD3Esgota',
          canal: 'EMAIL',
          destinatarioReal: 'esgota@origem.local',
          usuarioId: compradorUsuarioId,
          payloadTemplate: payloadComum,
          idempotencyKey: chaveEsgota,
        }),
      ]);
      const duracaoEnfileiramentoMs = Date.now() - t0;

      logsParaLimparIds.push(enq1.logId, enq2.logId);
      assert.equal(enq1.enfileirada, true);
      assert.equal(enq2.enfileirada, true);
      // Chamada síncrona retorna rapidamente sem aguardar as 3 tentativas nem o backoff
      assert.equal(duracaoEnfileiramentoMs < 1500, true);

      await esperarCondicao(async () => {
        const l1 = await prismaNotificacaoLogRepository.buscarPorId(enq1.logId);
        const l2 = await prismaNotificacaoLogRepository.buscarPorId(enq2.logId);
        return l1?.status === 'ENVIADA' && l2?.status === 'FALHA_PERMANENTE';
      }, 20_000);

      const logRecuperado = await prismaNotificacaoLogRepository.buscarPorId(enq1.logId);
      const logEsgotado = await prismaNotificacaoLogRepository.buscarPorId(enq2.logId);

      assert.equal(logRecuperado?.status, 'ENVIADA');
      assert.equal(logRecuperado?.tentativas, 3);
      assert.equal(logRecuperado?.erroSanitizado, null);
      assert.equal(logRecuperado?.proximaTentativaEm, null);

      assert.equal(logEsgotado?.status, 'FALHA_PERMANENTE');
      assert.equal(logEsgotado?.tentativas, 3);
      assert.equal(logEsgotado?.erroCodigo, 'HTTP_503');
      assert.equal(logEsgotado?.proximaTentativaEm, null);
      assert.equal(logEsgotado?.enviadoEm, null);

      const temposRecuperacao = roteamentoFalhasPorChave.get(chaveRecuperavel)?.tentativas ?? [];
      assert.equal(temposRecuperacao.length, 3);
      const delta1Ms = temposRecuperacao[1] - temposRecuperacao[0];
      const delta2Ms = temposRecuperacao[2] - temposRecuperacao[1];
      // Backoff exponencial iniciando em 1s (1000ms -> 2000ms), com pequena tolerância de timer
      assert.equal(delta1Ms >= 850, true, `Intervalo 1->2 esperado >= 850ms, obtido ${delta1Ms}ms`);
      assert.equal(delta2Ms >= 1700, true, `Intervalo 2->3 esperado >= 1700ms, obtido ${delta2Ms}ms`);
      assert.equal(delta2Ms > delta1Ms, true, `Backoff exponencial deve crescer (${delta1Ms}ms -> ${delta2Ms}ms)`);
    });
  },
);
