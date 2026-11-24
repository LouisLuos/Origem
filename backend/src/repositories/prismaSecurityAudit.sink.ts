import { prisma } from '../config/database.js';
import type { SecurityAuditEvent, SecurityAuditSink } from '../utils/securityAudit.util.js';

/** Limita o texto ao tamanho da coluna para que um valor longo nunca impeça o registro. */
function limitar(valor: string, maximo: number): string {
  return valor.length > maximo ? valor.slice(0, maximo) : valor;
}

/**
 * Sink durável da auditoria de segurança: grava o evento já projetado pela
 * allowlist (`projectSafeAuditEvent`) na tabela somente-inserção `auditoria_seguranca`.
 */
export const prismaSecurityAuditSink: SecurityAuditSink = {
  async record(event: SecurityAuditEvent): Promise<void> {
    await prisma.auditoriaSeguranca.create({
      data: {
        tipoEvento: event.eventType,
        decisao: event.decision,
        motivo: event.reason,
        operacao: event.operation,
        usuarioId: limitar(event.userId, 100),
        atelieId: limitar(event.atelieId, 100),
        correlationId: limitar(event.correlationId, 128),
        metodoHttp: limitar(event.httpMethod, 10),
        caminho: limitar(event.path, 512),
        ocorridoEm: new Date(event.timestamp),
      },
    });
  },
};
