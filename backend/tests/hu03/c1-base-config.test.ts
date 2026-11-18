import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  DEV_DEFAULT_JWT_SECRET,
  isValidAes256KeyMaterial,
  parseEnv,
} from '../../src/config/env.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { resolveCorrelationId } from '../../src/middlewares/requestLogger.js';
import {
  HU03_ERROR_CODES,
  unconfiguredAtelieAutorizacaoRepository,
  unconfiguredAtelieFinanceiroRepository,
  unconfiguredAuthIdentityProvider,
  unconfiguredCuradorVinculoRepository,
  unconfiguredHabilitacaoArtesaoRepository,
} from '../../src/repositories/unconfiguredHu03.repository.js';
import { AppError } from '../../src/utils/AppError.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_HEX_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const VALID_BASE64_KEY = Buffer.from(VALID_HEX_KEY, 'hex').toString('base64');
const STRONG_PROD_JWT = 'prod-jwt-secret-with-at-least-32-characters-2026!';

function createMockResponse() {
  const captured: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  } as unknown as Response;
  return { res, captured };
}

describe('Etapa C1 — Correlation ID sanitizado', () => {
  it('mantém X-Request-Id quando atende à whitelist segura', () => {
    assert.equal(resolveCorrelationId('req_2026-abc.123'), 'req_2026-abc.123');
  });

  it('gera UUID v4 quando o cabeçalho está ausente ou fora do formato seguro', () => {
    const invalidInputs: Array<string | string[] | undefined> = [
      undefined,
      '',
      'curto',
      'a'.repeat(65),
      ['req-12345678'],
      'req-12345678\r\nFAKE_LOG_LINE',
      'req 12345678',
      '<script>alert(1)</script>',
    ];

    for (const input of invalidInputs) {
      const resolved = resolveCorrelationId(input);
      assert.match(resolved, UUID_V4_REGEX);
    }
  });
});

describe('Etapa C1 — Validação de ambiente e segredos de produção', () => {
  it('rejeita material de chave AES-256 inválido ou degenerado', () => {
    assert.equal(isValidAes256KeyMaterial(VALID_HEX_KEY), true);
    assert.equal(isValidAes256KeyMaterial(VALID_BASE64_KEY), true);

    assert.equal(isValidAes256KeyMaterial(''), false);
    assert.equal(isValidAes256KeyMaterial('00'.repeat(32)), false);
    assert.equal(isValidAes256KeyMaterial(Buffer.alloc(32, 0xff).toString('base64')), false);
    assert.equal(isValidAes256KeyMaterial('abcd'), false);
    assert.equal(isValidAes256KeyMaterial('0123 4567'.repeat(8)), false);
    // Base64 sem padding canônico / comprimento inválido
    assert.equal(isValidAes256KeyMaterial(VALID_BASE64_KEY.slice(0, -1)), false);
  });

  it('aceita configuração de desenvolvimento sem PIX_ENCRYPTION_KEY definida', () => {
    const result = parseEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/origem',
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.JWT_SECRET, DEV_DEFAULT_JWT_SECRET);
      assert.equal(result.data.PIX_ENCRYPTION_KEY, undefined);
    }
  });

  it('rejeita em desenvolvimento PIX_ENCRYPTION_KEY malformada', () => {
    const result = parseEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/origem',
      PIX_ENCRYPTION_KEY: 'chave-invalida',
    });

    assert.equal(result.success, false);
  });

  it('rejeita em produção o segredo JWT padrão de desenvolvimento', () => {
    const result = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/origem',
      JWT_SECRET: DEV_DEFAULT_JWT_SECRET,
      PIX_ENCRYPTION_KEY: VALID_HEX_KEY,
    });

    assert.equal(result.success, false);
  });

  it('rejeita em produção JWT_SECRET com menos de 32 caracteres', () => {
    const result = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/origem',
      JWT_SECRET: 'segredo-curto-com-19',
      PIX_ENCRYPTION_KEY: VALID_HEX_KEY,
    });

    assert.equal(result.success, false);
  });

  it('rejeita em produção ausência de PIX_ENCRYPTION_KEY', () => {
    const result = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/origem',
      JWT_SECRET: STRONG_PROD_JWT,
    });

    assert.equal(result.success, false);
  });

  it('aceita configuração de produção com JWT forte e PIX_ENCRYPTION_KEY em hex ou base64', () => {
    const hexResult = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/origem',
      JWT_SECRET: STRONG_PROD_JWT,
      PIX_ENCRYPTION_KEY: VALID_HEX_KEY,
    });
    assert.equal(hexResult.success, true);

    const b64Result = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/origem',
      JWT_SECRET: STRONG_PROD_JWT,
      PIX_ENCRYPTION_KEY: VALID_BASE64_KEY,
    });
    assert.equal(b64Result.success, true);
  });
});

describe('Etapa C1 — AppError e errorHandler', () => {
  const noopNext: NextFunction = () => undefined;

  it('preserva payload simples quando AppError não define code', () => {
    const req = { correlationId: 'corr-12345678' } as unknown as Request;
    const { res, captured } = createMockResponse();

    errorHandler(new AppError('Recurso não encontrado.', 404), req, res, noopNext);

    assert.equal(captured.statusCode, 404);
    assert.deepEqual(captured.body, { erro: 'Recurso não encontrado.' });
  });

  it('inclui codigo quando AppError define code', () => {
    const req = { correlationId: 'corr-12345678' } as unknown as Request;
    const { res, captured } = createMockResponse();

    errorHandler(
      new AppError('Persistência indisponível.', 503, HU03_ERROR_CODES.PERSISTENCIA_INDISPONIVEL),
      req,
      res,
      noopNext,
    );

    assert.equal(captured.statusCode, 503);
    assert.deepEqual(captured.body, {
      erro: 'Persistência indisponível.',
      codigo: 'PERSISTENCIA_INDISPONIVEL',
    });
  });

  it('retorna 400 para ZodError mantendo o contrato existente', () => {
    const req = {} as Request;
    const { res, captured } = createMockResponse();
    const parsed = z.object({ nome: z.string().min(3, 'Nome muito curto') }).safeParse({ nome: 'a' });
    assert.equal(parsed.success, false);

    errorHandler(parsed.error, req, res, noopNext);

    assert.equal(captured.statusCode, 400);
    assert.deepEqual(captured.body, { erro: 'Dados inválidos: Nome muito curto' });
  });

  it('loga erros inesperados de forma sanitizada sem vazar objetos crus', () => {
    const req = { correlationId: 'corr-99999999' } as unknown as Request;
    const { res, captured } = createMockResponse();
    const loggedArgs: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      loggedArgs.push(args);
    };

    try {
      errorHandler({ secretToken: 'SENSITIVE_TOKEN', pixKey: '12345678909' }, req, res, noopNext);
    } finally {
      console.error = originalError;
    }

    assert.equal(captured.statusCode, 500);
    assert.deepEqual(captured.body, {
      erro: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
    });
    const serializedLog = JSON.stringify(loggedArgs);
    assert.equal(serializedLog.includes('SENSITIVE_TOKEN'), false);
    assert.equal(serializedLog.includes('12345678909'), false);
    assert.equal(serializedLog.includes('corr-99999999'), true);
  });
});

describe('Etapa C1 — Adaptadores fail-closed (sem HU-01 e sem T-ART-01)', () => {
  it('unconfiguredAuthIdentityProvider retorna PROVIDER_UNAVAILABLE mesmo com credencial enviada', async () => {
    const verification = await unconfiguredAuthIdentityProvider.verify({
      bearerToken: 'qualquer.token.aqui',
      cookieHeader: 'session=abc',
    });

    assert.equal(verification.status, 'PROVIDER_UNAVAILABLE');
  });

  it('todos os repositórios não configurados rejeitam com HTTP 503 e código PERSISTENCIA_INDISPONIVEL', async () => {
    const calls: Array<() => Promise<unknown>> = [
      () => unconfiguredHabilitacaoArtesaoRepository.findUsuarioPorId('u1'),
      () => unconfiguredHabilitacaoArtesaoRepository.findArtesaoPorUsuarioId('u1'),
      () =>
        unconfiguredHabilitacaoArtesaoRepository.habilitarArtesaoComPapel({
          usuarioId: 'u1',
          biografiaCultural: 'Biografia cultural pernambucana',
          tipoChavePix: 'EVP',
          chavePixCriptografada: crypto.randomBytes(16).toString('base64'),
        }),
      () => unconfiguredAtelieAutorizacaoRepository.findRelacionamentoUsuarioAtelie('u1', 'a1'),
      () => unconfiguredAtelieAutorizacaoRepository.listRelacionamentosUsuario('u1'),
      () => unconfiguredAtelieFinanceiroRepository.findDadosFinanceirosPorAtelie('a1'),
      () =>
        unconfiguredAtelieFinanceiroRepository.atualizarChavePixCriptografada(
          'a1',
          'cipher',
          'EVP',
        ),
      () => unconfiguredCuradorVinculoRepository.findUsuarioPorEmail('teste@origem.com'),
      () => unconfiguredCuradorVinculoRepository.findVinculo('a1', 'u2'),
      () => unconfiguredCuradorVinculoRepository.listVinculosPorAtelie('a1'),
      () => unconfiguredCuradorVinculoRepository.vincularCuradorNoAtelie('a1', 'u2'),
      () => unconfiguredCuradorVinculoRepository.desvincularCuradorDoAtelie('a1', 'u2'),
    ];

    for (const call of calls) {
      await assert.rejects(call, (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 503);
        assert.equal(err.code, HU03_ERROR_CODES.PERSISTENCIA_INDISPONIVEL);
        return true;
      });
    }
  });
});
