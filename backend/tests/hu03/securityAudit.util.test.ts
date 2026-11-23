import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  consoleSecurityAuditSink,
  createSecurityAuditService,
  projectSafeAuditEvent,
  sanitizeAuditPath,
  type SecurityAuditEvent,
} from '../../src/utils/securityAudit.util.js';

describe('Etapa C3 — Serviço de auditoria estruturada de segurança', () => {
  it('classifica eventos e preenche todos os campos obrigatórios sem expor dados extras', async () => {
    const recorded: SecurityAuditEvent[] = [];
    const audit = createSecurityAuditService({
      record(event) {
        recorded.push(event);
      },
    });

    const evFinancial = await audit.recordAuthorizationDenial({
      correlationId: 'corr-abc12345',
      userId: 'user-curador-1',
      atelieId: 'atelie-01',
      operation: 'ALTERAR_CHAVE_PIX',
      reason: 'CURATOR_FINANCIAL_BLOCK',
      httpMethod: 'patch',
      path: '/api/v1/atelies/atelie-01/chave-pix?debugPix=52998224725\r\nINJECT',
    });

    const evCuratorMgmt = await audit.recordAuthorizationDenial({
      correlationId: 'corr-def67890',
      userId: 'user-curador-1',
      atelieId: 'atelie-01',
      operation: 'GERENCIAR_CURADORES',
      reason: 'CURATOR_GOVERNANCE_BLOCK',
      httpMethod: 'POST',
      path: '/api/v1/atelies/atelie-01/curadores',
    });

    const evCatalog = await audit.recordAuthorizationDenial({
      correlationId: 'corr-ghi11111',
      userId: 'user-curador-1',
      atelieId: 'atelie-suspenso',
      operation: 'GERENCIAR_CATALOGO',
      reason: 'ATELIER_SUSPENDED_FOR_CURATOR',
      httpMethod: 'POST',
      path: '/api/v1/atelies/atelie-suspenso/catalogo',
    });

    assert.equal(recorded.length, 3);
    assert.equal(evFinancial.eventType, 'FINANCIAL_ACCESS_DENIED');
    assert.equal(evFinancial.decision, 'DENY');
    assert.equal(evFinancial.httpMethod, 'PATCH');
    assert.equal(evFinancial.path, '/api/v1/atelies/atelie-01/chave-pix');
    assert.match(evFinancial.timestamp, /^\d{4}-\d{2}-\d{2}T/);

    assert.equal(evCuratorMgmt.eventType, 'CURATOR_MANAGEMENT_DENIED');
    assert.equal(evCatalog.eventType, 'ATELIER_AUTHORIZATION_DENIED');
  });

  it('projeta estritamente allowlist no sink padrão descartando segredos acidentais', () => {
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const unsafeExtendedEvent = {
        eventType: 'FINANCIAL_ACCESS_DENIED',
        timestamp: '2026-11-18T20:00:00.000Z',
        correlationId: 'corr-12345678',
        userId: 'user-1',
        atelieId: 'atelie-1',
        operation: 'ALTERAR_CHAVE_PIX',
        decision: 'DENY',
        reason: 'CURATOR_FINANCIAL_BLOCK',
        httpMethod: 'PATCH',
        path: '/api/v1/atelies/atelie-1/chave-pix?chavePix=52998224725',
        chavePix: '52998224725',
        authorization: 'Bearer SUPER_SECRET_JWT',
        cookie: 'session=SECRET_COOKIE',
        body: { chavePix: '52998224725' },
      } as unknown as SecurityAuditEvent;

      const projected = projectSafeAuditEvent(unsafeExtendedEvent);
      assert.deepEqual(Object.keys(projected).sort(), [
        'atelieId',
        'correlationId',
        'decision',
        'eventType',
        'httpMethod',
        'operation',
        'path',
        'reason',
        'timestamp',
        'userId',
      ]);

      consoleSecurityAuditSink.record(unsafeExtendedEvent);
    } finally {
      console.warn = originalWarn;
    }

    const serialized = JSON.stringify(warnings);
    assert.equal(serialized.includes('[SECURITY_AUDIT]'), true);
    assert.equal(serialized.includes('52998224725'), false);
    assert.equal(serialized.includes('SUPER_SECRET_JWT'), false);
    assert.equal(serialized.includes('SECRET_COOKIE'), false);
  });

  it('sanitiza paths vazios e contém falha no sink sem propagar exceção', async () => {
    assert.equal(sanitizeAuditPath('?token=123\r\n'), '/');

    const errors: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };

    try {
      const resilientAudit = createSecurityAuditService({
        record() {
          throw new Error('Falha simulada no sink contendo SEGREDOS_NAO_LOGAVEIS');
        },
      });

      const event = await resilientAudit.recordAuthorizationDenial({
        correlationId: 'corr-sink-err1',
        userId: 'u1',
        atelieId: 'a1',
        operation: 'ALTERAR_CHAVE_PIX',
        reason: 'CURATOR_FINANCIAL_BLOCK',
        httpMethod: 'PATCH',
        path: '/api/v1/atelies/a1/chave-pix',
      });

      assert.equal(event.decision, 'DENY');
    } finally {
      console.error = originalError;
    }

    const logged = JSON.stringify(errors);
    assert.equal(logged.includes('corr-sink-err1'), true);
    assert.equal(logged.includes('SEGREDOS_NAO_LOGAVEIS'), false);
  });
});
