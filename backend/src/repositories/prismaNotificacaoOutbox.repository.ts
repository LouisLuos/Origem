import { prisma } from '../config/database.js';
import type {
  NotificacaoOutboxRepository,
  OutboxEventoNotificacao,
  RegistrarOutboxEventoInput,
  TipoEventoOutboxNotificacao,
} from './contracts/notificacaoOutbox.contracts.js';
import type { PrismaTransactionClient } from './prismaReserva.repository.js';
import { sanitizarErroProvedor } from '../utils/notificationPrivacy.util.js';

/**
 * Implementação PostgreSQL/Prisma do padrão Outbox Transacional (HU-10 -> HU-17).
 * Garante gravação atômica na mesma transação ACID da confirmação de pagamento e drenagem
 * idempotente para o BullMQ sem perda de eventos caso o Redis oscile.
 */
export function createPrismaNotificacaoOutboxRepository(): NotificacaoOutboxRepository {
  return {
    async registrarNaMesmaTransacao(tx: unknown, evento: RegistrarOutboxEventoInput): Promise<void> {
      const prismaTx = tx as PrismaTransactionClient;
      await prismaTx.$queryRaw`
        INSERT INTO "outbox_eventos_notificacao" (
          "tipo_evento",
          "aggregate_id",
          "idempotency_key",
          "payload",
          "status"
        ) VALUES (
          ${evento.tipoEvento},
          ${evento.aggregateId}::uuid,
          ${evento.idempotencyKey},
          ${JSON.stringify(evento.payload)}::jsonb,
          'PENDENTE'::"StatusEventoOutbox"
        )
        ON CONFLICT ("idempotency_key") DO NOTHING
      `;
    },

    async listarPendentes(limite = 50): Promise<OutboxEventoNotificacao[]> {
      const rows = await prisma.outboxEventoNotificacao.findMany({
        where: {
          status: { in: ['PENDENTE', 'FALHA'] },
        },
        orderBy: { criadoEm: 'asc' },
        take: Math.max(1, Math.min(200, limite)),
      });

      return rows.map((row) => ({
        id: row.id,
        tipoEvento: row.tipoEvento as TipoEventoOutboxNotificacao,
        aggregateId: row.aggregateId,
        idempotencyKey: row.idempotencyKey,
        payload: row.payload,
        publicadoEm: row.publicadoEm,
        tentativasPublicacao: row.tentativasPublicacao,
        criadoEm: row.criadoEm,
      }));
    },

    async marcarPublicado(id: string, publicadoEm: Date = new Date()): Promise<void> {
      await prisma.outboxEventoNotificacao.update({
        where: { id },
        data: {
          status: 'PUBLICADO',
          publicadoEm,
          erroSanitizado: null,
          atualizadoEm: publicadoEm,
        },
      });
    },

    async registrarFalhaPublicacao(id: string, erroSanitizado: string): Promise<void> {
      await prisma.outboxEventoNotificacao.update({
        where: { id },
        data: {
          status: 'FALHA',
          tentativasPublicacao: { increment: 1 },
          erroSanitizado: sanitizarErroProvedor(erroSanitizado),
          atualizadoEm: new Date(),
        },
      });
    },
  };
}

export const prismaNotificacaoOutboxRepository = createPrismaNotificacaoOutboxRepository();
