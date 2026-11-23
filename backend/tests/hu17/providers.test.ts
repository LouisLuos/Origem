import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
  HttpEmailProvider,
  UnconfiguredEmailProvider,
  validarConfiguracaoProvedorEmail,
} from '../../src/integrations/email.provider.js';
import { NotificacaoProviderError } from '../../src/integrations/notificacaoProvider.contracts.js';
import {
  HttpWhatsAppProvider,
  MetaWhatsAppCloudProvider,
  UnconfiguredWhatsAppProvider,
  validarConfiguracaoProvedorWhatsapp,
} from '../../src/integrations/whatsapp.provider.js';

describe('HU-17 — Adaptadores externos (e-mail, WhatsApp oficial e classificação de falhas)', () => {
  let server: http.Server;
  let baseUrl = '';
  let modoResposta: '200' | '500' | '503' | '429' | '400' | 'meta_130429' | 'slow' = '200';
  let ultimoPath = '';
  let ultimoHeaderIdempotency = '';

  before(async () => {
    server = http.createServer((req, res) => {
      ultimoPath = req.url ?? '';
      ultimoHeaderIdempotency =
        String(req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'] ?? '');

      if (modoResposta === 'slow') {
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: 'tardio' }));
          }
        }, 400);
        return;
      }

      if (modoResposta === '500') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
        return;
      }

      if (modoResposta === '503') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Service Unavailable' }));
        return;
      }

      if (modoResposta === '429') {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
        return;
      }

      if (modoResposta === '400') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid recipient' }));
        return;
      }

      if (modoResposta === 'meta_130429') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 130429, message: 'Throughput reached' } }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'msg-ok-123', messages: [{ id: 'wamid.abc123' }] }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('classifica falhas 503/429/timeout como transitórias e 400 como permanente no HttpEmailProvider', async () => {
    const provider = new HttpEmailProvider({
      endpoint: `${baseUrl}/email`,
      from: 'Origem <noreply@origem.local>',
      timeoutMs: 120,
    });

    modoResposta = '200';
    const ok = await provider.enviarEmail({
      para: 'teste@origem.local',
      assunto: 'Assunto',
      html: '<p>Oi</p>',
      texto: 'Oi',
      idempotencyKey: 'chave-email-1',
    });
    assert.equal(ok.messageId, 'msg-ok-123');
    assert.equal(ultimoPath, '/email');
    assert.equal(ultimoHeaderIdempotency, 'chave-email-1');

    for (const caso of [
      { modo: '500' as const, transient: true, codigo: 'HTTP_500' },
      { modo: '503' as const, transient: true, codigo: 'HTTP_503' },
      { modo: '429' as const, transient: true, codigo: 'HTTP_429' },
      { modo: '400' as const, transient: false, codigo: 'HTTP_400' },
      { modo: 'slow' as const, transient: true, codigo: 'PROVIDER_TIMEOUT' },
    ]) {
      modoResposta = caso.modo;
      await assert.rejects(
        () =>
          provider.enviarEmail({
            para: 'teste@origem.local',
            assunto: 'Assunto',
            html: '<p>Oi</p>',
            texto: 'Oi',
            idempotencyKey: `chave-${caso.modo}`,
          }),
        (err: unknown) => {
          assert.ok(err instanceof NotificacaoProviderError);
          assert.equal(err.transient, caso.transient);
          assert.equal(err.codigo, caso.codigo);
          return true;
        },
      );
    }
  });

  it('valida consentimento WhatsApp antes de chamar Meta Cloud API e trata rate limits Meta', async () => {
    const meta = new MetaWhatsAppCloudProvider({
      baseUrl,
      phoneNumberId: '123456',
      accessToken: 'token-secreto-teste',
      defaultLanguage: 'pt_BR',
      timeoutMs: 500,
    });

    ultimoPath = '';
    await assert.rejects(
      () =>
        meta.enviarMensagem({
          paraTelefone: '81998765432',
          templateNome: 'origem_alerta_sla_postagem_dia5_v1',
          idioma: 'pt_BR',
          parametros: ['Mestra'],
          textoFallback: 'Alerta SLA',
          consentimentoWhatsapp: false,
          idempotencyKey: 'wa-sem-optin',
        }),
      (err: unknown) => {
        assert.ok(err instanceof NotificacaoProviderError);
        assert.equal(err.codigo, 'WHATSAPP_SEM_CONSENTIMENTO');
        assert.equal(err.transient, false);
        return true;
      },
    );
    assert.equal(ultimoPath, '');

    modoResposta = '200';
    const ok = await meta.enviarMensagem({
      paraTelefone: '81998765432',
      templateNome: 'origem_alerta_sla_postagem_dia5_v1',
      idioma: 'pt_BR',
      parametros: ['Mestra'],
      textoFallback: 'Alerta SLA',
      consentimentoWhatsapp: true,
      idempotencyKey: 'wa-com-optin',
    });
    assert.equal(ultimoPath, '/123456/messages');
    assert.equal(ok.messageId, 'wamid.abc123');

    modoResposta = 'meta_130429';
    await assert.rejects(
      () =>
        meta.enviarMensagem({
          paraTelefone: '81998765432',
          templateNome: 'origem_alerta_sla_postagem_dia5_v1',
          idioma: 'pt_BR',
          parametros: ['Mestra'],
          textoFallback: 'Alerta SLA',
          consentimentoWhatsapp: true,
          idempotencyKey: 'wa-rate-limit',
        }),
      (err: unknown) => {
        assert.ok(err instanceof NotificacaoProviderError);
        assert.equal(err.transient, true);
        return true;
      },
    );

    const httpWa = new HttpWhatsAppProvider({
      endpoint: `${baseUrl}/wa`,
      defaultLanguage: 'pt_BR',
      timeoutMs: 500,
    });
    modoResposta = '200';
    const waOk = await httpWa.enviarMensagem({
      paraTelefone: '81998765432',
      templateNome: 'origem_alerta_sla_postagem_dia5_v1',
      idioma: 'pt_BR',
      parametros: ['Mestra'],
      textoFallback: 'Alerta SLA',
      consentimentoWhatsapp: true,
      idempotencyKey: 'wa-http-ok',
    });
    assert.equal(waOk.messageId, 'msg-ok-123');
  });

  it('mantém provedores não configurados falhando de forma explícita sem simular entrega', async () => {
    const emailOff = new UnconfiguredEmailProvider();
    const waOff = new UnconfiguredWhatsAppProvider();
    assert.equal(emailOff.configurado, false);
    assert.equal(waOff.configurado, false);

    await assert.rejects(() =>
      emailOff.enviarEmail({
        para: 'a@b.com',
        assunto: 'x',
        html: 'x',
        texto: 'x',
        idempotencyKey: 'off-1',
      }),
    );
    await assert.rejects(() =>
      waOff.enviarMensagem({
        paraTelefone: '81998765432',
        templateNome: 'x',
        idioma: 'pt_BR',
        parametros: [],
        textoFallback: 'x',
        consentimentoWhatsapp: true,
        idempotencyKey: 'off-2',
      }),
    );

    const smtpIncompleto = validarConfiguracaoProvedorEmail({
      EMAIL_PROVIDER: 'smtp',
      SMTP_USER: 'usuario-teste',
    });
    assert.equal(smtpIncompleto.valido, false);
    assert.equal(smtpIncompleto.configurado, false);
    assert.equal(smtpIncompleto.erros.length >= 2, true);
    assert.equal(smtpIncompleto.erros.join(' ').includes('usuario-teste'), false);

    const metaIncompleto = validarConfiguracaoProvedorWhatsapp({
      WHATSAPP_PROVIDER: 'meta_cloud',
      WHATSAPP_ACCESS_TOKEN: 'segredo-nao-vazar',
    });
    assert.equal(metaIncompleto.valido, false);
    assert.equal(metaIncompleto.configurado, false);
    assert.equal(metaIncompleto.erros.join(' ').includes('segredo-nao-vazar'), false);

    const metaValido = validarConfiguracaoProvedorWhatsapp({
      WHATSAPP_PROVIDER: 'meta_cloud',
      WHATSAPP_PHONE_NUMBER_ID: '123456',
      WHATSAPP_ACCESS_TOKEN: 'segredo',
    });
    assert.equal(metaValido.valido, true);
    assert.equal(metaValido.configurado, true);
  });
});
