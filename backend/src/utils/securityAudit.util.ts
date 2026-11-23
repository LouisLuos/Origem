import type { OperacaoAtelie } from '../repositories/contracts/hu03.contracts.js';
import { prismaSecurityAuditSink } from '../repositories/prismaSecurityAudit.sink.js';

/**
 * Serviço de auditoria estruturada de segurança da .
 *
 * Persistência durável: a instância padrão grava cada evento na tabela somente-inserção
 * `auditoria_seguranca` (PostgreSQL). Se a gravação falhar, o evento é emitido no log estruturado
 * como contingência, sem reverter o bloqueio.
 */

export type SecurityAuditEventType =
  | 'FINANCIAL_ACCESS_DENIED'
  | 'CURATOR_MANAGEMENT_DENIED'
  | 'ATELIER_AUTHORIZATION_DENIED';

export type SecurityAuditDecision = 'DENY' | 'ALLOW';

export type SecurityAuditReason =
  | 'UNAUTHENTICATED'
  | 'NO_ATELIER_LINK'
  | 'CURATOR_FINANCIAL_BLOCK'
  | 'CURATOR_GOVERNANCE_BLOCK'
  | 'NOT_ATELIER_OWNER'
  | 'ATELIER_SUSPENDED_FOR_CURATOR'
  | 'OPERATION_NOT_ALLOWED';

export interface SecurityAuditEvent {
  readonly eventType: SecurityAuditEventType;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly userId: string;
  readonly atelieId: string;
  readonly operation: OperacaoAtelie;
  readonly decision: SecurityAuditDecision;
  readonly reason: SecurityAuditReason;
  readonly httpMethod: string;
  readonly path: string;
}

export interface AuthorizationDenialAuditInput {
  readonly correlationId: string;
  readonly userId: string;
  readonly atelieId: string;
  readonly operation: OperacaoAtelie;
  readonly reason: SecurityAuditReason;
  readonly httpMethod: string;
  readonly path: string;
}

export interface SecurityAuditSink {
  record(event: SecurityAuditEvent): Promise<void> | void;
}

export interface SecurityAuditService {
  recordAuthorizationDenial(input: AuthorizationDenialAuditInput): Promise<SecurityAuditEvent>;
}

/**
 * Remove query strings (que poderiam carregar tokens/dados) e caracteres de controle do caminho.
 */
export function sanitizeAuditPath(rawPath: string): string {
  const withoutQuery = rawPath.split('?')[0] ?? '';
  const cleaned = withoutQuery.replace(/[\r\n\x00-\x1f\x7f]/g, '').trim();
  return cleaned || '/';
}

/**
 * Projeta estritamente os 10 campos permitidos no evento de auditoria (allowlist fechada),
 * impedindo que propriedades extras contendo Chave Pix, tokens, cookies ou payloads vazem no log.
 */
export function projectSafeAuditEvent(event: SecurityAuditEvent): SecurityAuditEvent {
  return {
    eventType: event.eventType,
    timestamp: event.timestamp,
    correlationId: event.correlationId,
    userId: event.userId,
    atelieId: event.atelieId,
    operation: event.operation,
    decision: event.decision,
    reason: event.reason,
    httpMethod: String(event.httpMethod).replace(/[\r\n\x00-\x1f\x7f]/g, '').toUpperCase(),
    path: sanitizeAuditPath(event.path),
  };
}

function classifyDenialEventType(operation: OperacaoAtelie): SecurityAuditEventType {
  if (operation === 'ALTERAR_CHAVE_PIX' || operation === 'CONSULTAR_DADOS_FINANCEIROS') {
    return 'FINANCIAL_ACCESS_DENIED';
  }
  if (operation === 'GERENCIAR_CURADORES') {
    return 'CURATOR_MANAGEMENT_DENIED';
  }
  return 'ATELIER_AUTHORIZATION_DENIED';
}

/**
 * Sink padrão estruturado via stdout/stderr (`console.warn`).
 * Não substitui persistência durável futura de auditoria em banco.
 */
export const consoleSecurityAuditSink: SecurityAuditSink = {
  record(event: SecurityAuditEvent): void {
    console.warn('[SECURITY_AUDIT]', JSON.stringify(projectSafeAuditEvent(event)));
  },
};

/**
 * Sink durável com contingência: tenta o sink primário (banco) e, em falha, registra o evento no
 * log estruturado para que nenhuma negação de acesso fique sem rastro.
 */
export function createDurableSecurityAuditSink(
  primario: SecurityAuditSink,
  contingencia: SecurityAuditSink = consoleSecurityAuditSink,
): SecurityAuditSink {
  return {
    async record(event: SecurityAuditEvent): Promise<void> {
      try {
        await primario.record(event);
      } catch {
        console.error('[SECURITY_AUDIT_PERSISTENCE_ERROR]', JSON.stringify({ correlationId: event.correlationId }));
        await contingencia.record(event);
      }
    },
  };
}

export function createSecurityAuditService(
  sink: SecurityAuditSink = consoleSecurityAuditSink,
): SecurityAuditService {
  return {
    async recordAuthorizationDenial(
      input: AuthorizationDenialAuditInput,
    ): Promise<SecurityAuditEvent> {
      const safeEvent = projectSafeAuditEvent({
        eventType: classifyDenialEventType(input.operation),
        timestamp: new Date().toISOString(),
        correlationId: input.correlationId,
        userId: input.userId,
        atelieId: input.atelieId,
        operation: input.operation,
        decision: 'DENY',
        reason: input.reason,
        httpMethod: input.httpMethod,
        path: input.path,
      });

      try {
        await sink.record(safeEvent);
      } catch {
        // Falha no sink de auditoria não deve reverter o bloqueio nem vazar contexto sensível
        console.error(
          '[SECURITY_AUDIT_SINK_ERROR]',
          JSON.stringify({
            correlationId: safeEvent.correlationId,
            eventType: safeEvent.eventType,
          }),
        );
      }

      return safeEvent;
    },
  };
}

export const securityAuditService: SecurityAuditService = createSecurityAuditService(
  createDurableSecurityAuditSink(prismaSecurityAuditSink),
);
