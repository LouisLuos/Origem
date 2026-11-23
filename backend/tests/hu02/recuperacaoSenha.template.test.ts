import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderizarTemplateNotificacao } from '../../src/templates/notificacoes/index.js';

describe('HU-02 · e-mail de recuperação de senha', () => {
  it('inclui o link, a validade e escapa o nome do usuário', () => {
    const url = 'https://origem.test/redefinir-senha?token=abc';
    const render = renderizarTemplateNotificacao({
      template: 'RECUPERACAO_SENHA',
      dados: { nome: '<b>Maria</b>', urlRedefinicao: url, validadeMinutos: 30 },
    });

    assert.equal(render.template, 'RECUPERACAO_SENHA');
    assert.match(render.assunto, /Redefinição de senha/);
    assert.ok(render.texto.includes(url));
    assert.ok(render.texto.includes('30 minutos'));
    assert.ok(render.html.includes('30 minutos'));
    assert.ok(!render.html.includes('<b>Maria</b>'));
  });
});
