import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  EmailRecuperacaoInput,
  RecuperacaoSenhaRepository,
  UsuarioRecuperacao,
} from '../../src/repositories/contracts/hu02.contracts.js';
import {
  createRecuperacaoSenhaService,
  hashTokenRecuperacao,
  VALIDADE_TOKEN_RECUPERACAO_MINUTOS,
} from '../../src/services/recuperacaoSenha.service.js';
import { AppError } from '../../src/utils/AppError.js';

const usuario: UsuarioRecuperacao = {
  id: 'b6c8c888-f0a0-4eed-9223-26f6bb6d9d65',
  nome: 'Maria da Silva',
  email: 'maria@email.com',
};

interface TokenGuardado {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

function cenario(inicio = new Date('2026-11-24T12:00:00.000Z')) {
  let agora = inicio;
  let sequencia = 0;
  const tokens: TokenGuardado[] = [];
  const emails: EmailRecuperacaoInput[] = [];
  const estadoUsuario = { senhaHash: 'hash-antigo', sessoesValidasDesde: null as Date | null };

  const repository: RecuperacaoSenhaRepository = {
    async buscarUsuarioAtivoPorEmail(email) {
      return email === usuario.email ? usuario : null;
    },
    async registrarSolicitacao({ usuarioId, tokenHash, expiraEm, agora: instante }) {
      for (const t of tokens) if (t.usuarioId === usuarioId && !t.usadoEm) t.usadoEm = instante;
      const id = `rec-${++sequencia}`;
      tokens.push({ id, usuarioId, tokenHash, expiraEm, usadoEm: null });
      return { id };
    },
    async redefinirSenha({ tokenHash, senhaHash, agora: instante }) {
      const t = tokens.find((item) => item.tokenHash === tokenHash);
      if (!t || t.usadoEm || t.expiraEm <= instante) return 'TOKEN_INVALIDO';
      t.usadoEm = instante;
      estadoUsuario.senhaHash = senhaHash;
      estadoUsuario.sessoesValidasDesde = instante;
      return 'REDEFINIDA';
    },
  };

  const service = createRecuperacaoSenhaService({
    repository,
    envioEmail: { async enfileirar(input) { emails.push(input); } },
    passwordHasher: {
      async hash(senha) { return `hash(${senha})`; },
      async verify() { return false; },
    },
    now: () => agora,
    gerarToken: () => `token-${String(sequencia + 1).padStart(37, '0')}`,
    urlPublica: 'https://origem.test',
  });

  return {
    service,
    tokens,
    emails,
    estadoUsuario,
    avancarMinutos(minutos: number) {
      agora = new Date(agora.getTime() + minutos * 60_000);
    },
  };
}

function tokenDoLink(email: EmailRecuperacaoInput): string {
  const token = new URL(email.urlRedefinicao).searchParams.get('token');
  assert.ok(token);
  return token;
}

describe('HU-02 · serviço de recuperação de senha', () => {
  it('Cenário 1: gera token de 30 minutos, guarda só o hash e enfileira o e-mail com o link', async () => {
    const { service, tokens, emails } = cenario();
    await service.solicitar('  MARIA@email.com ');

    assert.equal(tokens.length, 1);
    assert.equal(emails.length, 1);
    const email = emails[0]!;
    const token = tokenDoLink(email);

    assert.equal(tokens[0]!.tokenHash, hashTokenRecuperacao(token));
    assert.notEqual(tokens[0]!.tokenHash, token);
    assert.equal(
      tokens[0]!.expiraEm.toISOString(),
      new Date(Date.parse('2026-11-24T12:00:00.000Z') + VALIDADE_TOKEN_RECUPERACAO_MINUTOS * 60_000).toISOString(),
    );
    assert.ok(email.urlRedefinicao.startsWith('https://origem.test/redefinir-senha?token='));
    assert.equal(email.usuario.email, usuario.email);
    assert.equal(email.validadeMinutos, 30);
  });

  it('Cenário 2: e-mail sem conta não gera token nem e-mail e não lança erro', async () => {
    const { service, tokens, emails } = cenario();
    await service.solicitar('ninguem@email.com');
    assert.equal(tokens.length, 0);
    assert.equal(emails.length, 0);
  });

  it('Cenário 3: redefine a senha com hash, consome o token e marca o encerramento das sessões', async () => {
    const { service, emails, estadoUsuario } = cenario();
    await service.solicitar(usuario.email);
    const token = tokenDoLink(emails[0]!);

    await service.redefinir(token, 'NovaSenha@2026');

    assert.equal(estadoUsuario.senhaHash, 'hash(NovaSenha@2026)');
    assert.ok(estadoUsuario.sessoesValidasDesde);
    await assert.rejects(
      service.redefinir(token, 'OutraSenha@2026'),
      (err: unknown) => err instanceof AppError && err.code === 'TOKEN_RECUPERACAO_INVALIDO',
    );
    assert.equal(estadoUsuario.senhaHash, 'hash(NovaSenha@2026)');
  });

  it('recusa token expirado depois de 30 minutos', async () => {
    const { service, emails, estadoUsuario, avancarMinutos } = cenario();
    await service.solicitar(usuario.email);
    avancarMinutos(30);

    await assert.rejects(
      service.redefinir(tokenDoLink(emails[0]!), 'NovaSenha@2026'),
      (err: unknown) => err instanceof AppError && err.statusCode === 400,
    );
    assert.equal(estadoUsuario.senhaHash, 'hash-antigo');
  });

  it('um novo pedido invalida o link anterior', async () => {
    const { service, emails } = cenario();
    await service.solicitar(usuario.email);
    await service.solicitar(usuario.email);

    await assert.rejects(service.redefinir(tokenDoLink(emails[0]!), 'NovaSenha@2026'), AppError);
    await service.redefinir(tokenDoLink(emails[1]!), 'NovaSenha@2026');
  });
});
