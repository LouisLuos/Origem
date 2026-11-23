import { prisma } from '../config/database.js';
import type { StatusPeca } from './contracts/pecas.contracts.js';
import {
  RESERVA_ERROR_CODES,
  RESERVA_TTL_MINUTOS,
  RESERVA_TTL_MS,
  type CancelamentoReservaResultado,
  type ConfirmacaoReservaResultado,
  type CriarGrupoReservaInput,
  type ExpiracaoReservasResultado,
  type GrupoReservaResultado,
  type PedidoVinculadoReservaResumo,
  type ReservaEstoqueRepository,
  type ReservaItemPersistido,
  type StatusPedidoVinculadoReserva,
  type StatusReserva,
} from './contracts/reservas.contracts.js';
import { AppError } from '../utils/AppError.js';
import { isUuid } from '../utils/uuid.util.js';

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type { PrismaTransactionClient };

export interface PrismaReservaDbClient {
  $transaction<T>(
    fn: (tx: PrismaTransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
}

export const STATUS_PEDIDOS_ATIVOS_RESERVA: ReadonlySet<StatusPedidoVinculadoReserva> = new Set([
  'PENDENTE_PAGAMENTO',
  'APROVADO',
  'RECONCILIACAO_ESTORNO',
]);

const STATUS_PEDIDOS_ATIVOS_LISTA: StatusPedidoVinculadoReserva[] = [
  'PENDENTE_PAGAMENTO',
  'APROVADO',
  'RECONCILIACAO_ESTORNO',
];

export function ehPedidoAtivoParaReserva(status: string): boolean {
  return STATUS_PEDIDOS_ATIVOS_RESERVA.has(status as StatusPedidoVinculadoReserva);
}

export function resumirPedidoVinculadoReserva(
  pedidos: ReadonlyArray<{ readonly id: string; readonly codigoPedido: string; readonly status: string }>,
): {
  readonly possuiPedidoAtivo: boolean;
  readonly pedidoVinculado: PedidoVinculadoReservaResumo | null;
} {
  if (pedidos.length === 0) {
    return { possuiPedidoAtivo: false, pedidoVinculado: null };
  }

  const ativo = pedidos.find((p) => ehPedidoAtivoParaReserva(p.status));
  const escolhido = ativo ?? pedidos[0]!;
  const ehAtivo = ehPedidoAtivoParaReserva(escolhido.status);

  return {
    possuiPedidoAtivo: ehAtivo,
    pedidoVinculado: {
      pedidoId: escolhido.id,
      codigoPedido: escolhido.codigoPedido,
      status: escolhido.status as StatusPedidoVinculadoReserva,
      ativo: ehAtivo,
    },
  };
}

export function calcularMenorExpiraEmGrupo(
  itens: ReadonlyArray<{ readonly expiraEm: Date }>,
  fallback: Date,
): Date {
  if (itens.length === 0) return fallback;
  let menor = itens[0]!.expiraEm;
  for (let i = 1; i < itens.length; i += 1) {
    if (itens[i]!.expiraEm.getTime() < menor.getTime()) {
      menor = itens[i]!.expiraEm;
    }
  }
  return menor;
}

export interface ItemReservaCheckoutCarregado {
  readonly reservaId: string;
  readonly pecaId: string;
  readonly titulo: string;
  readonly quantidade: number;
  readonly precoUnitarioString: string;
  readonly pesoGramas: number;
  readonly comprimentoCm: number;
  readonly larguraCm: number;
  readonly alturaCm: number;
  readonly isFragil: boolean;
  readonly fotoPrincipalUrl: string | null;
  readonly atelieId: string;
  readonly atelieNome: string;
  readonly poloCultural: string;
  readonly atelieCepOrigem: string | null;
  readonly titularUsuarioId: string;
  readonly titularNome: string;
  readonly titularEmail: string;
  readonly titularWhatsapp: string;
}

export interface GrupoReservaCheckoutCarregado {
  readonly grupoId: string;
  readonly usuarioId: string;
  readonly expiraEm: Date;
  readonly comprador: {
    readonly usuarioId: string;
    readonly nome: string;
    readonly email: string;
    readonly cpfCnpj: string;
    readonly telefoneWhatsapp: string;
  };
  readonly itens: readonly ItemReservaCheckoutCarregado[];
}

export type ConfirmacaoGrupoTransacaoDesfecho =
  | { readonly tipo: 'NAO_ENCONTRADA' }
  | { readonly tipo: 'PROIBIDA' }
  | { readonly tipo: 'EXPIRADA_OU_CANCELADA' }
  | { readonly tipo: 'CONFIRMADA'; readonly resultado: ConfirmacaoReservaResultado };

export type CarregamentoGrupoCheckoutDesfecho =
  | { readonly tipo: 'EXPIRADA_OU_CANCELADA' }
  | { readonly tipo: 'PRONTA'; readonly grupo: GrupoReservaCheckoutCarregado };

interface PecaLockedRow {
  readonly id: string;
  readonly titulo: string;
  quantidade_estoque: number;
  status: StatusPeca;
}

interface ReservaDbRow {
  readonly id: string;
  readonly grupoId: string;
  readonly usuarioId: string;
  readonly pecaId: string;
  readonly quantidade: number;
  readonly status: string;
  readonly idempotencyKey: string;
  readonly criadoEm: Date;
  readonly expiraEm: Date;
  readonly atualizadoEm: Date;
  readonly finalizadoEm: Date | null;
  readonly estoqueDevolvidoEm: Date | null;
}

interface ExpiredRow {
  readonly peca_id: string;
  readonly quantidade: number;
}

const TX_OPTIONS = {
  maxWait: 25_000,
  timeout: 30_000,
} as const;

const EXPIRATION_BATCH_PECAS_LIMIT = 200;

function mapReservaRow(row: ReservaDbRow): ReservaItemPersistido {
  return {
    id: row.id,
    grupoId: row.grupoId,
    usuarioId: row.usuarioId,
    pecaId: row.pecaId,
    quantidade: row.quantidade,
    status: row.status as StatusReserva,
    idempotencyKey: row.idempotencyKey,
    criadoEm: row.criadoEm.toISOString(),
    expiraEm: row.expiraEm.toISOString(),
    atualizadoEm: row.atualizadoEm.toISOString(),
    finalizadoEm: row.finalizadoEm ? row.finalizadoEm.toISOString() : null,
    estoqueDevolvidoEm: row.estoqueDevolvidoEm ? row.estoqueDevolvidoEm.toISOString() : null,
  };
}

function ordenarPecaIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

async function lockPecasOrdenadas(
  tx: PrismaTransactionClient,
  pecaIdsOrdenados: readonly string[],
): Promise<Map<string, PecaLockedRow>> {
  if (pecaIdsOrdenados.length === 0) {
    return new Map();
  }

  const rows = await tx.$queryRaw<PecaLockedRow[]>`
    SELECT "id", "titulo", "quantidade_estoque", "status"
    FROM "pecas"
    WHERE "id" = ANY(${pecaIdsOrdenados}::uuid[])
    ORDER BY "id" ASC
    FOR UPDATE
  `;

  return new Map(rows.map((row) => [row.id, { ...row }]));
}

async function garantirSemPedidoAtivoParaCancelamento(
  tx: PrismaTransactionClient,
  grupoId: string,
): Promise<void> {
  const pedidoAtivo = await tx.pedido.findFirst({
    where: {
      reservaGrupoId: grupoId,
      status: { in: STATUS_PEDIDOS_ATIVOS_LISTA },
    },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, codigoPedido: true, status: true },
  });

  if (pedidoAtivo) {
    throw new AppError(
      `A reserva está vinculada ao pedido ativo ${pedidoAtivo.codigoPedido} (${pedidoAtivo.status}) e não pode ser cancelada diretamente.`,
      409,
      RESERVA_ERROR_CODES.RESERVA_VINCULADA_A_PEDIDO_ATIVO,
    );
  }
}

/**
 * Expira atomicamente reservas vencidas para peças já travadas por `FOR UPDATE`,
 * devolvendo o saldo apenas para linhas que efetivamente transicionarem de `ATIVA` para `EXPIRADA`.
 */
async function expirarPecasTravadas(
  tx: PrismaTransactionClient,
  pecaIdsOrdenados: readonly string[],
  agora: Date,
  pecasTravadas: Map<string, PecaLockedRow>,
  filtroGrupoIds?: string | readonly string[],
): Promise<{ reservasExpiradas: number; unidadesDevolvidas: number; pecasAtualizadas: number }> {
  if (pecaIdsOrdenados.length === 0) {
    return { reservasExpiradas: 0, unidadesDevolvidas: 0, pecasAtualizadas: 0 };
  }

  const grupoIds =
    filtroGrupoIds === undefined
      ? undefined
      : typeof filtroGrupoIds === 'string'
        ? [filtroGrupoIds]
        : [...filtroGrupoIds];

  if (grupoIds !== undefined && grupoIds.length === 0) {
    return { reservasExpiradas: 0, unidadesDevolvidas: 0, pecasAtualizadas: 0 };
  }

  const expiradas = grupoIds
    ? await tx.$queryRaw<ExpiredRow[]>`
        UPDATE "reservas"
        SET
          "status" = 'EXPIRADA'::"StatusReserva",
          "finalizado_em" = ${agora}::timestamp(3),
          "estoque_devolvido_em" = ${agora}::timestamp(3),
          "atualizado_em" = ${agora}::timestamp(3)
        WHERE "peca_id" = ANY(${pecaIdsOrdenados}::uuid[])
          AND "grupo_id" = ANY(${grupoIds}::uuid[])
          AND "status" = 'ATIVA'::"StatusReserva"
          AND "expira_em" <= ${agora}::timestamp(3)
        RETURNING "peca_id", "quantidade"
      `
    : await tx.$queryRaw<ExpiredRow[]>`
        UPDATE "reservas"
        SET
          "status" = 'EXPIRADA'::"StatusReserva",
          "finalizado_em" = ${agora}::timestamp(3),
          "estoque_devolvido_em" = ${agora}::timestamp(3),
          "atualizado_em" = ${agora}::timestamp(3)
        WHERE "peca_id" = ANY(${pecaIdsOrdenados}::uuid[])
          AND "status" = 'ATIVA'::"StatusReserva"
          AND "expira_em" <= ${agora}::timestamp(3)
        RETURNING "peca_id", "quantidade"
      `;

  if (expiradas.length === 0) {
    return { reservasExpiradas: 0, unidadesDevolvidas: 0, pecasAtualizadas: 0 };
  }

  const creditoPorPeca = new Map<string, number>();
  let unidadesDevolvidas = 0;

  for (const row of expiradas) {
    unidadesDevolvidas += row.quantidade;
    creditoPorPeca.set(row.peca_id, (creditoPorPeca.get(row.peca_id) ?? 0) + row.quantidade);
  }

  const idsCreditados = ordenarPecaIds(Array.from(creditoPorPeca.keys()));
  for (const pecaId of idsCreditados) {
    const incremento = creditoPorPeca.get(pecaId) ?? 0;
    const atualizadas = await tx.$queryRaw<Array<{ quantidade_estoque: number; status: StatusPeca }>>`
      UPDATE "pecas"
      SET
        "quantidade_estoque" = "quantidade_estoque" + ${incremento},
        "status" = CASE
          WHEN "status" = 'RESERVADA'::"StatusPeca" AND ("quantidade_estoque" + ${incremento}) > 0
            THEN 'DISPONIVEL'::"StatusPeca"
          ELSE "status"
        END,
        "atualizado_em" = ${agora}::timestamp(3)
      WHERE "id" = ${pecaId}::uuid
      RETURNING "quantidade_estoque", "status"
    `;

    const pecaMem = pecasTravadas.get(pecaId);
    const updatedRow = atualizadas[0];
    if (pecaMem && updatedRow) {
      pecaMem.quantidade_estoque = updatedRow.quantidade_estoque;
      pecaMem.status = updatedRow.status;
    }
  }

  return {
    reservasExpiradas: expiradas.length,
    unidadesDevolvidas,
    pecasAtualizadas: idsCreditados.length,
  };
}

export async function cancelarGrupoReservaNaTransacao(
  tx: PrismaTransactionClient,
  grupoId: string,
  usuarioId: string,
  agora: Date = new Date(),
  opcoes?: { readonly bloquearSePedidoAtivo?: boolean },
): Promise<CancelamentoReservaResultado> {
  if (!isUuid(grupoId) || !isUuid(usuarioId)) {
    throw new AppError(
      'Identificador de reserva inválido.',
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const grupo = await tx.reservaGrupo.findUnique({
    where: { id: grupoId },
    include: { itens: { orderBy: { pecaId: 'asc' } } },
  });

  if (!grupo) {
    throw new AppError('Grupo de reservas não encontrado.', 404);
  }

  if (grupo.usuarioId !== usuarioId) {
    throw new AppError('Você não tem permissão para cancelar esta reserva.', 403);
  }

  const pecaIdsOrdenados = ordenarPecaIds(grupo.itens.map((item) => item.pecaId));
  await lockPecasOrdenadas(tx, pecaIdsOrdenados);

  if (opcoes?.bloquearSePedidoAtivo) {
    await garantirSemPedidoAtivoParaCancelamento(tx, grupoId);
  }

  const atualizados = await tx.$queryRaw<ExpiredRow[]>`
    UPDATE "reservas"
    SET
      "status" = 'CANCELADA'::"StatusReserva",
      "finalizado_em" = ${agora}::timestamp(3),
      "estoque_devolvido_em" = ${agora}::timestamp(3),
      "atualizado_em" = ${agora}::timestamp(3)
    WHERE "grupo_id" = ${grupoId}::uuid
      AND "usuario_id" = ${usuarioId}::uuid
      AND "status" = 'ATIVA'::"StatusReserva"
    RETURNING "peca_id", "quantidade"
  `;

  let unidadesDevolvidas = 0;
  if (atualizados.length > 0) {
    const creditoPorPeca = new Map<string, number>();
    for (const row of atualizados) {
      unidadesDevolvidas += row.quantidade;
      creditoPorPeca.set(row.peca_id, (creditoPorPeca.get(row.peca_id) ?? 0) + row.quantidade);
    }

    for (const pecaId of ordenarPecaIds(Array.from(creditoPorPeca.keys()))) {
      const incremento = creditoPorPeca.get(pecaId) ?? 0;
      await tx.$queryRaw`
        UPDATE "pecas"
        SET
          "quantidade_estoque" = "quantidade_estoque" + ${incremento},
          "status" = CASE
            WHEN "status" = 'RESERVADA'::"StatusPeca" AND ("quantidade_estoque" + ${incremento}) > 0
              THEN 'DISPONIVEL'::"StatusPeca"
            ELSE "status"
          END,
          "atualizado_em" = ${agora}::timestamp(3)
        WHERE "id" = ${pecaId}::uuid
      `;
    }
  }

  const itensFinais = await tx.reserva.findMany({
    where: { grupoId, usuarioId },
    orderBy: { pecaId: 'asc' },
  });

  if (atualizados.length === 0 && itensFinais.some((item) => item.status === 'CONFIRMADA')) {
    throw new AppError(
      'A reserva já foi confirmada e não pode ser cancelada por esta rota.',
      409,
      RESERVA_ERROR_CODES.RESERVA_TRANSICAO_INVALIDA,
    );
  }

  return {
    grupoId,
    usuarioId,
    jaFinalizada: atualizados.length === 0,
    itensCancelados: atualizados.length,
    unidadesDevolvidas,
    itens: itensFinais.map(mapReservaRow),
  };
}

export async function confirmarGrupoReservaNaTransacao(
  tx: PrismaTransactionClient,
  grupoId: string,
  usuarioId: string,
  agora: Date = new Date(),
): Promise<ConfirmacaoGrupoTransacaoDesfecho> {
  if (!isUuid(grupoId) || !isUuid(usuarioId)) {
    throw new AppError(
      'Identificador de reserva inválido.',
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const grupo = await tx.reservaGrupo.findUnique({
    where: { id: grupoId },
    include: { itens: { orderBy: { pecaId: 'asc' } } },
  });

  if (!grupo) {
    return { tipo: 'NAO_ENCONTRADA' };
  }

  if (grupo.usuarioId !== usuarioId) {
    return { tipo: 'PROIBIDA' };
  }

  const pecaIdsOrdenados = ordenarPecaIds(grupo.itens.map((item) => item.pecaId));
  const pecasTravadas = await lockPecasOrdenadas(tx, pecaIdsOrdenados);

  // Se alguma reserva do grupo já venceu no relógio, efetiva a expiração e devolve o saldo antes de recusar.
  await expirarPecasTravadas(tx, pecaIdsOrdenados, agora, pecasTravadas, grupoId);

  const itensAtuais = await tx.reserva.findMany({
    where: { grupoId, usuarioId },
    orderBy: { pecaId: 'asc' },
  });

  if (itensAtuais.some((item) => item.status === 'CANCELADA' || item.status === 'EXPIRADA')) {
    return { tipo: 'EXPIRADA_OU_CANCELADA' };
  }

  if (itensAtuais.length > 0 && itensAtuais.every((item) => item.status === 'CONFIRMADA')) {
    return {
      tipo: 'CONFIRMADA',
      resultado: {
        grupoId,
        usuarioId,
        jaConfirmada: true,
        itensConfirmados: 0,
        itens: itensAtuais.map(mapReservaRow),
      },
    };
  }

  const confirmadas = await tx.$queryRaw<Array<{ id: string; peca_id: string }>>`
    UPDATE "reservas"
    SET
      "status" = 'CONFIRMADA'::"StatusReserva",
      "finalizado_em" = ${agora}::timestamp(3),
      "atualizado_em" = ${agora}::timestamp(3)
    WHERE "grupo_id" = ${grupoId}::uuid
      AND "usuario_id" = ${usuarioId}::uuid
      AND "status" = 'ATIVA'::"StatusReserva"
      AND "expira_em" > ${agora}::timestamp(3)
    RETURNING "id", "peca_id"
  `;

  // A confirmação nunca devolve estoque. Quando não resta saldo nem reserva ativa na peça, marca como VENDIDA.
  for (const pecaId of pecaIdsOrdenados) {
    const peca = pecasTravadas.get(pecaId);
    if (!peca || peca.quantidade_estoque > 0) continue;

    const ativasRestantes = await tx.reserva.count({
      where: { pecaId, status: 'ATIVA' },
    });
    if (ativasRestantes === 0 && peca.status === 'RESERVADA') {
      await tx.peca.update({
        where: { id: pecaId },
        data: { status: 'VENDIDA', atualizadoEm: agora },
      });
    }
  }

  const itensFinais = await tx.reserva.findMany({
    where: { grupoId, usuarioId },
    orderBy: { pecaId: 'asc' },
  });

  return {
    tipo: 'CONFIRMADA',
    resultado: {
      grupoId,
      usuarioId,
      jaConfirmada: false,
      itensConfirmados: confirmadas.length,
      itens: itensFinais.map(mapReservaRow),
    },
  };
}

/**
 * Carrega e valida na mesma transação ACID o grupo de reservas ativo da HU-06
 * com preços unitários reais, cubagem física, ateliês de origem e comprador diretamente do PostgreSQL.
 */
export async function carregarGrupoReservaParaCheckoutNaTransacao(
  tx: PrismaTransactionClient,
  grupoId: string,
  usuarioId: string,
  agora: Date = new Date(),
): Promise<CarregamentoGrupoCheckoutDesfecho> {
  if (!isUuid(grupoId) || !isUuid(usuarioId)) {
    throw new AppError(
      'Identificador de reserva inválido.',
      422,
      RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
    );
  }

  const grupo = await tx.reservaGrupo.findUnique({
    where: { id: grupoId },
    include: {
      usuario: {
        select: {
          id: true,
          nome: true,
          email: true,
          cpfCnpj: true,
          telefoneWhatsapp: true,
        },
      },
      itens: {
        orderBy: { pecaId: 'asc' },
      },
    },
  });

  if (!grupo) {
    throw new AppError('Grupo de reservas não encontrado.', 404);
  }

  if (grupo.usuarioId !== usuarioId) {
    throw new AppError('Você não tem permissão para operar esta reserva.', 403);
  }

  if (grupo.itens.length === 0) {
    throw new AppError(
      'A reserva informada não possui itens ativos.',
      409,
      RESERVA_ERROR_CODES.RESERVA_TRANSICAO_INVALIDA,
    );
  }

  const pecaIdsOrdenados = ordenarPecaIds(grupo.itens.map((item) => item.pecaId));
  const pecasTravadas = await lockPecasOrdenadas(tx, pecaIdsOrdenados);
  await expirarPecasTravadas(tx, pecaIdsOrdenados, agora, pecasTravadas, grupoId);

  const itensCompletos = await tx.reserva.findMany({
    where: { grupoId, usuarioId },
    orderBy: { pecaId: 'asc' },
    include: {
      peca: {
        include: {
          fotos: {
            orderBy: [{ isPrincipal: 'desc' }, { ordem: 'asc' }],
            take: 1,
          },
          atelie: {
            include: {
              endereco: true,
              artesao: {
                include: {
                  usuario: {
                    select: {
                      id: true,
                      nome: true,
                      email: true,
                      telefoneWhatsapp: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (itensCompletos.length === 0) {
    throw new AppError('Nenhum item encontrado para a reserva informada.', 404);
  }

  let menorExpiraEm = itensCompletos[0]!.expiraEm;
  for (const item of itensCompletos) {
    if (item.status !== 'ATIVA' || item.expiraEm.getTime() <= agora.getTime()) {
      return { tipo: 'EXPIRADA_OU_CANCELADA' };
    }
    if (item.expiraEm.getTime() < menorExpiraEm.getTime()) {
      menorExpiraEm = item.expiraEm;
    }
  }

  return {
    tipo: 'PRONTA',
    grupo: {
      grupoId: grupo.id,
      usuarioId: grupo.usuarioId,
      expiraEm: menorExpiraEm,
      comprador: {
        usuarioId: grupo.usuario.id,
        nome: grupo.usuario.nome,
        email: grupo.usuario.email,
        cpfCnpj: grupo.usuario.cpfCnpj,
        telefoneWhatsapp: grupo.usuario.telefoneWhatsapp,
      },
      itens: itensCompletos.map((item) => ({
        reservaId: item.id,
        pecaId: item.peca.id,
        titulo: item.peca.titulo,
        quantidade: item.quantidade,
        precoUnitarioString: item.peca.preco.toString(),
        pesoGramas: item.peca.pesoGramas,
        comprimentoCm: item.peca.comprimentoCm,
        larguraCm: item.peca.larguraCm,
        alturaCm: item.peca.alturaCm,
        isFragil: item.peca.isFragil,
        fotoPrincipalUrl: item.peca.fotos[0]?.url ?? null,
        atelieId: item.peca.atelie.id,
        atelieNome: item.peca.atelie.nomeComercial,
        poloCultural: item.peca.atelie.poloCultural,
        atelieCepOrigem: item.peca.atelie.endereco?.cep ?? null,
        titularUsuarioId: item.peca.atelie.artesao.usuario.id,
        titularNome: item.peca.atelie.artesao.usuario.nome,
        titularEmail: item.peca.atelie.artesao.usuario.email,
        titularWhatsapp: item.peca.atelie.artesao.usuario.telefoneWhatsapp,
      })),
    },
  };
}

export async function carregarGrupoReservaParaCheckout(
  grupoId: string,
  usuarioId: string,
  agora?: Date,
): Promise<GrupoReservaCheckoutCarregado> {
  const desfecho = await prisma.$transaction(
    (tx) => carregarGrupoReservaParaCheckoutNaTransacao(tx, grupoId, usuarioId, agora),
    TX_OPTIONS,
  );

  if (desfecho.tipo === 'EXPIRADA_OU_CANCELADA') {
    throw new AppError(
      'A reserva de estoque expirou ou já foi finalizada. Refaça a reserva antes de pagar.',
      409,
      RESERVA_ERROR_CODES.RESERVA_TRANSICAO_INVALIDA,
    );
  }

  return desfecho.grupo;
}

export function createPrismaReservaEstoqueRepository(
  db: PrismaReservaDbClient = prisma,
): ReservaEstoqueRepository {
  return {
    async criarGrupoReserva(input: CriarGrupoReservaInput): Promise<GrupoReservaResultado> {
      if (!isUuid(input.usuarioId)) {
        throw new AppError('Identificador de usuário autenticado inválido.', 401);
      }

      const agora = input.agora ?? new Date();
      const expiraEm = input.expiraEm ?? new Date(agora.getTime() + RESERVA_TTL_MS);
      const pecaIdsOrdenados = ordenarPecaIds(input.itens.map((item) => item.pecaId));

      return db.$transaction(async (tx) => {
        // 1. Garante atomicamente a posse da chave de idempotência para este comprador.
        // Requisições simultâneas com o mesmo (usuario_id, idempotency_key) aguardam o COMMIT/ROLLBACK aqui.
        const inserido = await tx.$queryRaw<Array<{ id: string; criado_em: Date }>>`
          INSERT INTO "reservas_grupos" ("usuario_id", "idempotency_key", "payload_hash", "criado_em")
          VALUES (${input.usuarioId}::uuid, ${input.idempotencyKey}, ${input.payloadHash}, ${agora}::timestamp(3))
          ON CONFLICT ("usuario_id", "idempotency_key") DO NOTHING
          RETURNING "id", "criado_em"
        `;

        if (inserido.length === 0) {
          const existente = await tx.reservaGrupo.findUnique({
            where: {
              usuarioId_idempotencyKey: {
                usuarioId: input.usuarioId,
                idempotencyKey: input.idempotencyKey,
              },
            },
            include: {
              itens: {
                where: {
                  usuarioId: input.usuarioId,
                  idempotencyKey: input.idempotencyKey,
                },
                orderBy: { pecaId: 'asc' },
              },
              pedidos: {
                select: {
                  id: true,
                  codigoPedido: true,
                  status: true,
                  criadoEm: true,
                },
                orderBy: { criadoEm: 'desc' },
                take: 5,
              },
            },
          });

          if (!existente) {
            throw new AppError(
              'Não foi possível recuperar a reserva idempotente.',
              409,
              RESERVA_ERROR_CODES.CHAVE_IDEMPOTENCIA_CONFLITO,
            );
          }

          if (existente.payloadHash !== input.payloadHash) {
            throw new AppError(
              'A chave de idempotência já foi utilizada com uma combinação diferente de peças e quantidades.',
              409,
              RESERVA_ERROR_CODES.CHAVE_IDEMPOTENCIA_CONFLITO,
            );
          }

          const { possuiPedidoAtivo, pedidoVinculado } = resumirPedidoVinculadoReserva(
            existente.pedidos,
          );
          const menorExpiraEm = calcularMenorExpiraEmGrupo(existente.itens, existente.criadoEm);

          return {
            grupoId: existente.id,
            usuarioId: existente.usuarioId,
            idempotencyKey: existente.idempotencyKey,
            idempotente: true,
            criadoEm: existente.criadoEm.toISOString(),
            expiraEm: menorExpiraEm.toISOString(),
            ttlMinutos: RESERVA_TTL_MINUTOS,
            servidorAgora: agora.toISOString(),
            possuiPedidoAtivo,
            pedidoVinculado,
            itens: existente.itens.map(mapReservaRow),
          };
        }

        const grupo = inserido[0]!;

        // 2. Adquire locks pessimistas nas peças em ordem determinística (peca_id ASC).
        const pecasTravadas = await lockPecasOrdenadas(tx, pecaIdsOrdenados);

        for (const item of input.itens) {
          if (!pecasTravadas.has(item.pecaId)) {
            throw new AppError(`Peça '${item.pecaId}' não encontrada no acervo.`, 404);
          }
        }

        // 3. Libera preventivamente quaisquer reservas vencidas destas peças travadas (expiração lazy).
        await expirarPecasTravadas(tx, pecaIdsOrdenados, agora, pecasTravadas);

        // 4. Valida disponibilidade integral antes de debitar qualquer unidade (all-or-nothing ACID).
        for (const item of input.itens) {
          const peca = pecasTravadas.get(item.pecaId)!;
          if (peca.status !== 'DISPONIVEL') {
            throw new AppError(
              `A peça "${peca.titulo}" não está disponível para reserva no momento (status: ${peca.status}).`,
              409,
              RESERVA_ERROR_CODES.PECA_INDISPONIVEL,
            );
          }
          if (peca.quantidade_estoque < item.quantidade) {
            throw new AppError(
              peca.quantidade_estoque === 0
                ? `A peça "${peca.titulo}" está esgotada.`
                : `Estoque insuficiente para "${peca.titulo}": solicitado ${item.quantidade}, disponível ${peca.quantidade_estoque}.`,
              409,
              RESERVA_ERROR_CODES.ESTOQUE_INSUFICIENTE,
            );
          }
        }

        // 5. Decrementa cada peça de forma condicional atômica e grava as linhas de reserva vinculadas ao grupo.
        const itensPersistidos: ReservaItemPersistido[] = [];

        for (const item of input.itens) {
          const atualizadas = await tx.$queryRaw<
            Array<{ id: string; quantidade_estoque: number; status: StatusPeca }>
          >`
            UPDATE "pecas"
            SET
              "quantidade_estoque" = "quantidade_estoque" - ${item.quantidade},
              "status" = CASE
                WHEN "quantidade_estoque" - ${item.quantidade} = 0 THEN 'RESERVADA'::"StatusPeca"
                ELSE "status"
              END,
              "atualizado_em" = ${agora}::timestamp(3)
            WHERE "id" = ${item.pecaId}::uuid
              AND "status" = 'DISPONIVEL'::"StatusPeca"
              AND "quantidade_estoque" >= ${item.quantidade}
            RETURNING "id", "quantidade_estoque", "status"
          `;

          if (atualizadas.length === 0) {
            const titulo = pecasTravadas.get(item.pecaId)?.titulo ?? item.pecaId;
            throw new AppError(
              `Estoque insuficiente para reservar "${titulo}".`,
              409,
              RESERVA_ERROR_CODES.ESTOQUE_INSUFICIENTE,
            );
          }

          const criada = await tx.reserva.create({
            data: {
              grupoId: grupo.id,
              usuarioId: input.usuarioId,
              pecaId: item.pecaId,
              quantidade: item.quantidade,
              status: 'ATIVA',
              idempotencyKey: input.idempotencyKey,
              criadoEm: agora,
              expiraEm,
              atualizadoEm: agora,
              finalizadoEm: null,
              estoqueDevolvidoEm: null,
            },
          });

          itensPersistidos.push(mapReservaRow(criada));
        }

        return {
          grupoId: grupo.id,
          usuarioId: input.usuarioId,
          idempotencyKey: input.idempotencyKey,
          idempotente: false,
          criadoEm: grupo.criado_em.toISOString(),
          expiraEm: expiraEm.toISOString(),
          ttlMinutos: RESERVA_TTL_MINUTOS,
          servidorAgora: agora.toISOString(),
          possuiPedidoAtivo: false,
          pedidoVinculado: null,
          itens: itensPersistidos,
        };
      }, TX_OPTIONS);
    },

    async listarReservasUsuario(
      usuarioId: string,
      agoraParam: Date = new Date(),
    ): Promise<GrupoReservaResultado[]> {
      if (!isUuid(usuarioId)) return [];
      const agora = agoraParam;

      return db.$transaction(async (tx) => {
        // 1. Identifica reservas vencidas do próprio comprador que NÃO possuam pedido ativo (HU-10).
        const expiradasCandidatas = await tx.$queryRaw<
          Array<{ grupo_id: string; peca_id: string }>
        >`
          SELECT DISTINCT r."grupo_id", r."peca_id"
          FROM "reservas" r
          WHERE r."usuario_id" = ${usuarioId}::uuid
            AND r."status" = 'ATIVA'::"StatusReserva"
            AND r."expira_em" <= ${agora}::timestamp(3)
            AND NOT EXISTS (
              SELECT 1
              FROM "pedidos" p
              WHERE p."reserva_grupo_id" = r."grupo_id"
                AND p."status" IN (
                  'PENDENTE_PAGAMENTO'::"StatusPedido",
                  'APROVADO'::"StatusPedido",
                  'RECONCILIACAO_ESTORNO'::"StatusPedido"
                )
            )
          ORDER BY r."peca_id" ASC, r."grupo_id" ASC
        `;

        if (expiradasCandidatas.length > 0) {
          const pecaIdsOrdenados = ordenarPecaIds(expiradasCandidatas.map((c) => c.peca_id));
          const grupoIdsCandidatos = Array.from(
            new Set(expiradasCandidatas.map((c) => c.grupo_id)),
          );

          const pecasTravadas = await lockPecasOrdenadas(tx, pecaIdsOrdenados);

          // Revalida vínculo com pedido ativo pós-lock para eliminar corrida com checkout concorrente.
          const pedidosAtivosConcorrentes = await tx.pedido.findMany({
            where: {
              reservaGrupoId: { in: grupoIdsCandidatos },
              status: { in: STATUS_PEDIDOS_ATIVOS_LISTA },
            },
            select: { reservaGrupoId: true },
          });
          const gruposComPedidoAtivo = new Set(
            pedidosAtivosConcorrentes.map((p) => p.reservaGrupoId),
          );
          const grupoIdsElegiveis = grupoIdsCandidatos.filter(
            (grupoId) => !gruposComPedidoAtivo.has(grupoId),
          );

          if (grupoIdsElegiveis.length > 0) {
            await expirarPecasTravadas(
              tx,
              pecaIdsOrdenados,
              agora,
              pecasTravadas,
              grupoIdsElegiveis,
            );
          }
        }

        // 2. Carrega grupos recentes do usuário já refletindo expiração e vínculo com pedido (HU-09/HU-10).
        const grupos = await tx.reservaGrupo.findMany({
          where: { usuarioId },
          include: {
            itens: {
              where: { usuarioId },
              orderBy: { pecaId: 'asc' },
            },
            pedidos: {
              select: {
                id: true,
                codigoPedido: true,
                status: true,
                criadoEm: true,
              },
              orderBy: { criadoEm: 'desc' },
              take: 5,
            },
          },
          orderBy: { criadoEm: 'desc' },
          take: 25,
        });

        const servidorAgora = agora.toISOString();

        return grupos
          .filter((g) => g.itens.length > 0)
          .map((g) => {
            const { possuiPedidoAtivo, pedidoVinculado } = resumirPedidoVinculadoReserva(
              g.pedidos,
            );
            const menorExpiraEm = calcularMenorExpiraEmGrupo(g.itens, g.criadoEm);

            return {
              grupoId: g.id,
              usuarioId: g.usuarioId,
              idempotencyKey: g.idempotencyKey,
              idempotente: false,
              criadoEm: g.criadoEm.toISOString(),
              expiraEm: menorExpiraEm.toISOString(),
              ttlMinutos: RESERVA_TTL_MINUTOS,
              servidorAgora,
              possuiPedidoAtivo,
              pedidoVinculado,
              itens: g.itens.map(mapReservaRow),
            };
          });
      }, TX_OPTIONS);
    },

    async cancelarPorGrupo(
      grupoId: string,
      usuarioId: string,
      agoraParam?: Date,
    ): Promise<CancelamentoReservaResultado> {
      return db.$transaction(
        (tx) =>
          cancelarGrupoReservaNaTransacao(tx, grupoId, usuarioId, agoraParam, {
            bloquearSePedidoAtivo: true,
          }),
        TX_OPTIONS,
      );
    },

    async cancelarReservaItem(
      reservaId: string,
      usuarioId: string,
      agoraParam?: Date,
    ): Promise<CancelamentoReservaResultado> {
      if (!isUuid(reservaId) || !isUuid(usuarioId)) {
        throw new AppError(
          'Identificador de reserva inválido.',
          422,
          RESERVA_ERROR_CODES.RESERVA_DADOS_INVALIDOS,
        );
      }

      const agora = agoraParam ?? new Date();

      return db.$transaction(async (tx) => {
        const reserva = await tx.reserva.findUnique({ where: { id: reservaId } });
        if (!reserva) {
          throw new AppError('Reserva não encontrada.', 404);
        }

        if (reserva.usuarioId !== usuarioId) {
          throw new AppError('Você não tem permissão para cancelar esta reserva.', 403);
        }

        await lockPecasOrdenadas(tx, [reserva.pecaId]);
        await garantirSemPedidoAtivoParaCancelamento(tx, reserva.grupoId);

        const atualizados = await tx.$queryRaw<ExpiredRow[]>`
          UPDATE "reservas"
          SET
            "status" = 'CANCELADA'::"StatusReserva",
            "finalizado_em" = ${agora}::timestamp(3),
            "estoque_devolvido_em" = ${agora}::timestamp(3),
            "atualizado_em" = ${agora}::timestamp(3)
          WHERE "id" = ${reservaId}::uuid
            AND "usuario_id" = ${usuarioId}::uuid
            AND "status" = 'ATIVA'::"StatusReserva"
          RETURNING "peca_id", "quantidade"
        `;

        let unidadesDevolvidas = 0;
        if (atualizados.length > 0) {
          const incremento = atualizados[0]!.quantidade;
          unidadesDevolvidas = incremento;
          await tx.$queryRaw`
            UPDATE "pecas"
            SET
              "quantidade_estoque" = "quantidade_estoque" + ${incremento},
              "status" = CASE
                WHEN "status" = 'RESERVADA'::"StatusPeca" AND ("quantidade_estoque" + ${incremento}) > 0
                  THEN 'DISPONIVEL'::"StatusPeca"
                ELSE "status"
              END,
              "atualizado_em" = ${agora}::timestamp(3)
            WHERE "id" = ${reserva.pecaId}::uuid
          `;
        }

        const itemAtualizado = await tx.reserva.findUnique({ where: { id: reservaId } });
        if (!itemAtualizado) {
          throw new AppError('Reserva não encontrada.', 404);
        }

        if (atualizados.length === 0 && itemAtualizado.status === 'CONFIRMADA') {
          throw new AppError(
            'A reserva já foi confirmada e não pode ser cancelada por esta rota.',
            409,
            RESERVA_ERROR_CODES.RESERVA_TRANSICAO_INVALIDA,
          );
        }

        return {
          grupoId: itemAtualizado.grupoId,
          usuarioId,
          jaFinalizada: atualizados.length === 0,
          itensCancelados: atualizados.length,
          unidadesDevolvidas,
          itens: [mapReservaRow(itemAtualizado)],
        };
      }, TX_OPTIONS);
    },

    async confirmarPorGrupo(
      grupoId: string,
      usuarioId: string,
      agoraParam?: Date,
    ): Promise<ConfirmacaoReservaResultado> {
      const desfecho = await db.$transaction(
        (tx) => confirmarGrupoReservaNaTransacao(tx, grupoId, usuarioId, agoraParam),
        TX_OPTIONS,
      );

      if (desfecho.tipo === 'NAO_ENCONTRADA') {
        throw new AppError('Grupo de reservas não encontrado.', 404);
      }
      if (desfecho.tipo === 'PROIBIDA') {
        throw new AppError('Você não tem permissão para confirmar esta reserva.', 403);
      }
      if (desfecho.tipo === 'EXPIRADA_OU_CANCELADA') {
        throw new AppError(
          'A reserva já expirou ou foi cancelada e não pode ser confirmada.',
          409,
          RESERVA_ERROR_CODES.RESERVA_TRANSICAO_INVALIDA,
        );
      }

      return desfecho.resultado;
    },

    async expirarReservasVencidas(agoraParam?: Date): Promise<ExpiracaoReservasResultado> {
      const agora = agoraParam ?? new Date();

      return db.$transaction(async (tx) => {
        const candidatas = await tx.$queryRaw<Array<{ peca_id: string }>>`
          SELECT DISTINCT "peca_id"
          FROM "reservas"
          WHERE "status" = 'ATIVA'::"StatusReserva"
            AND "expira_em" <= ${agora}::timestamp(3)
          ORDER BY "peca_id" ASC
          LIMIT ${EXPIRATION_BATCH_PECAS_LIMIT}
        `;

        if (candidatas.length === 0) {
          return { reservasExpiradas: 0, unidadesDevolvidas: 0, pecasAtualizadas: 0 };
        }

        const pecaIdsOrdenados = candidatas.map((c) => c.peca_id);
        const pecasTravadas = await lockPecasOrdenadas(tx, pecaIdsOrdenados);

        return expirarPecasTravadas(tx, pecaIdsOrdenados, agora, pecasTravadas);
      }, TX_OPTIONS);
    },
  };
}

export const prismaReservaEstoqueRepository: ReservaEstoqueRepository =
  createPrismaReservaEstoqueRepository();
