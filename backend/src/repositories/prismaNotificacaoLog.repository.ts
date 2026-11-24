import { prisma } from '../config/database.js';
import type {
  CanalNotificacao,
  GarantirLogNotificacaoInput,
  GarantirLogNotificacaoResultado,
  LogNotificacaoPersistido,
  NotificacaoLogRepository,
  ResumoMonitoramentoNotificacoes,
  StatusNotificacao,
} from './contracts/notificacoes.contracts.js';

interface LogNotificacaoRow {
  readonly id: string;
  readonly evento_origem: string;
  readonly pedido_id: string | null;
  readonly subpedido_id: string | null;
  readonly usuario_id: string | null;
  readonly atelie_id: string | null;
  readonly destinatario: string;
  readonly canal: CanalNotificacao;
  readonly template: string;
  readonly status: StatusNotificacao;
  readonly tentativas: number;
  readonly max_tentativas: number;
  readonly provedor: string | null;
  readonly provedor_mensagem_id: string | null;
  readonly erro_codigo: string | null;
  readonly erro_sanitizado: string | null;
  readonly idempotency_key: string;
  readonly job_id: string | null;
  readonly correlation_id: string | null;
  readonly criado_em: Date;
  readonly ultima_tentativa_em: Date | null;
  readonly proxima_tentativa_em: Date | null;
  readonly enviado_em: Date | null;
  readonly atualizado_em: Date;
}

function mapRow(row: LogNotificacaoRow): LogNotificacaoPersistido {
  return {
    id: row.id,
    eventoOrigem: row.evento_origem,
    pedidoId: row.pedido_id,
    subpedidoId: row.subpedido_id,
    usuarioId: row.usuario_id,
    atelieId: row.atelie_id,
    destinatario: row.destinatario,
    canal: row.canal,
    template: row.template,
    status: row.status,
    tentativas: row.tentativas,
    maxTentativas: row.max_tentativas,
    provedor: row.provedor,
    provedorMensagemId: row.provedor_mensagem_id,
    erroCodigo: row.erro_codigo,
    erroSanitizado: row.erro_sanitizado,
    idempotencyKey: row.idempotency_key,
    jobId: row.job_id,
    correlationId: row.correlation_id,
    criadoEm: row.criado_em,
    ultimaTentativaEm: row.ultima_tentativa_em,
    proximaTentativaEm: row.proxima_tentativa_em,
    enviadoEm: row.enviado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export function createPrismaNotificacaoLogRepository(): NotificacaoLogRepository {
  return {
    async garantirRegistroIdempotente(
      input: GarantirLogNotificacaoInput,
    ): Promise<GarantirLogNotificacaoResultado> {
      const statusInicial = input.statusInicial ?? 'ENFILEIRADA';
      const erroCodigo = statusInicial === 'IGNORADA' ? (input.motivoIgnoradaCodigo ?? null) : null;
      const erroSanitizado =
        statusInicial === 'IGNORADA' ? (input.motivoIgnoradaSanitizado ?? null) : null;

      const inseridos = await prisma.$queryRaw<LogNotificacaoRow[]>`
        INSERT INTO "logs_notificacoes" (
          "evento_origem",
          "pedido_id",
          "subpedido_id",
          "usuario_id",
          "atelie_id",
          "destinatario",
          "canal",
          "template",
          "status",
          "tentativas",
          "max_tentativas",
          "erro_codigo",
          "erro_sanitizado",
          "idempotency_key",
          "correlation_id"
        ) VALUES (
          ${input.eventoOrigem},
          ${input.pedidoId ?? null}::uuid,
          ${input.subpedidoId ?? null}::uuid,
          ${input.usuarioId ?? null}::uuid,
          ${input.atelieId ?? null}::uuid,
          ${input.destinatarioMascarado},
          ${input.canal}::"CanalNotificacao",
          ${input.template},
          ${statusInicial}::"StatusNotificacao",
          0,
          ${input.maxTentativas},
          ${erroCodigo},
          ${erroSanitizado},
          ${input.idempotencyKey},
          ${input.correlationId ?? null}
        )
        ON CONFLICT ("idempotency_key") DO NOTHING
        RETURNING *
      `;

      if (inseridos.length > 0) {
        return {
          log: mapRow(inseridos[0]),
          criado: true,
        };
      }

      const existente = await prisma.$queryRaw<LogNotificacaoRow[]>`
        SELECT * FROM "logs_notificacoes"
        WHERE "idempotency_key" = ${input.idempotencyKey}
        LIMIT 1
      `;

      if (existente.length === 0) {
        throw new Error('Falha ao localizar registro idempotente em logs_notificacoes.');
      }

      return {
        log: mapRow(existente[0]),
        criado: false,
      };
    },

    async vincularJobId(id: string, jobId: string): Promise<void> {
      await prisma.$executeRaw`
        UPDATE "logs_notificacoes"
        SET "job_id" = COALESCE("job_id", ${jobId}),
            "atualizado_em" = NOW()
        WHERE "id" = ${id}::uuid
      `;
    },

    async marcarProcessando(id: string, tentativa: number, agora = new Date()) {
      const atualizados = await prisma.$queryRaw<LogNotificacaoRow[]>`
        UPDATE "logs_notificacoes"
        SET "status" = 'PROCESSANDO'::"StatusNotificacao",
            "tentativas" = LEAST("max_tentativas", GREATEST("tentativas", ${tentativa})),
            "ultima_tentativa_em" = ${agora},
            "proxima_tentativa_em" = NULL,
            "atualizado_em" = ${agora}
        WHERE "id" = ${id}::uuid
          AND "status" NOT IN ('ENVIADA'::"StatusNotificacao", 'IGNORADA'::"StatusNotificacao")
        RETURNING *
      `;

      if (atualizados.length > 0) {
        return {
          podeProcessar: true,
          log: mapRow(atualizados[0]),
        };
      }

      const atual = await this.buscarPorId(id);
      return {
        podeProcessar: false,
        log: atual,
      };
    },

    async marcarEnviada(id, dados) {
      const enviadoEm = dados.enviadoEm ?? new Date();
      const atualizados = await prisma.$queryRaw<LogNotificacaoRow[]>`
        UPDATE "logs_notificacoes"
        SET "status" = 'ENVIADA'::"StatusNotificacao",
            "tentativas" = GREATEST("tentativas", 1),
            "ultima_tentativa_em" = COALESCE("ultima_tentativa_em", ${enviadoEm}),
            "enviado_em" = ${enviadoEm},
            "proxima_tentativa_em" = NULL,
            "provedor" = ${dados.provedor},
            "provedor_mensagem_id" = ${dados.provedorMensagemId},
            "erro_codigo" = NULL,
            "erro_sanitizado" = NULL,
            "atualizado_em" = ${enviadoEm}
        WHERE "id" = ${id}::uuid
        RETURNING *
      `;

      if (atualizados.length === 0) {
        throw new Error(`Log de notificação ${id} não encontrado ao marcar envio.`);
      }

      return mapRow(atualizados[0]);
    },

    async marcarFalhaTransitoria(id, dados) {
      const agora = new Date();
      const atualizados = await prisma.$queryRaw<LogNotificacaoRow[]>`
        UPDATE "logs_notificacoes"
        SET "status" = 'FALHA_TRANSITORIA'::"StatusNotificacao",
            "tentativas" = GREATEST("tentativas", 1),
            "ultima_tentativa_em" = COALESCE("ultima_tentativa_em", ${agora}),
            "proxima_tentativa_em" = ${dados.proximaTentativaEm},
            "enviado_em" = NULL,
            "erro_codigo" = ${dados.erroCodigo},
            "erro_sanitizado" = ${dados.erroSanitizado},
            "atualizado_em" = ${agora}
        WHERE "id" = ${id}::uuid
        RETURNING *
      `;

      if (atualizados.length === 0) {
        throw new Error(`Log de notificação ${id} não encontrado ao registrar falha transitória.`);
      }

      return mapRow(atualizados[0]);
    },

    async marcarFalhaPermanente(id, dados) {
      const agora = new Date();
      const atualizados = await prisma.$queryRaw<LogNotificacaoRow[]>`
        UPDATE "logs_notificacoes"
        SET "status" = 'FALHA_PERMANENTE'::"StatusNotificacao",
            "tentativas" = GREATEST("tentativas", 1),
            "ultima_tentativa_em" = COALESCE("ultima_tentativa_em", ${agora}),
            "proxima_tentativa_em" = NULL,
            "enviado_em" = NULL,
            "provedor" = COALESCE(${dados.provedor ?? null}, "provedor"),
            "erro_codigo" = ${dados.erroCodigo},
            "erro_sanitizado" = ${dados.erroSanitizado},
            "atualizado_em" = ${agora}
        WHERE "id" = ${id}::uuid
        RETURNING *
      `;

      if (atualizados.length === 0) {
        throw new Error(`Log de notificação ${id} não encontrado ao registrar falha permanente.`);
      }

      return mapRow(atualizados[0]);
    },

    async marcarIgnorada(id, dados) {
      const agora = new Date();
      const atualizados = await prisma.$queryRaw<LogNotificacaoRow[]>`
        UPDATE "logs_notificacoes"
        SET "status" = 'IGNORADA'::"StatusNotificacao",
            "proxima_tentativa_em" = NULL,
            "enviado_em" = NULL,
            "erro_codigo" = ${dados.erroCodigo},
            "erro_sanitizado" = ${dados.erroSanitizado},
            "atualizado_em" = ${agora}
        WHERE "id" = ${id}::uuid
        RETURNING *
      `;

      if (atualizados.length === 0) {
        throw new Error(`Log de notificação ${id} não encontrado ao marcar ignorada.`);
      }

      return mapRow(atualizados[0]);
    },

    async buscarPorId(id) {
      const rows = await prisma.$queryRaw<LogNotificacaoRow[]>`
        SELECT * FROM "logs_notificacoes"
        WHERE "id" = ${id}::uuid
        LIMIT 1
      `;
      return rows[0] ? mapRow(rows[0]) : null;
    },

    async buscarPorIdempotencyKey(idempotencyKey) {
      const rows = await prisma.$queryRaw<LogNotificacaoRow[]>`
        SELECT * FROM "logs_notificacoes"
        WHERE "idempotency_key" = ${idempotencyKey}
        LIMIT 1
      `;
      return rows[0] ? mapRow(rows[0]) : null;
    },

    async listarPorUsuario(usuarioId, limite = 50) {
      const limiteSeguro = Math.min(Math.max(1, Math.trunc(limite)), 100);
      const rows = await prisma.$queryRaw<LogNotificacaoRow[]>`
        SELECT * FROM "logs_notificacoes"
        WHERE "usuario_id" = ${usuarioId}::uuid
        ORDER BY "criado_em" DESC
        LIMIT ${limiteSeguro}
      `;
      return rows.map(mapRow);
    },

    async listarPorPedido(pedidoId) {
      const rows = await prisma.$queryRaw<LogNotificacaoRow[]>`
        SELECT * FROM "logs_notificacoes"
        WHERE "pedido_id" = ${pedidoId}::uuid
        ORDER BY "criado_em" ASC
      `;
      return rows.map(mapRow);
    },

    async listarPorSubpedido(subpedidoId) {
      const rows = await prisma.$queryRaw<LogNotificacaoRow[]>`
        SELECT * FROM "logs_notificacoes"
        WHERE "subpedido_id" = ${subpedidoId}::uuid
        ORDER BY "criado_em" ASC
      `;
      return rows.map(mapRow);
    },

    async obterResumoMonitoramento(): Promise<ResumoMonitoramentoNotificacoes> {
      const rows = await prisma.$queryRaw<
        Array<{
          total: number;
          enfileiradas: number;
          processando: number;
          enviadas: number;
          falhas_transitorias: number;
          falhas_permanentes: number;
          ignoradas: number;
        }>
      >`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "status" = 'ENFILEIRADA')::int AS enfileiradas,
          COUNT(*) FILTER (WHERE "status" = 'PROCESSANDO')::int AS processando,
          COUNT(*) FILTER (WHERE "status" = 'ENVIADA')::int AS enviadas,
          COUNT(*) FILTER (WHERE "status" = 'FALHA_TRANSITORIA')::int AS falhas_transitorias,
          COUNT(*) FILTER (WHERE "status" = 'FALHA_PERMANENTE')::int AS falhas_permanentes,
          COUNT(*) FILTER (WHERE "status" = 'IGNORADA')::int AS ignoradas
        FROM "logs_notificacoes"
      `;

      const row = rows[0];
      return {
        total: row?.total ?? 0,
        enfileiradas: row?.enfileiradas ?? 0,
        processando: row?.processando ?? 0,
        enviadas: row?.enviadas ?? 0,
        falhasTransitorias: row?.falhas_transitorias ?? 0,
        falhasPermanentes: row?.falhas_permanentes ?? 0,
        ignoradas: row?.ignoradas ?? 0,
      };
    },
  };
}

export const prismaNotificacaoLogRepository = createPrismaNotificacaoLogRepository();
