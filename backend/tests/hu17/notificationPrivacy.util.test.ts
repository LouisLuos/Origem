import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  construirChaveIdempotenciaNotificacao,
  mascararDestinatario,
  mascararEmail,
  mascararTelefoneWhatsapp,
  normalizarTelefoneWhatsappE164,
  sanitizarErroProvedor,
} from '../../src/utils/notificationPrivacy.util.js';

describe('HU-17 — Privacidade, mascaramento LGPD, sanitização e chaves BullMQ', () => {
  it('mascara e-mail e WhatsApp preservando rastreabilidade sem expor contato completo', () => {
    assert.equal(mascararEmail('maria.artesania@origem.pe.br'), 'ma***@origem.pe.br');
    assert.equal(mascararEmail('a@b.pe'), 'a***@b.pe');
    assert.equal(mascararTelefoneWhatsapp('(81) 99876-5432'), '+5581*****5432');
    assert.equal(mascararDestinatario('EMAIL', 'cliente@teste.com'), 'cl***@teste.com');
    assert.equal(mascararDestinatario('WHATSAPP', '81998765432'), '+5581*****5432');
  });

  it('normaliza telefones brasileiros válidos para E.164 e rejeita inválidos', () => {
    assert.equal(normalizarTelefoneWhatsappE164('81 99999-1234'), '+5581999991234');
    assert.equal(normalizarTelefoneWhatsappE164('+55 81 3333-4444'), '+558133334444');
    assert.equal(normalizarTelefoneWhatsappE164('12345'), null);
  });

  it('remove tokens, credenciais, e-mails e telefones ao sanitizar erros externos', () => {
    const bruto = new Error(
      'Authorization Bearer secret-jwt-token-123 https://user:pass123@smtp.local api_key=XYZ999 para joao@exemplo.com tel +5581999991234',
    );
    const limpo = sanitizarErroProvedor(bruto);

    assert.equal(limpo.includes('secret-jwt-token-123'), false);
    assert.equal(limpo.includes('pass123'), false);
    assert.equal(limpo.includes('XYZ999'), false);
    assert.equal(limpo.includes('joao@exemplo.com'), false);
    assert.equal(limpo.includes('999991234'), false);
    assert.equal(limpo.length <= 500, true);
  });

  it('gera idempotencyKey determinística e compatível com BullMQ sem dois-pontos (:)', () => {
    const k1 = construirChaveIdempotenciaNotificacao('pgto:aprovado', ['pedido-1', 'EMAIL']);
    const k2 = construirChaveIdempotenciaNotificacao('pgto:aprovado', ['pedido-1', 'EMAIL']);
    const k3 = construirChaveIdempotenciaNotificacao('pgto:aprovado', ['pedido-1', 'WHATSAPP']);

    assert.equal(k1, k2);
    assert.notEqual(k1, k3);
    assert.equal(k1.includes(':'), false);
    assert.match(k1, /^[a-zA-Z0-9_-]+$/);
    assert.equal(k1.length <= 128, true);
  });
});
